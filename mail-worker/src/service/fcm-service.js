let cachedToken = { value: '', expiresAt: 0 };

function b64url(bytes) {
	const arr = new Uint8Array(bytes);
	let bin = '';
	for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
	return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pkcs8Bytes(pem) {
	const b64 = String(pem)
		.replace(/-----BEGIN PRIVATE KEY-----/g, '')
		.replace(/-----END PRIVATE KEY-----/g, '')
		.replace(/\s+/g, '');
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function getAccessToken(env) {
	const now = Date.now();
	if (cachedToken.value && cachedToken.expiresAt > now) return cachedToken.value;

	const clientEmail = env.FIREBASE_CLIENT_EMAIL;
	const privateKey = String(env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
	if (!clientEmail || !privateKey) {
		console.error(`FCM_SKIP_NO_CREDENTIALS clientEmail=${Boolean(clientEmail)} privateKey=${Boolean(privateKey)}`);
		return '';
	}

	const iat = Math.floor(now / 1000);
	const unsigned = `${b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${b64url(
		new TextEncoder().encode(JSON.stringify({
			iss: clientEmail,
			scope: 'https://www.googleapis.com/auth/firebase.messaging',
			aud: 'https://oauth2.googleapis.com/token',
			iat,
			exp: iat + 3600
		}))
	)}`;

	const key = await crypto.subtle.importKey(
		'pkcs8', pkcs8Bytes(privateKey),
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
	);
	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: `${unsigned}.${b64url(signature)}`
		}).toString(),
		signal: AbortSignal.timeout(8000)
	});
	if (!res.ok) {
		console.error(`FCM_OAUTH_FAILED status=${res.status}`);
		throw new Error(`google oauth ${res.status}`);
	}

	const json = await res.json();
	const ttl = Number(json.expires_in || 3600) - 300;
	cachedToken = { value: json.access_token, expiresAt: now + ttl * 1000 };
	return cachedToken.value;
}

async function sendOne(accessToken, projectId, token, data) {
	const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			message: {
				token,
				data: {
					emailId: String(data.emailId || ''),
					type: 'email',
					sender: String(data.sender || data.from || ''),
					name: String(data.name || ''),
					subject: String(data.subject || '').slice(0, 200),
					snippet: String(data.snippet || '').slice(0, 200)
				},
				android: { priority: 'high', ttl: '86400s' }
			}
		}),
		signal: AbortSignal.timeout(8000)
	});

	const text = await res.text().catch(() => '');
	if (res.ok) return { ok: true };

	let errorCodes = [];
	try {
		const json = JSON.parse(text);
		errorCodes = (json.error?.details || []).map(d => d.errorCode).filter(Boolean);
	} catch { /* 非 JSON 错误体忽略 */ }

	return { ok: false, status: res.status, errorCodes, detail: text.slice(0, 300) };
}

const fcmService = {
	async upsertDevice(c, userId, { token, platform, deviceId, appVersion }) {
		await c.env.db.prepare(`
			INSERT INTO push_device (user_id, token, platform, device_id, app_version, create_time, update_time)
			VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT(token) DO UPDATE SET
				user_id = excluded.user_id,
				platform = excluded.platform,
				device_id = excluded.device_id,
				app_version = excluded.app_version,
				update_time = CURRENT_TIMESTAMP,
				last_error_at = NULL
		`).bind(userId, token, platform, deviceId, appVersion).run();

		// 同一设备换了 token：删旧行，避免继续向失效 token 推送。
		if (deviceId) {
			await c.env.db.prepare(`
				DELETE FROM push_device
				WHERE user_id = ? AND platform = ? AND device_id = ? AND token <> ?
			`).bind(userId, platform, deviceId, token).run();
		}
	},

	async deleteDevice(c, userId, token) {
		await c.env.db.prepare('DELETE FROM push_device WHERE token = ? AND user_id = ?')
			.bind(token, userId).run();
	},

	async sendToUser({ env }, userId, data) {
		if (!userId) {
			console.error('FCM_SKIP_NO_USER');
			return [];
		}
		const rows = await env.db.prepare(
			"SELECT token FROM push_device WHERE user_id = ? AND platform = 'android'"
		).bind(Number(userId)).all();
		const tokens = (rows.results || []).map(r => r.token).filter(Boolean);
		if (tokens.length === 0) {
			console.error(`FCM_SKIP_NO_DEVICE userId=${userId}`);
			return [];
		}

		let accessToken = '';
		try {
			accessToken = await getAccessToken(env);
		} catch (e) {
			console.error(`FCM_SKIP_ACCESS_TOKEN ${e?.message || String(e)}`);
			return [];
		}
		if (!accessToken) {
			console.error(`FCM_SKIP_NO_ACCESS_TOKEN userId=${userId} devices=${tokens.length}`);
			return [];
		}

		const projectId = env.FIREBASE_PROJECT_ID;
		if (!projectId) {
			console.error(`FCM_SKIP_NO_PROJECT_ID userId=${userId} devices=${tokens.length}`);
			return [];
		}
		const results = [];

		for (const token of tokens) {
			try {
				const r = await sendOne(accessToken, projectId, token, data);
				results.push({ token: token.slice(-8), ...r });
				if (r.ok) continue;

				// 只删明确失效的 token；INVALID_ARGUMENT 也可能是消息体问题，不误删。
				const dead = r.errorCodes.includes('UNREGISTERED');
				if (dead) {
					await env.db.prepare('DELETE FROM push_device WHERE token = ?').bind(token).run();
				} else {
					await env.db.prepare(
						'UPDATE push_device SET last_error_at = CURRENT_TIMESTAMP WHERE token = ?'
					).bind(token).run();
				}
				console.error(`FCM 发送失败 token=…${token.slice(-8)} status=${r.status} codes=${r.errorCodes.join(',')}`);
			} catch (e) {
				try {
					await env.db.prepare(
						'UPDATE push_device SET last_error_at = CURRENT_TIMESTAMP WHERE token = ?'
					).bind(token).run();
				} catch { /* 连 D1 都失败时忽略 */ }
				console.error('FCM 发送异常: ', e?.message || String(e));
			}
		}

		return results;
	}
};

export default fcmService;

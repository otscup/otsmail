import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import { eq, and, or, ne, sql } from 'drizzle-orm';
import orm from '../entity/orm';
import { passkey } from '../entity/passkey';
import { oauth } from '../entity/oauth';
import BizError from '../error/biz-error';
import {
	PASSKEY_KV_LOGIN,
	PASSKEY_KV_REG,
	PASSKEY_KV_TTL,
	expectedOrigins,
	requestHostname,
	resolveRpID
} from '../lib/passkey-config';
import loginService from './login-service';
import userService from './user-service';

function kvOf(c) {
	if (!c.env?.kv) throw new BizError('KV 未绑定，通行密钥不可用，请联系服务器管理员', 502);
	return c.env.kv;
}

function b64urlToBytes(value) {
	const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function bytesToB64url(bytes) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 从 clientDataJSON 里取出挑战，用于回查服务端签发过的值（不信任客户端自带的任何校验结论） */
function challengeFromClientData(clientDataJSON) {
	if (!clientDataJSON) return '';
	try {
		const parsed = JSON.parse(new TextDecoder().decode(b64urlToBytes(clientDataJSON)));
		return typeof parsed?.challenge === 'string' ? parsed.challenge : '';
	} catch (e) {
		return '';
	}
}

/** 标准 base64 的 + / 换成 base64url 的 - _，并去掉尾部 = 填充（本来就合法的不会变） */
function toB64url(value) {
	if (typeof value !== 'string' || !value) return value;
	return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * D1 的 CURRENT_TIMESTAMP 存的是 UTC 但不带时区后缀（形如 "2026-11-11 21:00:58"），
 * 浏览器 new Date(str) 会按本地时区解析，导致列表时间差 8 小时。
 * 这里统一补成带 Z 的 ISO 字符串（"2026-11-11T21:00:58.000Z"），
 * 前端再按 Asia/Shanghai 渲染；已经带时区标识的值原样返回。
 */
function toIsoUtc(value) {
	if (!value) return value;
	const text = String(value).trim();
	if (!text) return text;
	if (/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) return text;
	const normalized = text.includes('T') ? text : text.replace(' ', 'T');
	const date = new Date(normalized + 'Z');
	return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

/**
 * Android Credential Manager 返回的 registrationResponseJson 里，id 与 rawId 有时编码风格不一致
 * （一个是标准 base64 带 + / 或 = 填充，另一个是 base64url），而 @simplewebauthn/server v14
 * 是逐字符比较 id 与 rawId 的，会直接抛 "Credential ID was not base64url-encoded"。
 * 这里统一归一化成无填充 base64url 再交给库；归一化后仍然不相等说明是真的两份数据，必须拒绝。
 */
function normalizeCredential(credential) {
	if (!credential || typeof credential !== 'object') return credential;
	const id = toB64url(credential.id);
	const rawId = toB64url(credential.rawId);
	if (id && rawId && id !== rawId) {
		throw new BizError('通行密钥凭据数据异常（id 与 rawId 不一致），请重新添加', 400);
	}
	const response = credential.response || {};
	return {
		...credential,
		id: id || rawId,
		rawId: rawId || id,
		response: {
			...response,
			clientDataJSON: toB64url(response.clientDataJSON),
			attestationObject: toB64url(response.attestationObject),
			authenticatorData: toB64url(response.authenticatorData),
			signature: toB64url(response.signature),
			userHandle: toB64url(response.userHandle)
		}
	};
}

const passkeyService = {

	// 生成用于注册的 Challenge（挑战写入 KV，校验时必须回查）
	async registerOptions(c, userId, userEmail) {
		const kv = kvOf(c);
		// 多域名：按本次请求的 Host 选中对应 rpID，注册挑战就绑在这个 rpID 上
		const rpID = resolveRpID(c.env, requestHostname(c));
		const existing = await orm(c)
			.select({ credentialId: passkey.credentialId })
			.from(passkey)
			.where(eq(passkey.userId, userId))
			.all();

		const options = await generateRegistrationOptions({
			rpName: 'OTSMail',
			rpID,
			userName: userEmail,
			userID: new TextEncoder().encode(String(userId)),
			userDisplayName: userEmail.split('@')[0],
			timeout: 60000,
			attestationType: 'none',
			excludeCredentials: existing
				.filter(item => item.credentialId)
				.map(item => ({ id: item.credentialId })),
			authenticatorSelection: {
				userVerification: 'preferred',
				residentKey: 'preferred'
			}
		});

		// 现有 App / 网页客户端会对 user.id 再做一次 base64url，这里保持旧契约返回原始 userId 字符串，
		// 否则同一用户在客户端侧会拿到双重编码的 user handle。
		options.user.id = String(userId);

		await kv.put(PASSKEY_KV_REG + userId, options.challenge, { expirationTtl: PASSKEY_KV_TTL });
		return options;
	},

	// 校验注册响应：挑战、origin（含 android:apk-key-hash）、rpID、attestation 公钥
	async registerVerify(c, userId, rawCredential) {
		const kv = kvOf(c);
		const credential = normalizeCredential(rawCredential);
		if (!credential?.id) throw new BizError('凭据 ID 缺失', 400);

		const expectedChallenge = await kv.get(PASSKEY_KV_REG + userId);
		if (!expectedChallenge) throw new BizError('注册挑战已过期，请重新添加通行密钥', 400);

		// 断言里的 rpID / origin 必须与本次请求解析出的 rpID 一致，不做跨域名放行
		const rpID = resolveRpID(c.env, requestHostname(c));

		let verification;
		try {
			verification = await verifyRegistrationResponse({
				response: credential,
				expectedChallenge,
				expectedOrigin: expectedOrigins(c.env, rpID),
				expectedRPID: rpID,
				requireUserVerification: false
			});
		} catch (e) {
			throw new BizError('通行密钥注册校验失败：' + e.message, 400);
		} finally {
			// 一次性挑战：无论成功失败都作废，避免重放
			await kv.delete(PASSKEY_KV_REG + userId);
		}

		if (!verification.verified || !verification.registrationInfo) {
			throw new BizError('通行密钥注册校验失败', 400);
		}

		const { credential: registered, counter } = verification.registrationInfo;

		await orm(c).insert(passkey).values({
			userId,
			credentialId: registered.id,
			// 这里必须存 attestationObject 里解出的 COSE 公钥，登录验签全靠它
			publicKey: bytesToB64url(registered.publicKey),
			counter: counter || 0,
			name: 'Passkey ' + new Date().toLocaleDateString()
		}).onConflictDoNothing().run();

		return true;
	},

	// 列出用户所有 Passkey
	async list(c, userId) {
		const rows = await orm(c).select({
			id: passkey.id,
			name: passkey.name,
			credentialId: passkey.credentialId,
			createdAt: passkey.createdAt
		}).from(passkey).where(eq(passkey.userId, userId)).all();
		// createdAt 是 D1 的 UTC 裸时间，统一补上时区标识再返回，避免前端按本地时间误读
		return rows.map(row => ({ ...row, createdAt: toIsoUtc(row.createdAt) }));
	},

	// 删除某个 Passkey（限定本人，避免越权删除他人凭据）
	async delete(c, userId, id) {
		const numericId = Number(id);
		if (!Number.isInteger(numericId)) {
			return true;
		}

		const target = await orm(c).select({ id: passkey.id }).from(passkey)
			.where(and(eq(passkey.id, numericId), eq(passkey.userId, userId))).get();
		// 不存在或不属于本人：保持原来的幂等语义，直接返回
		if (!target) return true;

		// 熔断校验：只有「删掉这条后账号将没有任何可用登录方式」时才拒绝。
		// 可用登录方式 = 密码登录（未关闭） / 已绑定且启用的第三方或 OIDC 账号 / 其他 Passkey。
		// 第三方绑定是否可用沿用 user-service.togglePasswordLogin 的判定口径（active 为空或非 0）。
		const userRow = await userService.selectById(c, userId);
		if (Number(userRow?.disablePasswordLogin) === 1) {
			const [remain, bindings] = await Promise.all([
				orm(c).select({ id: passkey.id }).from(passkey)
					.where(eq(passkey.userId, userId)).all(),
				orm(c).select({ oauthId: oauth.oauthId }).from(oauth)
					.where(and(eq(oauth.userId, userId), or(sql`${oauth.active} IS NULL`, ne(oauth.active, 0)))).all()
			]);
			const otherPasskeyCount = (remain?.length || 0) - 1;
			const hasOtherLogin = otherPasskeyCount > 0 || (bindings?.length || 0) > 0;
			if (!hasOtherLogin) {
				throw new BizError('无法删除最后一条通行密钥：当前已关闭密码登录，且账号没有其他可用登录方式（未绑定 GitHub / Google / LinuxDo / 企业 SSO，也没有其他通行密钥）。请先在「第三方账号」中绑定一种登录方式，或重新开启密码登录后再删除', 400);
			}
		}

		await orm(c).delete(passkey).where(and(eq(passkey.id, numericId), eq(passkey.userId, userId))).run();
		return true;
	},

	// 生成免密登录 Options（发现式凭据：不指定 allowCredentials）
	async loginOptions(c) {
		const kv = kvOf(c);
		const options = await generateAuthenticationOptions({
			rpID: resolveRpID(c.env, requestHostname(c)),
			timeout: 60000,
			userVerification: 'preferred'
		});
		await kv.put(PASSKEY_KV_LOGIN + options.challenge, '1', { expirationTtl: PASSKEY_KV_TTL });
		return options;
	},

	// 验证免密登录凭据并生成 Session Token
	async loginVerify(c, rawCredential) {
		const kv = kvOf(c);
		const credential = normalizeCredential(rawCredential);
		const credentialId = credential?.id;
		if (!credentialId) throw new BizError('凭据 ID 缺失', 400);

		// 挑战必须来自服务端写入 KV 的那次登录，客户端自己编的挑战一律不认
		const expectedChallenge = challengeFromClientData(credential?.response?.clientDataJSON);
		if (!expectedChallenge) throw new BizError('凭据数据不完整', 400);
		const issued = await kv.get(PASSKEY_KV_LOGIN + expectedChallenge);
		if (!issued) throw new BizError('登录挑战已过期，请重新登录', 400);

		const row = await orm(c).select().from(passkey).where(eq(passkey.credentialId, credentialId)).get();
		if (!row) throw new BizError('未找到与该设备匹配的 Passkey，请使用其他方式登录', 400);

		// 旧版本把 credentialId 当公钥存了，这类记录无法验签，只能让用户重新注册
		if (row.publicKey === row.credentialId) {
			throw new BizError('该通行密钥已失效，请登录后在设置中重新添加', 400);
		}

		// 断言里的 rpID / origin 必须与本次请求解析出的 rpID 一致，注册和登录同一套规则
		const rpID = resolveRpID(c.env, requestHostname(c));

		let verification;
		try {
			verification = await verifyAuthenticationResponse({
				response: credential,
				expectedChallenge,
				expectedOrigin: expectedOrigins(c.env, rpID),
				expectedRPID: rpID,
				credential: {
					id: row.credentialId,
					publicKey: b64urlToBytes(row.publicKey),
					counter: row.counter || 0
				},
				requireUserVerification: false
			});
		} catch (e) {
			throw new BizError('通行密钥验证失败：' + e.message, 400);
		} finally {
			await kv.delete(PASSKEY_KV_LOGIN + expectedChallenge);
		}

		// 签名验不过直接拒绝，绝不再「凭据存在就发 token」
		if (!verification.verified) throw new BizError('通行密钥验证失败', 400);

		await orm(c)
			.update(passkey)
			.set({ counter: verification.authenticationInfo.newCounter })
			.where(eq(passkey.id, row.id))
			.run();

		const userRow = await userService.selectById(c, row.userId);
		if (!userRow || userRow.isDel === 1) throw new BizError('账号异常', 400);

		// 免密登录成功，调用 login 生成登录 Token
		const token = await loginService.login(c, { email: userRow.email }, true);
		return { token };
	}
};

export default passkeyService;

import BizError from '../error/biz-error';
import { getProvider, resolveEndpoint, detectProvider } from '../utils/mail-providers';

/**
 * 第三方邮箱凭据库。
 *
 * 加密：AES-256-GCM（WebCrypto），密钥只来自 Worker secret `EXT_CRED_KEY`（32 字节 base64）。
 * 密文格式：v1.<iv-b64>.<ciphertext-b64>；AAD = userId:accountId:provider，防密文跨账号搬运。
 * 与现有数据隔离：独立表 ext_account、独立密钥，不复用 JWT 密钥；明文只在内存中出现一次。
 *
 * 未配置密钥时直接拒绝写入（不退化成明文），保证"要么加密、要么绑不上"。
 */

let schemaReady = false;

const keyCache = new Map();

function toB64(bytes) {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

function fromB64(text) {
	const bin = atob(text);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function enc(text) {
	return new TextEncoder().encode(text);
}

async function getKey(env) {
	const raw = String(env.EXT_CRED_KEY || '').trim();
	if (!raw) throw new BizError('服务端未配置凭据加密密钥（EXT_CRED_KEY），已拒绝保存第三方凭据', 503);
	if (keyCache.has(raw)) return keyCache.get(raw);

	const bytes = fromB64(raw);
	if (bytes.length !== 32) throw new BizError('EXT_CRED_KEY 必须是 32 字节的 base64', 503);

	const key = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
	keyCache.set(raw, key);
	return key;
}

export async function sealSecret(env, plain, aad) {
	const key = await getKey(env);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc(aad) }, key, enc(plain));
	return `v1.${toB64(iv)}.${toB64(new Uint8Array(ct))}`;
}

/** 供后续批次（拉取 / 发信）解密使用；本批不暴露给任何接口。 */
export async function openSecret(env, sealed, aad) {
	const parts = String(sealed || '').split('.');
	if (parts.length !== 3 || parts[0] !== 'v1') throw new BizError('凭据密文格式不正确', 500);

	const key = await getKey(env);
	const iv = fromB64(parts[1]);
	const data = fromB64(parts[2]);
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc(aad) }, key, data);
	return new TextDecoder().decode(plain);
}

export async function ensureSchema(c) {
	if (schemaReady) return;
	await c.env.db.prepare(`
		CREATE TABLE IF NOT EXISTS ext_account (
			ext_id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			account_id INTEGER NOT NULL,
			provider TEXT NOT NULL,
			address TEXT NOT NULL,
			auth_type TEXT NOT NULL,
			secret_seal TEXT NOT NULL,
			secret_version INTEGER NOT NULL DEFAULT 1,
			imap_host TEXT NOT NULL,
			imap_port INTEGER NOT NULL,
			smtp_host TEXT NOT NULL,
			smtp_port INTEGER NOT NULL,
			imap_idle INTEGER NOT NULL DEFAULT 0,
			status INTEGER NOT NULL DEFAULT 0,
			last_check_at DATETIME,
			last_error TEXT,
			create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
			update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
			is_del INTEGER NOT NULL DEFAULT 0
		)
	`).run();
	await c.env.db.prepare(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_account_user_address
		ON ext_account(user_id, address) WHERE is_del = 0
	`).run();
	// 拉取游标（客户端拉取时把 UIDVALIDITY / 最后 UID 带回来，换手机靠它续传）
	await c.env.db.prepare(`
		CREATE TABLE IF NOT EXISTS ext_sync_state (
			ext_id INTEGER PRIMARY KEY,
			user_id INTEGER NOT NULL,
			uid_validity INTEGER NOT NULL DEFAULT 0,
			last_uid INTEGER NOT NULL DEFAULT 0,
			uid_next INTEGER NOT NULL DEFAULT 0,
			last_sync_at DATETIME,
			last_error TEXT
		)
	`).run();
	schemaReady = true;
}

function assertAddress(address) {
	const value = String(address || '').trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
		throw new BizError('邮箱地址格式不正确', 400);
	}
	return value;
}

export async function list(c, userId) {
	await ensureSchema(c);
	const rows = await c.env.db.prepare(`
		SELECT a.ext_id, a.account_id, a.provider, a.address, a.auth_type, a.imap_host, a.imap_port,
		       a.smtp_host, a.smtp_port, a.imap_idle, a.status, a.last_check_at, a.last_error, a.create_time,
		       COALESCE(s.uid_validity, 0) AS uid_validity, COALESCE(s.last_uid, 0) AS last_uid,
		       COALESCE(s.uid_next, 0) AS uid_next, s.last_sync_at, s.last_error AS sync_error
		FROM ext_account a
		LEFT JOIN ext_sync_state s ON s.ext_id = a.ext_id
		WHERE a.user_id = ? AND a.is_del = 0
		ORDER BY a.ext_id DESC
	`).bind(userId).all();
	return rows.results || [];
}

/**
 * 拉取需要一次性明文口令：客户端直连 IMAP，必须在内存里有授权码。
 * 这里只在 TLS 上单次下发，客户端用完即弃，不落盘、不进日志。
 */
export async function credential(c, userId, extId) {
	await ensureSchema(c);
	const id = Number(extId);
	if (!Number.isFinite(id) || id <= 0) throw new BizError('缺少第三方邮箱 id', 400);

	const row = await c.env.db.prepare(`
		SELECT ext_id, account_id, provider, address, auth_type, secret_seal,
		       imap_host, imap_port, smtp_host, smtp_port
		FROM ext_account
		WHERE ext_id = ? AND user_id = ? AND is_del = 0
	`).bind(id, userId).first();
	if (!row) throw new BizError('没有找到这个第三方邮箱', 404);

	const aad = `${userId}:${row.account_id}:${row.provider}`;
	const secret = await openSecret(c.env, row.secret_seal, aad);
	return {
		extId: row.ext_id,
		provider: row.provider,
		address: row.address,
		authType: row.auth_type,
		secret,
		imapHost: row.imap_host,
		imapPort: row.imap_port,
		smtpHost: row.smtp_host,
		smtpPort: row.smtp_port,
	};
}

export async function bind(c, userId, body = {}) {
	await ensureSchema(c);

	const address = assertAddress(body.address);
	const authType = String(body.authType || '').trim();
	const secret = String(body.secret || '').trim();

	const provider = getProvider(body.providerId) || detectProvider(address);
	if (!provider) throw new BizError('未识别的邮箱域名，请手动填写 IMAP / SMTP 服务器', 400);
	if (!provider.auth.some(a => a.type === authType)) throw new BizError('该邮箱不支持这种授权方式', 400);
	if (secret.length < 4 || secret.length > 4096) throw new BizError('授权码长度不合法', 400);

	// 绑定前必须已经通过连通性验证（第一批由客户端实测后回传，第二批改为服务端复核）
	const probe = body.probe || {};
	if (probe.imapOk !== true || probe.smtpOk !== true) {
		throw new BizError('IMAP 与 SMTP 都验证通过后才能完成绑定', 400);
	}

	const endpoint = resolveEndpoint(address, provider.id, body);
	if (endpoint.error) throw new BizError(endpoint.error, 400);

	const exists = await c.env.db.prepare(
		`SELECT ext_id FROM ext_account WHERE user_id = ? AND address = ? AND is_del = 0`
	).bind(userId, address).first();
	if (exists) throw new BizError('这个邮箱已经绑定过了', 400);

	const acc = await c.env.db.prepare(
		`INSERT INTO account (email, status, user_id) VALUES (?, 0, ?)`
	).bind(address, userId).run();
	const accountId = Number(acc.meta?.last_row_id || 0);
	if (!accountId) throw new BizError('创建本地账户失败', 500);

	try {
		const aad = `${userId}:${accountId}:${provider.id}`;
		const sealed = await sealSecret(c.env, secret, aad);

		const inserted = await c.env.db.prepare(`
			INSERT INTO ext_account (
				user_id, account_id, provider, address, auth_type, secret_seal, secret_version,
				imap_host, imap_port, smtp_host, smtp_port, imap_idle, status, last_check_at, last_error
			) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, NULL)
		`).bind(
			userId,
			accountId,
			provider.id,
			address,
			authType,
			sealed,
			endpoint.imap.host,
			endpoint.imap.port,
			endpoint.smtp.host,
			endpoint.smtp.port,
			probe.imapIdle === true ? 1 : 0,
		).run();

		return {
			extId: Number(inserted.meta?.last_row_id || 0),
			accountId,
			provider: provider.id,
			address,
			authType,
		};
	} catch (e) {
		// 第二步失败就把本地账户行回收，避免列表里留一个空账户
		await c.env.db.prepare(`DELETE FROM account WHERE account_id = ? AND user_id = ?`).bind(accountId, userId).run();
		throw e;
	}
}

export async function remove(c, userId, extId) {
	await ensureSchema(c);
	const row = await c.env.db.prepare(
		`SELECT ext_id, account_id FROM ext_account WHERE ext_id = ? AND user_id = ? AND is_del = 0`
	).bind(extId, userId).first();
	if (!row) throw new BizError('没有找到这个第三方邮箱', 404);

	await c.env.db.prepare(
		`UPDATE ext_account SET is_del = 1, update_time = CURRENT_TIMESTAMP WHERE ext_id = ?`
	).bind(extId).run();
	await c.env.db.prepare(
		`UPDATE account SET is_del = 1 WHERE account_id = ? AND user_id = ?`
	).bind(row.account_id, userId).run();
	return true;
}

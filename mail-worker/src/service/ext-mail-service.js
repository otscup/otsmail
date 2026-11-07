import BizError from '../error/biz-error';
import r2Service from './r2-service';
import { ensureSchema as ensureAccountSchema } from './ext-account-service';

/**
 * 第三方邮件归档。
 *
 * 归档只做「存 + 查」，不承担拉取：IMAP 拉取在客户端设备上执行（Workers 撑不住长连接），
 * 拉到一封就立刻 POST 到这里落库，游标（uid_validity / last_uid）随归档一起推进，
 * 所以断网重来不会重复入库（ext_id + message_id 唯一）。
 *
 * 正文落 D1（单段截断到 256 KB）；附件字节落 R2 / S3 / KV（走 r2Service），D1 只存元信息与 key。
 * 单附件 5 MB、单封合计 15 MB、单封最多 12 个附件，超出的只存元信息（size/filename），不存字节。
 * 清理：解绑时删除该 ext_id 的 R2 对象并硬删归档行（见 dropArchive）。
 */

const MAX_TEXT = 256 * 1024;
const MAX_ATT = 5 * 1024 * 1024;
const MAX_ATT_TOTAL = 15 * 1024 * 1024;
const MAX_ATT_COUNT = 12;

let schemaReady = false;

export async function ensureMailSchema(c) {
	if (schemaReady) return;
	await ensureAccountSchema(c);
	await c.env.db.prepare(`
		CREATE TABLE IF NOT EXISTS ext_mail (
			mail_id INTEGER PRIMARY KEY AUTOINCREMENT,
			ext_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			account_id INTEGER NOT NULL,
			message_id TEXT NOT NULL,
			uid INTEGER NOT NULL DEFAULT 0,
			uid_validity INTEGER NOT NULL DEFAULT 0,
			subject TEXT NOT NULL DEFAULT '',
			from_name TEXT NOT NULL DEFAULT '',
			from_addr TEXT NOT NULL DEFAULT '',
			to_name TEXT NOT NULL DEFAULT '',
			to_addr TEXT NOT NULL DEFAULT '',
			cc TEXT NOT NULL DEFAULT '',
			date INTEGER NOT NULL DEFAULT 0,
			seen INTEGER NOT NULL DEFAULT 0,
			snippet TEXT NOT NULL DEFAULT '',
			body_text TEXT NOT NULL DEFAULT '',
			body_html TEXT NOT NULL DEFAULT '',
			att_count INTEGER NOT NULL DEFAULT 0,
			create_time DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`).run();
	await c.env.db.prepare(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_mail_dedup ON ext_mail(ext_id, message_id)
	`).run();
	await c.env.db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_ext_mail_account ON ext_mail(account_id, date DESC)
	`).run();
	await c.env.db.prepare(`
		CREATE TABLE IF NOT EXISTS ext_att (
			att_id INTEGER PRIMARY KEY AUTOINCREMENT,
			mail_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			ext_id INTEGER NOT NULL,
			filename TEXT NOT NULL DEFAULT '',
			mime_type TEXT NOT NULL DEFAULT '',
			size INTEGER NOT NULL DEFAULT 0,
			r2_key TEXT NOT NULL DEFAULT '',
			create_time DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`).run();
	await c.env.db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_ext_att_mail ON ext_att(mail_id)
	`).run();
	schemaReady = true;
}

function cutoff(text, max) {
	const value = typeof text === 'string' ? text : '';
	return value.length > max ? value.slice(0, max) : value;
}

function intOrZero(value) {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function sha16(text) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
	return Array.from(new Uint8Array(buf).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}

function safeName(name) {
	return String(name || 'file')
		.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
		.slice(0, 60) || 'file';
}

function toBytes(b64) {
	const bin = atob(String(b64 || ''));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

/** 归档游标：和邮件一起推进，换机时 /ext/accounts 会把 last_uid 带回去 */
async function advanceCursor(c, userId, extId, uidValidity, uid) {
	const state = await c.env.db.prepare(
		`SELECT uid_validity, last_uid FROM ext_sync_state WHERE ext_id = ? AND user_id = ?`
	).bind(extId, userId).first();

	if (!state) {
		await c.env.db.prepare(`
			INSERT INTO ext_sync_state (ext_id, user_id, uid_validity, last_uid, uid_next, last_sync_at, last_error)
			VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, NULL)
		`).bind(extId, userId, uidValidity, uid).run();
		return;
	}

	// UIDVALIDITY 变了说明邮箱被服务端重建，旧 uid 全部作废，游标从头开始
	const sameValidity = Number(state.uid_validity) === Number(uidValidity);
	const lastUid = sameValidity ? Math.max(Number(state.last_uid) || 0, uid) : uid;
	await c.env.db.prepare(`
		UPDATE ext_sync_state
		SET uid_validity = ?, last_uid = ?, last_sync_at = CURRENT_TIMESTAMP, last_error = NULL
		WHERE ext_id = ?
	`).bind(uidValidity, lastUid, extId).run();
}

/** 拉取侧把「这一轮跑到哪 / 为什么失败」写进来，供下一轮和换机后读取 */
export async function saveSyncError(c, userId, extId, message, uidValidity) {
	await ensureMailSchema(c);
	const err = cutoff(String(message || ''), 300);
	await c.env.db.prepare(`
		INSERT INTO ext_sync_state (ext_id, user_id, uid_validity, last_uid, uid_next, last_sync_at, last_error)
		VALUES (?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
		ON CONFLICT(ext_id) DO UPDATE SET last_error = excluded.last_error, last_sync_at = CURRENT_TIMESTAMP
	`).bind(extId, userId, intOrZero(uidValidity), err).run();
}

export async function archive(c, userId, body = {}) {
	await ensureMailSchema(c);

	const extId = intOrZero(body.extId);
	if (!extId) throw new BizError('缺少第三方邮箱 id', 400);

	const account = await c.env.db.prepare(
		`SELECT ext_id, account_id, provider FROM ext_account
		 WHERE ext_id = ? AND user_id = ? AND is_del = 0`
	).bind(extId, userId).first();
	if (!account) throw new BizError('没有找到这个第三方邮箱', 404);

	const messageId = cutoff(String(body.messageId || '').trim(), 512);
	if (!messageId) throw new BizError('缺少 Message-ID', 400);

	const uid = intOrZero(body.uid);
	const uidValidity = intOrZero(body.uidValidity);
	const date = intOrZero(body.date);
	const seen = body.seen === true ? 1 : 0;

	const message = {
		subject: cutoff(body.subject, 512),
		fromName: cutoff(body.fromName, 200),
		fromAddr: cutoff(body.fromAddr, 320),
		toName: cutoff(body.toName, 200),
		toAddr: cutoff(body.toAddr, 320),
		cc: cutoff(body.cc, 640),
		snippet: cutoff(body.snippet, 200),
		text: cutoff(body.text, MAX_TEXT),
		html: cutoff(body.html, MAX_TEXT),
	};

	const atts = Array.isArray(body.attachments) ? body.attachments.slice(0, MAX_ATT_COUNT) : [];
	let total = 0;
	const payload = [];
	for (const raw of atts) {
		const filename = cutoff(raw?.filename, 200) || '附件';
		const mimeType = cutoff(raw?.mime, 120) || 'application/octet-stream';
		const data = String(raw?.dataB64 || '');
		const size = data.length ? Math.floor(data.length * 3 / 4) : intOrZero(raw?.size);
		const keep = data.length > 0 && size <= MAX_ATT && total + size <= MAX_ATT_TOTAL;
		if (keep) total += size;
		payload.push({ filename, mimeType, size, data: keep ? data : '', stored: keep });
	}

	// 已经归档过（同一账户同一 Message-ID）就直接返回，不重复写库也不重复上传附件
	const existed = await c.env.db.prepare(
		`SELECT mail_id FROM ext_mail WHERE ext_id = ? AND message_id = ?`
	).bind(extId, messageId).first();
	if (existed) {
		await advanceCursor(c, userId, extId, uidValidity, uid);
		return { mailId: Number(existed.mail_id), inserted: false, attachments: 0 };
	}

	const inserted = await c.env.db.prepare(`
		INSERT INTO ext_mail (
			ext_id, user_id, account_id, message_id, uid, uid_validity, subject,
			from_name, from_addr, to_name, to_addr, cc, date, seen, snippet,
			body_text, body_html, att_count
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).bind(
		extId, userId, Number(account.account_id), messageId, uid, uidValidity,
		message.subject, message.fromName, message.fromAddr, message.toName, message.toAddr, message.cc,
		date, seen, message.snippet, message.text, message.html, payload.length,
	).run();

	const mailId = Number(inserted.meta?.last_row_id || 0);
	if (!mailId) throw new BizError('归档写入失败', 500);

	const hash = await sha16(`${extId}:${messageId}`);
	let storedAtts = 0;
	for (let i = 0; i < payload.length; i++) {
		const att = payload[i];
		let key = '';
		if (att.stored) {
			try {
				key = `ext/${userId}/${extId}/${hash}/${i}-${safeName(att.filename)}`;
				await r2Service.putObj(c, key, toBytes(att.data), { contentType: att.mimeType });
				storedAtts++;
			} catch (e) {
				// 附件存失败不影响邮件本身归档，元信息照样保留
				key = '';
			}
		}
		await c.env.db.prepare(`
			INSERT INTO ext_att (mail_id, user_id, ext_id, filename, mime_type, size, r2_key)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`).bind(mailId, userId, extId, att.filename, att.mimeType, att.size, key).run();
	}

	await advanceCursor(c, userId, extId, uidValidity, uid);
	return { mailId, inserted: true, attachments: storedAtts };
}

/**
 * 读回归档（换机补历史用）：新设备本地库为空时，先把服务端已经归档的邮件拉回本地，
 * 不必重新连 IMAP 下载一遍。只读，不改游标；按 date + mail_id 倒序翻页。
 * 附件只返回元信息（r2_key 不外泄），正文随邮件一起返回。
 */
export async function listArchive(c, userId, query = {}) {
	await ensureMailSchema(c);

	const extId = intOrZero(query.extId);
	if (!extId) throw new BizError('缺少第三方邮箱 id', 400);
	const limit = Math.min(Math.max(intOrZero(query.limit) || 50, 1), 200);
	const beforeDate = intOrZero(query.beforeDate);
	const beforeMailId = intOrZero(query.beforeMailId);

	const account = await c.env.db.prepare(
		`SELECT ext_id FROM ext_account WHERE ext_id = ? AND user_id = ? AND is_del = 0`
	).bind(extId, userId).first();
	if (!account) throw new BizError('没有找到这个第三方邮箱', 404);

	const where = ['ext_id = ?', 'user_id = ?'];
	const args = [extId, userId];
	if (beforeDate > 0) {
		where.push('(date < ? OR (date = ? AND mail_id < ?))');
		args.push(beforeDate, beforeDate, beforeMailId);
	}
	const rows = await c.env.db.prepare(`
		SELECT mail_id, uid, uid_validity, message_id, subject, from_name, from_addr,
		       to_name, to_addr, cc, date, seen, snippet, body_text, body_html, att_count
		FROM ext_mail
		WHERE ${where.join(' AND ')}
		ORDER BY date DESC, mail_id DESC
		LIMIT ?
	`).bind(...args, limit + 1).all();

	const list = (rows.results || []).slice(0, limit);
	const hasMore = (rows.results || []).length > limit;

	const ids = list.map(m => Number(m.mail_id));
	const atts = [];
	for (let i = 0; i < ids.length; i += 50) {
		const chunk = ids.slice(i, i + 50);
		const placeholders = chunk.map(() => '?').join(',');
		const got = await c.env.db.prepare(
			`SELECT mail_id, filename, mime_type, size FROM ext_att WHERE mail_id IN (${placeholders})`
		).bind(...chunk).all();
		atts.push(...(got.results || []));
	}
	const byMail = new Map();
	for (const a of atts) {
		const key = Number(a.mail_id);
		if (!byMail.has(key)) byMail.set(key, []);
		byMail.get(key).push({ filename: a.filename, mime: a.mime_type, size: Number(a.size) || 0 });
	}

	return {
		list: list.map(m => ({
			mailId: Number(m.mail_id),
			uid: Number(m.uid) || 0,
			uidValidity: Number(m.uid_validity) || 0,
			messageId: m.message_id,
			subject: m.subject,
			fromName: m.from_name,
			fromAddr: m.from_addr,
			toName: m.to_name,
			toAddr: m.to_addr,
			cc: m.cc,
			date: Number(m.date) || 0,
			seen: Number(m.seen) === 1,
			snippet: m.snippet,
			text: m.body_text,
			html: m.body_html,
			attachments: byMail.get(Number(m.mail_id)) || [],
		})),
		hasMore,
	};
}

/** 解绑时清空该账户的归档与 R2 对象；R2 失败不影响解绑本身 */
export async function dropArchive(c, userId, extId) {
	await ensureMailSchema(c);
	const atts = await c.env.db.prepare(
		`SELECT r2_key FROM ext_att WHERE ext_id = ? AND user_id = ? AND r2_key <> ''`
	).bind(extId, userId).all();
	for (const row of atts.results || []) {
		try {
			await r2Service.delete(c, row.r2_key);
		} catch (e) {
			// 已删除 / 存储降级都忽略，避免解绑被附件卡住
		}
	}
	await c.env.db.prepare(`DELETE FROM ext_att WHERE ext_id = ? AND user_id = ?`).bind(extId, userId).run();
	await c.env.db.prepare(`DELETE FROM ext_mail WHERE ext_id = ? AND user_id = ?`).bind(extId, userId).run();
	await c.env.db.prepare(`DELETE FROM ext_sync_state WHERE ext_id = ? AND user_id = ?`).bind(extId, userId).run();
}

export const __test__ = { MAX_TEXT, MAX_ATT, MAX_ATT_TOTAL, MAX_ATT_COUNT };

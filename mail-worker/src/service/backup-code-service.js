import backupCodeUtils from '../utils/backup-code-utils';
import reqUtils from '../utils/req-utils';
import { v4 as uuidv4 } from 'uuid';

const SQL = {
	list: 'SELECT id, code_hash, used, created_at, used_at FROM backup_code WHERE user_id = ?',
	findUsable: 'SELECT id FROM backup_code WHERE user_id = ? AND code_hash = ? AND used = 0 LIMIT 1',
	consume: 'UPDATE backup_code SET used = 1, used_at = ?, used_ip = ?, used_ua = ? WHERE id = ? AND used = 0',
	removeAll: 'DELETE FROM backup_code WHERE user_id = ?',
	insert: 'INSERT INTO backup_code (user_id, code_hash, batch_id, used, created_at) VALUES (?, ?, ?, 0, ?)'
};

function uaText(c) {
	const ua = reqUtils.getUserAgent(c);
	return [ua.browser, ua.os, ua.device].filter(Boolean).join(' / ');
}

const backupCodeService = {

	// 只用数量与时间展示，任何接口都取不回明文
	async meta(c, userId) {
		const { results } = await c.env.db.prepare(SQL.list).bind(userId).all();
		const rows = results || [];
		let remaining = 0;
		let generatedAt = null;
		let lastUsedAt = null;
		for (const row of rows) {
			if (Number(row.used) === 0) remaining++;
			if (row.created_at && (!generatedAt || row.created_at > generatedAt)) generatedAt = row.created_at;
			if (row.used_at && (!lastUsedAt || row.used_at > lastUsedAt)) lastUsedAt = row.used_at;
		}
		return { total: rows.length, remaining, generatedAt, lastUsedAt };
	},

	// 重新生成 = 整批作废：delete + insert 放在同一个 batch 里，失败不会把用户晾在零备用码状态
	async generate(c, userId) {
		const codes = backupCodeUtils.generate();
		const hashes = await Promise.all(codes.map(code => backupCodeUtils.hash(userId, code)));
		const batchId = uuidv4();
		const createdAt = new Date().toISOString();
		await c.env.db.batch([
			c.env.db.prepare(SQL.removeAll).bind(userId),
			...hashes.map(hash => c.env.db.prepare(SQL.insert).bind(userId, hash, batchId, createdAt))
		]);
		return codes.map(code => backupCodeUtils.format(code));
	},

	// 先算哈希再按 (user_id, code_hash, used=0) 定位，最后用 used=0 作条件更新抢占。
	// 并发下只有一个请求的 changes 为 1，保证一次性。
	async verifyAndConsume(c, userId, code) {
		const normalized = backupCodeUtils.normalize(code);
		if (normalized.length !== backupCodeUtils.LENGTH) return false;

		const hash = await backupCodeUtils.hash(userId, normalized);
		const row = await c.env.db.prepare(SQL.findUsable).bind(userId, hash).first();
		if (!row?.id) return false;

		const result = await c.env.db.prepare(SQL.consume)
			.bind(new Date().toISOString(), reqUtils.getIp(c), uaText(c), row.id)
			.run();
		const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
		return changes > 0;
	},

	async removeAll(c, userId) {
		await c.env.db.prepare(SQL.removeAll).bind(userId).run();
	}
};

export default backupCodeService;

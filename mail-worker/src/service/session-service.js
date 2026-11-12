/**
 * 会话表（D1）。阶段一为镜像双写；阶段二设备列表改为 D1 优先读取，KV 兜底。
 *
 * 写失败只记 warn，不向上抛：D1 异常不能把登录/登出/鉴权打断。
 * 读失败返回 null，调用方整条链路退回 KV，避免 D1 抖动导致所有会话列表报错。
 *
 * 回滚：环境变量 session_read_switch 设为 0 / false，list() 直接返回 null，
 *      读路径与阶段一完全一致（只读 KV，不读 D1、不回填）。
 */
function toText(value) {
	return value === undefined || value === null ? '' : String(value);
}

function readEnabled(c) {
	const value = c.env?.session_read_switch;
	if (value === undefined || value === null || value === '') return true;
	if (value === false || value === 0) return false;
	const text = String(value).toLowerCase();
	return text !== '0' && text !== 'false';
}

/**
 * D1 行转回 KV 会话元数据形状。
 * 设备列表展示的是「最近活跃」，心跳只更新 active_time，所以优先取它。
 */
function rowToMeta(row) {
	return {
		ip: toText(row.ip),
		browser: toText(row.browser),
		os: toText(row.os),
		device: toText(row.device),
		time: toText(row.active_time) || toText(row.time)
	};
}

const sessionService = {

	/**
	 * 登录与心跳共用：
	 * - 首次写入完整设备信息与时间；
	 * - 已存在时只更新 active_time（心跳不该覆盖登录时间/设备信息）。
	 */
	async upsert(c, userId, token, meta) {
		try {
			await c.env.db.prepare(`
				INSERT INTO user_session (user_id, token, ip, browser, os, device, time, active_time)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(user_id, token) DO UPDATE SET active_time = excluded.active_time
			`).bind(
				userId,
				token,
				toText(meta?.ip),
				toText(meta?.browser),
				toText(meta?.os),
				toText(meta?.device),
				toText(meta?.time),
				toText(meta?.time)
			).run();
		} catch (e) {
			console.warn(`user_session 写入失败：${e.message}`);
		}
	},

	async remove(c, userId, token) {
		try {
			await c.env.db.prepare(`DELETE FROM user_session WHERE user_id = ? AND token = ?`)
				.bind(userId, token).run();
		} catch (e) {
			console.warn(`user_session 删除失败：${e.message}`);
		}
	},

	async removeMany(c, userId, tokens) {
		if (!tokens?.length) return;
		try {
			const marks = tokens.map(() => '?').join(',');
			await c.env.db.prepare(`DELETE FROM user_session WHERE user_id = ? AND token IN (${marks})`)
				.bind(userId, ...tokens).run();
		} catch (e) {
			console.warn(`user_session 批量删除失败：${e.message}`);
		}
	},

	/**
	 * 读取某用户全部会话行。
	 * 返回 null 表示「本次不要用 D1」：开关关闭或查询异常，调用方按 KV 原逻辑处理。
	 */
	async list(c, userId) {
		if (!readEnabled(c)) return null;
		try {
			const { results } = await c.env.db.prepare(
				`SELECT token, ip, browser, os, device, time, active_time FROM user_session WHERE user_id = ?`
			).bind(userId).all();
			return Array.isArray(results) ? results : [];
		} catch (e) {
			console.warn(`user_session 读取失败，回退 KV：${e.message}`);
			return null;
		}
	},

	/**
	 * D1 缺行时用 KV 原值补建。ON CONFLICT DO NOTHING：
	 * 并发下同一 token 只落一行，且绝不覆盖已有行（回填只发生一次）。
	 */
	async backfill(c, userId, token, meta) {
		try {
			await c.env.db.prepare(`
				INSERT INTO user_session (user_id, token, ip, browser, os, device, time, active_time)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(user_id, token) DO NOTHING
			`).bind(
				userId,
				token,
				toText(meta?.ip),
				toText(meta?.browser),
				toText(meta?.os),
				toText(meta?.device),
				toText(meta?.time),
				toText(meta?.time)
			).run();
		} catch (e) {
			console.warn(`user_session 回填失败：${e.message}`);
		}
	}

};

export { rowToMeta };
export default sessionService;

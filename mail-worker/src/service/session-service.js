/**
 * 会话表（D1）镜像写入。阶段一只做双写，所有读仍然走 KV。
 *
 * 任何写失败都只记 warn，不向上抛：D1 是镜像，不能因为镜像写失败把登录/登出/鉴权打断。
 * 一致性由部署后的核对脚本检查，差异会显式暴露出来。
 */
function toText(value) {
	return value === undefined || value === null ? '' : String(value);
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
	}

};

export default sessionService;

-- OTSMail 生产 D1 增量迁移：会话表 user_session（会话从 KV 搬 D1，灰度阶段一）
--
-- 背景：会话数据一直只存在 KV 的 auth-uid:<userId> 里（tokens 数组 + sessions 对象）。
-- 阶段一先建表并双写（KV 仍为唯一读源），用一致性核对确认两边逐条一致后，再切读。
--
-- 字段对齐 KV 的 sessions[token] 结构：
--   ip / browser / os / device  —— 登录时的设备信息，KV 只在登录时写一次
--   time                        —— 本行首次落库时的 KV time（登录时间）
--   active_time                 —— 最近活跃时间；KV 的 sessions[token].time 每 5 分钟被心跳覆盖，
--                                  所以心跳双写只更新这一列，不回写 time
--
-- 主键 (user_id, token) 同时承担 userId 维度查询；token 额外唯一，避免跨用户撞号。
-- 该表只做镜像：阶段一所有读仍然走 KV，D1 写失败只记日志，不影响登录/鉴权。

CREATE TABLE IF NOT EXISTS user_session (
	user_id INTEGER NOT NULL,
	token TEXT NOT NULL,
	ip TEXT NOT NULL DEFAULT '',
	browser TEXT NOT NULL DEFAULT '',
	os TEXT NOT NULL DEFAULT '',
	device TEXT NOT NULL DEFAULT '',
	time TEXT NOT NULL DEFAULT '',
	active_time TEXT NOT NULL DEFAULT '',
	PRIMARY KEY (user_id, token)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_session_token ON user_session(token);

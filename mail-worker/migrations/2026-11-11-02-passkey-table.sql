-- OTSMail 生产 D1 增量迁移 02：Passkey 通行密钥表
--
-- 适用场景：任何库（含已初始化过的库）。没有这张表时，
-- /my/passkey/*、/login/passkey/* 以及「关闭密码登录」的熔断校验都会报 no such table: passkey。
--
-- 执行方式（任选其一）：
--   1) wrangler d1 execute <数据库名> --remote --file=./migrations/2026-11-11-02-passkey-table.sql
--   2) 调 GET /api/init/migrate 并带请求头 x-init-secret: <init_secret>
--
-- 本文件全部使用 IF NOT EXISTS，可重复执行。

CREATE TABLE IF NOT EXISTS passkey (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	credential_id TEXT NOT NULL,
	public_key TEXT NOT NULL,
	name TEXT DEFAULT 'Passkey',
	counter INTEGER DEFAULT 0,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_passkey_credential_id ON passkey (credential_id);
CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON passkey (user_id);

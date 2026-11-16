-- 备用码（一次性恢复码）与两步验证审计
-- 备用码只存 SHA-256(user_id:normalized_code)，明文仅在生成时返回一次。
CREATE TABLE IF NOT EXISTS backup_code (
	user_id INTEGER NOT NULL,
	code_hash TEXT NOT NULL,
	batch_id TEXT NOT NULL,
	used INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	used_at TEXT,
	used_ip TEXT,
	used_ua TEXT,
	id INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_backup_code_user_hash ON backup_code(user_id, code_hash);
CREATE INDEX IF NOT EXISTS idx_backup_code_user ON backup_code(user_id, used);

-- 生成 / 使用 / 关闭 / 重新绑定 / 找回重置 全部留痕，便于事后排查滥用
CREATE TABLE IF NOT EXISTS two_factor_audit (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	action TEXT NOT NULL,
	detail TEXT NOT NULL DEFAULT '',
	ip TEXT NOT NULL DEFAULT '',
	ua TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_2fa_audit_user ON two_factor_audit(user_id, id);

-- 重新绑定的暂存密钥：旧验证器仍然有效，直到用户用新密钥确认一次
ALTER TABLE user ADD COLUMN two_factor_pending_secret TEXT NOT NULL DEFAULT '';

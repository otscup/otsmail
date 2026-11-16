-- 多渠道发信：邮件记录实际发送渠道
ALTER TABLE email ADD COLUMN send_provider TEXT NOT NULL DEFAULT '';

-- 渠道配置（JSON：enabled / order / apiKey / secret / 限额 / 用户录入的 DNS 记录）
ALTER TABLE setting ADD COLUMN sender_providers TEXT NOT NULL DEFAULT '{}';

-- 每渠道每周期（YYYY-MM-DD 或 YYYY-MM）用量，UPSERT 原子占额
CREATE TABLE IF NOT EXISTS send_quota (
	provider TEXT NOT NULL,
	period TEXT NOT NULL,
	used INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (provider, period)
);

CREATE INDEX IF NOT EXISTS idx_send_quota_period ON send_quota(period);

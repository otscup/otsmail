-- OTSMail 生产 D1 增量迁移：列表页 / latestEmail 复合索引
--
-- 背景：email 表已有 idx_email_box_page(user_id, is_del, type, spam, category, email_id)
-- 与 idx_email_account_page(user_id, account_id, is_del, type, spam, category, email_id)，
-- 但 category 排在 email_id 之前，无法满足 `ORDER BY email_id DESC`。SQLite 只能
-- `SEARCH ... (user_id=?)` 把该用户全部索引项扫一遍再 USE TEMP B-TREE FOR ORDER BY，
-- 实测列表页读 3,890 行、latestEmail 读 2,641 行（当时 email 表仅 1,433 行）。
--
-- 新增的两条索引把 email_id 直接放到末尾，列表页与 latestEmail 都能走索引倒序取前 N 行。
-- 与 otsmail_4DB 里的 idx_email_list_user / idx_email_list_account 是同一目的：
-- 老库从没跑过 otsmail_4DB，这里用新名字补齐，避免与历史索引名冲突。
--
-- 执行方式（任选其一）：
--   1) wrangler d1 execute otsmail --remote --config wrangler.production.toml --file=./migrations/2026-11-12-02-email-list-indexes.sql
--   2) 调 GET /api/init/migrate 并带请求头 x-init-secret: <init_secret>
--
-- 幂等：CREATE INDEX IF NOT EXISTS，重复执行无副作用。

CREATE INDEX IF NOT EXISTS idx_email_box_latest ON email(user_id, is_del, type, spam, email_id);

CREATE INDEX IF NOT EXISTS idx_email_acct_latest ON email(user_id, account_id, is_del, type, spam, email_id);

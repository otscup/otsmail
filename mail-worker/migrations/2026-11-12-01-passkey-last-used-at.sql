-- OTSMail 生产 D1 增量迁移：Passkey 通行密钥「最后使用时间」
--
-- 只加列，不改动已有数据：历史凭据没记录过使用时间，保持 NULL（列表里显示「从未使用」）。
-- 服务端在 loginVerify 验签成功后回写该列。
--
-- 执行方式（任选其一）：
--   1) wrangler d1 execute <数据库名> --remote --file=./migrations/2026-11-12-01-passkey-last-used-at.sql
--   2) 调 GET /api/init/migrate 并带请求头 x-init-secret: <init_secret>
--
-- SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，本文件只执行一次；
-- 重复执行会报 duplicate column name，可忽略。

ALTER TABLE passkey ADD COLUMN last_used_at TEXT;

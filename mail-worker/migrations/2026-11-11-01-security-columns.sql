-- OTSMail 生产 D1 增量迁移 01：辅助邮箱 / 关闭密码登录 / 找回密码配置
--
-- 适用场景：已经初始化过（KV init_done = '1'）的库。/api/init 有 init_done 门禁，
-- 不会再执行建表逻辑，必须单独补这 6 列，否则 drizzle 查询会报 no such column。
--
-- 执行方式（任选其一）：
--   1) wrangler d1 execute <数据库名> --remote --file=./migrations/2026-11-11-01-security-columns.sql
--   2) 调 GET /api/init/migrate 并带请求头 x-init-secret: <init_secret>
--      （Worker 侧用 PRAGMA table_info 判断，已存在的列会自动跳过，可重复执行）
--
-- 注意：SQLite 不支持 ADD COLUMN IF NOT EXISTS，本文件按一次性脚本编写；
-- 若某列已存在，该条会报 duplicate column name，跳过即可，不影响其余语句。

ALTER TABLE user ADD COLUMN recovery_email TEXT NOT NULL DEFAULT '';
ALTER TABLE user ADD COLUMN disable_password_login INTEGER NOT NULL DEFAULT 0;

ALTER TABLE setting ADD COLUMN password_reset_switch INTEGER NOT NULL DEFAULT 1;
ALTER TABLE setting ADD COLUMN system_sender_email TEXT NOT NULL DEFAULT '';
ALTER TABLE setting ADD COLUMN password_reset_ip_limit INTEGER NOT NULL DEFAULT 3;
ALTER TABLE setting ADD COLUMN password_reset_user_limit INTEGER NOT NULL DEFAULT 3;

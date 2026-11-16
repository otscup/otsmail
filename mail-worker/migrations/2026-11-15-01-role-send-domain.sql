-- 权限身份：用户组可用的发送域名（逗号分隔，留空不额外限制）
ALTER TABLE role ADD COLUMN send_domain TEXT DEFAULT '';

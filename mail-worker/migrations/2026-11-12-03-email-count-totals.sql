-- OTSMail 生产 D1 增量迁移：email_count 增加四个「总数」列
--
-- 背景：/email/counts 每次都对 email 全表跑 SUM(CASE ...) 算收件箱/已发送/已删除/垃圾
-- 四个总数（实测 1,351 行/次），列表页 total 也走 COUNT(*)。这里把四个总数固化进
-- email_count，由已有的 email_count_ai / au / ad 三个触发器增量维护，读接口只取一行。
--
-- 列口径与列表页 where 严格一致：
--   inbox_total   is_del=0 AND type=0 AND spam=0
--   sent_total    is_del=0 AND spam=0 AND type=1
--   deleted_total is_del=1
--   spam_total    is_del=0 AND type=0 AND spam=1
--
-- 旧列（inbox / sent / deleted / spam）含义不变：inbox 与 spam 只记未读，
-- 分类列 primary_c ... ads 同样只记未读，前端分类角标继续用它们。
--
-- 执行顺序（生产）：加列 → 重建触发器 → 绝对回填 → 校验 → 部署读取计数表的 Worker。
-- 回填是 UPDATE ... = 子查询（覆盖写），即使触发器已经计入也不会双算。
--
-- 注意：SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，本文件只执行一次；
-- /init/migrate 走 src/init/init.js 的 otsmail_36DB，用 PRAGMA table_info 判断列是否存在，
-- 可重复执行（新库由 init() 落到同一个方法，两条路语义一致）。

ALTER TABLE email_count ADD COLUMN inbox_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_count ADD COLUMN sent_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_count ADD COLUMN deleted_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_count ADD COLUMN spam_total INTEGER NOT NULL DEFAULT 0;

-- 重建三个触发器：旧 10 列逻辑原样保留，额外维护四个总数列
DROP TRIGGER IF EXISTS email_count_ai;
DROP TRIGGER IF EXISTS email_count_au;
DROP TRIGGER IF EXISTS email_count_ad;

CREATE TRIGGER email_count_ai AFTER INSERT ON email BEGIN
	INSERT INTO email_count (user_id,account_id,inbox,sent,deleted,spam,primary_c,social,promotion,updates,important,ads,inbox_total,sent_total,deleted_total,spam_total)
	VALUES (NEW.user_id,NEW.account_id,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.unread=0 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.spam=0 AND NEW.type=1 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=1 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=1 AND NEW.unread=0 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='primary' THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='social' THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='promotion' THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='updates' THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='important' THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='ads' THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.spam=0 AND NEW.type=1 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=1 THEN 1 ELSE 0 END,
		CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=1 THEN 1 ELSE 0 END)
	ON CONFLICT(user_id,account_id) DO UPDATE SET
		inbox=email_count.inbox+excluded.inbox, sent=email_count.sent+excluded.sent, deleted=email_count.deleted+excluded.deleted,
		spam=email_count.spam+excluded.spam, primary_c=email_count.primary_c+excluded.primary_c, social=email_count.social+excluded.social,
		promotion=email_count.promotion+excluded.promotion, updates=email_count.updates+excluded.updates, important=email_count.important+excluded.important, ads=email_count.ads+excluded.ads,
		inbox_total=email_count.inbox_total+excluded.inbox_total, sent_total=email_count.sent_total+excluded.sent_total,
		deleted_total=email_count.deleted_total+excluded.deleted_total, spam_total=email_count.spam_total+excluded.spam_total;
END;

CREATE TRIGGER email_count_au AFTER UPDATE ON email BEGIN
	UPDATE email_count SET
		inbox=MAX(0, inbox - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.unread=0 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.unread=0 THEN 1 ELSE 0 END)),
		sent=MAX(0, sent - (CASE WHEN OLD.is_del=0 AND OLD.spam=0 AND OLD.type=1 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.spam=0 AND NEW.type=1 THEN 1 ELSE 0 END)),
		deleted=MAX(0, deleted - (CASE WHEN OLD.is_del=1 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=1 THEN 1 ELSE 0 END)),
		spam=MAX(0, spam - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=1 AND OLD.unread=0 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=1 AND NEW.unread=0 THEN 1 ELSE 0 END)),
		primary_c=MAX(0, primary_c - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='primary' THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='primary' THEN 1 ELSE 0 END)),
		social=MAX(0, social - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='social' THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='social' THEN 1 ELSE 0 END)),
		promotion=MAX(0, promotion - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='promotion' THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='promotion' THEN 1 ELSE 0 END)),
		updates=MAX(0, updates - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='updates' THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='updates' THEN 1 ELSE 0 END)),
		important=MAX(0, important - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='important' THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='important' THEN 1 ELSE 0 END)),
		ads=MAX(0, ads - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='ads' THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 AND NEW.unread=0 AND NEW.category='ads' THEN 1 ELSE 0 END)),
		inbox_total=MAX(0, inbox_total - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=0 THEN 1 ELSE 0 END)),
		sent_total=MAX(0, sent_total - (CASE WHEN OLD.is_del=0 AND OLD.spam=0 AND OLD.type=1 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.spam=0 AND NEW.type=1 THEN 1 ELSE 0 END)),
		deleted_total=MAX(0, deleted_total - (CASE WHEN OLD.is_del=1 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=1 THEN 1 ELSE 0 END)),
		spam_total=MAX(0, spam_total - (CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=1 THEN 1 ELSE 0 END) + (CASE WHEN NEW.is_del=0 AND NEW.type=0 AND NEW.spam=1 THEN 1 ELSE 0 END))
	WHERE user_id=OLD.user_id AND account_id=OLD.account_id;
END;

CREATE TRIGGER email_count_ad AFTER DELETE ON email BEGIN
	UPDATE email_count SET
		inbox=MAX(0,inbox-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.unread=0 THEN 1 ELSE 0 END)),
		sent=MAX(0,sent-(CASE WHEN OLD.is_del=0 AND OLD.spam=0 AND OLD.type=1 THEN 1 ELSE 0 END)),
		deleted=MAX(0,deleted-(CASE WHEN OLD.is_del=1 THEN 1 ELSE 0 END)),
		spam=MAX(0,spam-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=1 AND OLD.unread=0 THEN 1 ELSE 0 END)),
		primary_c=MAX(0,primary_c-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='primary' THEN 1 ELSE 0 END)),
		social=MAX(0,social-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='social' THEN 1 ELSE 0 END)),
		promotion=MAX(0,promotion-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='promotion' THEN 1 ELSE 0 END)),
		updates=MAX(0,updates-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='updates' THEN 1 ELSE 0 END)),
		important=MAX(0,important-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='important' THEN 1 ELSE 0 END)),
		ads=MAX(0,ads-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 AND OLD.unread=0 AND OLD.category='ads' THEN 1 ELSE 0 END)),
		inbox_total=MAX(0,inbox_total-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=0 THEN 1 ELSE 0 END)),
		sent_total=MAX(0,sent_total-(CASE WHEN OLD.is_del=0 AND OLD.spam=0 AND OLD.type=1 THEN 1 ELSE 0 END)),
		deleted_total=MAX(0,deleted_total-(CASE WHEN OLD.is_del=1 THEN 1 ELSE 0 END)),
		spam_total=MAX(0,spam_total-(CASE WHEN OLD.is_del=0 AND OLD.type=0 AND OLD.spam=1 THEN 1 ELSE 0 END))
	WHERE user_id=OLD.user_id AND account_id=OLD.account_id;
END;

-- 绝对回填：按当前 email 数据重算四个总数（覆盖写，幂等）
UPDATE email_count SET
	inbox_total=(SELECT COUNT(*) FROM email e WHERE e.user_id=email_count.user_id AND e.account_id=email_count.account_id AND e.is_del=0 AND e.type=0 AND e.spam=0),
	sent_total=(SELECT COUNT(*) FROM email e WHERE e.user_id=email_count.user_id AND e.account_id=email_count.account_id AND e.is_del=0 AND e.spam=0 AND e.type=1),
	deleted_total=(SELECT COUNT(*) FROM email e WHERE e.user_id=email_count.user_id AND e.account_id=email_count.account_id AND e.is_del=1),
	spam_total=(SELECT COUNT(*) FROM email e WHERE e.user_id=email_count.user_id AND e.account_id=email_count.account_id AND e.is_del=0 AND e.type=0 AND e.spam=1);

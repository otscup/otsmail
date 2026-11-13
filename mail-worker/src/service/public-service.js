import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { v4 as uuidv4 } from 'uuid';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import emailUtils from '../utils/email-utils';
import roleService from './role-service';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n';
import reqUtils from '../utils/req-utils';
import dayjs from 'dayjs';
import { isDel, roleConst } from '../const/entity-const';
import email from '../entity/email';
import userService from './user-service';
import KvConst from '../const/kv-const';
import totpUtils from '../utils/totp-utils';
import loginGuard from './login-guard';

// LIKE 里 % 和 _ 是通配符：公共 token 接口必须转义，否则过滤值传 "%" 就能分页导出全库
function escapeLike(value) {
	return String(value).replace(/[\\%_]/g, match => '\\' + match);
}

const publicService = {

	async emailList(c, params) {
		let { toEmail, content, subject, sendName, sendEmail, timeSort, num, size, type , isDel } = params

		// 公共 token 不能变成全库导出接口：必须带过滤条件，分页最多 100 条。
		const hasFilter = [toEmail, content, subject, sendName, sendEmail].some(v => String(v || '').trim());
		if (!hasFilter) throw new BizError(t('publicFilterRequired'));
		size = Math.min(Number(size) || 20, 100);

		const query = orm(c).select({
				emailId: email.emailId,
				sendEmail: email.sendEmail,
				sendName: email.name,
				subject: email.subject,
				toEmail: email.toEmail,
				toName: email.toName,
				type: email.type,
				createTime: email.createTime,
				content: email.content,
				text: email.text,
				isDel: email.isDel,
		}).from(email)

		if (!size) {
			size = 20
		}

		if (!num) {
			num = 1
		}

		size = Number(size);
		num = Number(num);

		num = (num - 1) * size;

		let conditions = []

		if (toEmail) {
			conditions.push(sql`${email.toEmail} COLLATE NOCASE LIKE ${escapeLike(toEmail)} ESCAPE '\\'`)
		}

		if (sendEmail) {
			conditions.push(sql`${email.sendEmail} COLLATE NOCASE LIKE ${escapeLike(sendEmail)} ESCAPE '\\'`)
		}

		if (sendName) {
			conditions.push(sql`${email.name} COLLATE NOCASE LIKE ${escapeLike(sendName)} ESCAPE '\\'`)
		}

		if (subject) {
			conditions.push(sql`${email.subject} COLLATE NOCASE LIKE ${escapeLike(subject)} ESCAPE '\\'`)
		}

		if (content) {
			conditions.push(sql`${email.content} COLLATE NOCASE LIKE ${escapeLike(content)} ESCAPE '\\'`)
		}

		if (type || type === 0) {
			conditions.push(eq(email.type, type))
		}

		if (isDel || isDel === 0) {
			conditions.push(eq(email.isDel, isDel))
		}

		if (conditions.length === 1) {
			query.where(...conditions)
		} else if (conditions.length > 1) {
			query.where(and(...conditions))
		}

		if (timeSort === 'asc') {
			query.orderBy(asc(email.emailId));
		} else {
			query.orderBy(desc(email.emailId));
		}

		return query.limit(size).offset(num);

	},

	async addUser(c, params) {
		const { list } = params;

		if (!Array.isArray(list) || list.length === 0) return;
		// 公共接口每请求都要逐条 bcrypt，必须限制单次数量，避免一次请求打满 CPU。
		if (list.length > 50) {
			throw new BizError('单次批量创建账号不能超过 50 个', 400);
		}

		for (const emailRow of list) {
			if (!verifyUtils.isEmail(emailRow.email)) {
				throw new BizError(t('notEmail'));
			}

			if (!c.env.domain.includes(emailUtils.getDomain(emailRow.email))) {
				throw new BizError(t('notEmailDomain'));
			}

			const { salt, hash } = await saltHashUtils.hashPassword(
				emailRow.password || cryptoUtils.genRandomPwd(),
				c
			);

			emailRow.salt = salt;
			emailRow.hash = hash;
		}


		const activeIp = reqUtils.getIp(c);
		const { os, browser, device } = reqUtils.getUserAgent(c);
		const activeTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

		const roleList = await roleService.roleSelectUse(c);
		const defRole = roleList.find(roleRow => roleRow.isDefault === roleConst.isDefault.OPEN);
		if (!defRole) throw new BizError(t('roleNotExist'));

		const userList = [];

		for (const emailRow of list) {
			let { email, hash, salt } = emailRow;
			// 公共 token 只能建默认角色，禁止通过 roleName 提权。
			const type = defRole.roleId;

			// 参数化绑定：os / browser / device 来自 User-Agent 头，activeIp 来自请求头，
			// email 来自请求体，全部是调用方可控的。D1 的 prepare() 直接编译传入的 SQL
			// 字符串、不做任何转义，字符串拼接会被单引号闭合逃逸（CWE-89）。
			const userSql = `INSERT INTO user (email, password, salt, type, os, browser, active_ip, create_ip, device, active_time, create_time)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

			const accountSql = `INSERT INTO account (email, name, user_id)
			VALUES (?, ?, 0);`;

			userList.push(c.env.db.prepare(userSql).bind(
				email, hash, salt, type, os, browser, activeIp, activeIp, device, activeTime, activeTime
			));
			userList.push(c.env.db.prepare(accountSql).bind(
				email, emailUtils.getName(email)
			));

		}

		userList.push(c.env.db.prepare(`UPDATE account SET user_id = (SELECT user_id FROM user WHERE user.email = account.email) WHERE user_id = 0;`))

		try {
			await c.env.db.batch(userList);
		} catch (e) {
			if(e.message.includes('SQLITE_CONSTRAINT')) {
				throw new BizError(t('emailExistDatabase'))
			} else {
				throw e
			}
		}

	},

	async genToken(c, params) {

		await this.verifyUser(c, params)

		const uuid = uuidv4();

		// Public token 也必须过期，避免一次泄露永久可导出全站邮件。
		await c.env.kv.put(KvConst.PUBLIC_KEY, uuid, { expirationTtl: 30 * 24 * 60 * 60 });

		return {token: uuid}
	},

	async verifyUser(c, params) {

		const { email, password, twoFactorCode } = params

		if (await loginGuard.lockRemaining(c, email) > 0) {
			throw new BizError(t('loginLocked'), 429);
		}

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (email !== c.env.admin) {
			throw new BizError(t('notAdmin'));
		}

		if (!userRow || userRow.isDel === isDel.DELETE) {
			throw new BizError(t('notExistUser'));
		}

		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password)) {
			if (await loginGuard.recordFailure(c, email)) {
				throw new BizError(t('loginLocked'), 429);
			}
			throw new BizError(t('IncorrectPwd'));
		}

		if (userRow.twoFactorSwitch === 1 || userRow.twoFactorRequired === 1) {
			if (!twoFactorCode) throw new BizError(t('needTwoFactorCode'), 428);
			if (!await totpUtils.verify(userRow.twoFactorSecret, twoFactorCode)) {
				if (await loginGuard.recordFailure(c, email)) {
					throw new BizError(t('loginLocked'), 429);
				}
				throw new BizError(t('twoFactorCodeInvalid'), 428);
			}
		}

		await loginGuard.clear(c, email);
	}

}

export default publicService

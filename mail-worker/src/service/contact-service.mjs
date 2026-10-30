import orm from '../entity/orm';
import { contact } from '../entity/contact';
import BizError from '../error/biz-error';
import { and, asc, eq, like, ne, or } from 'drizzle-orm';
import { isDel } from '../const/entity-const';
import { t } from '../i18n/i18n';

const DEFAULT_GROUP = '默认';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 出入参都在这里归一化：同 userId 下 email 唯一（小写比对），空分组回落默认分组
function normalize(params) {
	return {
		name: (params.name || '').trim(),
		email: (params.email || '').trim().toLowerCase(),
		groupName: (params.groupName || '').trim() || DEFAULT_GROUP,
		remark: (params.remark || '').trim(),
	};
}

function checkEmail(email) {
	if (!EMAIL_RE.test(email)) {
		throw new BizError(t('contactInvalidEmail'));
	}
}

const contactService = {

	async selectById(c, contactId, userId) {
		return await orm(c).select().from(contact).where(
			and(
				eq(contact.contactId, Number(contactId) || 0),
				eq(contact.userId, userId),
				eq(contact.isDel, isDel.NORMAL)))
			.get();
	},

	async list(c, params, userId) {
		const q = (params.q || '').trim();
		const group = (params.group || '').trim();
		const list = await orm(c).select().from(contact).where(
			and(
				eq(contact.userId, userId),
				eq(contact.isDel, isDel.NORMAL),
				q ? or(like(contact.name, `%${q}%`), like(contact.email, `%${q}%`)) : undefined,
				group ? eq(contact.groupName, group) : undefined))
			.orderBy(asc(contact.name), asc(contact.contactId))
			.all();

		// 分组下拉永远基于全量（不受当前分组筛选影响），去重排序
		const groups = await orm(c).select({ groupName: contact.groupName }).from(contact).where(
			and(
				eq(contact.userId, userId),
				eq(contact.isDel, isDel.NORMAL)))
			.groupBy(contact.groupName)
			.orderBy(asc(contact.groupName))
			.all();

		return { list, groups: groups.map(row => row.groupName) };
	},

	async add(c, params, userId) {
		const data = normalize(params);
		checkEmail(data.email);

		// 同一 userId 下 email 重复：更新已有记录（含回收站里的），不再堆一条新的
		const exist = await orm(c).select({ contactId: contact.contactId }).from(contact).where(
			and(
				eq(contact.userId, userId),
				eq(contact.email, data.email)))
			.get();

		if (exist) {
			await orm(c).update(contact).set({ ...data, isDel: isDel.NORMAL }).where(eq(contact.contactId, exist.contactId)).run();
			return;
		}

		await orm(c).insert(contact).values({ userId, ...data }).run();
	},

	async set(c, params, userId) {
		const exist = await this.selectById(c, params.contactId, userId);
		if (!exist) {
			throw new BizError(t('contactNotExist'));
		}

		const data = normalize(params);
		checkEmail(data.email);

		const dup = await orm(c).select({ contactId: contact.contactId }).from(contact).where(
			and(
				eq(contact.userId, userId),
				eq(contact.email, data.email),
				ne(contact.contactId, exist.contactId)))
			.get();

		if (dup) {
			throw new BizError(t('contactEmailExist'));
		}

		await orm(c).update(contact).set(data).where(eq(contact.contactId, exist.contactId)).run();
	},

	async delete(c, params, userId) {
		const exist = await this.selectById(c, params.contactId, userId);
		if (!exist) {
			throw new BizError(t('contactNotExist'));
		}

		await orm(c).update(contact).set({ isDel: isDel.DELETE }).where(eq(contact.contactId, exist.contactId)).run();
	}
};

export default contactService;

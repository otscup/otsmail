import role from '../entity/role';
import orm from '../entity/orm';
import { eq, asc, inArray, and } from 'drizzle-orm';
import BizError from '../error/biz-error';
import rolePerm from '../entity/role-perm';
import perm from '../entity/perm';
import { permConst, roleConst } from '../const/entity-const';
import userService from './user-service';
import user from '../entity/user';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n.js';
import emailUtils from '../utils/email-utils';

const roleService = {

	// 超级管理员判定：D1 里 type=0，或邮箱命中 env.admin（type=0 从不写库，只能靠邮箱兜底）
	async isAdmin(c, userId) {
		const caller = await userService.selectById(c, userId);
		return !!caller && (Number(caller.type) === 0 || caller.email === c.env.admin);
	},

	// permIds 必须存在且是 BUTTON 权限，避免把任意 id 塞进 role_perm
	async validPermIds(c, permIds) {
		const ids = [...new Set((Array.isArray(permIds) ? permIds : []).map(Number).filter(Number.isInteger))];
		if (!ids.length) return [];
		const rows = await orm(c).select({ permId: perm.permId }).from(perm)
			.where(and(inArray(perm.permId, ids), eq(perm.type, permConst.type.BUTTON))).all();
		if (rows.length !== ids.length) {
			throw new BizError(t('notAllowed'));
		}
		return ids;
	},

	async add(c, params, userId) {

		let { name, permIds, banEmail, availDomain } = params;

		if (!name) {
			throw new BizError(t('emptyRoleName'));
		}

		banEmail = Array.isArray(banEmail) ? banEmail : [];
		availDomain = Array.isArray(availDomain) ? availDomain : [];

		let roleRow = await orm(c).select().from(role).where(eq(role.name, name)).get();

		const notEmailIndex = banEmail.findIndex(item => (!verifyUtils.isEmail(item) && !verifyUtils.isDomain(item)) && item !== "*");

		if (notEmailIndex > -1) {
			throw new BizError(t('notEmail'));
		}

		banEmail = banEmail.join(',');

		availDomain = availDomain.join(',');

		permIds = await this.validPermIds(c, permIds);

		// 只接受白名单字段，isDefault 一律为 0：默认角色只能通过 setDefault 指定。
		roleRow = await orm(c).insert(role).values({
			name,
			key: params.key,
			description: params.description,
			banEmailType: params.banEmailType,
			sort: params.sort,
			sendType: params.sendType,
			sendCount: params.sendCount,
			accountCount: params.accountCount,
			banEmail,
			availDomain,
			isDefault: 0,
			userId
		}).returning().get();

		if (permIds.length === 0) {
			return;
		}

		const rolePermList = permIds.map(permId => ({ permId, roleId: roleRow.roleId }));

		await orm(c).insert(rolePerm).values(rolePermList).run();


	},

	async roleList(c) {

		const roleList = await orm(c).select().from(role).orderBy(asc(role.sort)).all();
		const permList = await orm(c).select({ permId: perm.permId, roleId: rolePerm.roleId }).from(rolePerm)
			.leftJoin(perm, eq(perm.permId, rolePerm.permId))
			.where(eq(perm.type, permConst.type.BUTTON)).all();

		roleList.forEach(role => {
			role.banEmail = role.banEmail.split(",").filter(item => item !== "");
			role.availDomain = role.availDomain.split(",").filter(item => item !== "");
			role.permIds = permList.filter(perm => perm.roleId === role.roleId).map(perm => perm.permId);
		});

		return roleList;
	},

	async setRole(c, params, callerUserId) {

		let { name, permIds, roleId, banEmail, availDomain } = params;

		if (!name) {
			throw new BizError(t('emptyRoleName'));
		}

		const roleRow = await orm(c).select().from(role).where(eq(role.roleId, roleId)).get();
		if (!roleRow) {
			throw new BizError(t('roleNotExist'));
		}

		// 非超级管理员不能改默认角色，也不能改自己所属的角色（否则可自我加权限）。
		if (!await this.isAdmin(c, callerUserId)) {
			const caller = await userService.selectById(c, callerUserId);
			if (Number(roleRow.roleId) === Number(caller?.type) || Number(roleRow.isDefault) === 1) {
				throw new BizError(t('notAllowed'));
			}
		}

		banEmail = Array.isArray(banEmail) ? banEmail : [];
		availDomain = Array.isArray(availDomain) ? availDomain : [];

		const notEmailIndex = banEmail.findIndex(item => (!verifyUtils.isEmail(item) && !verifyUtils.isDomain(item)) && item !== "*")

		if (notEmailIndex > -1) {
			throw new BizError(t('notEmail'));
		}

		banEmail = banEmail.join(',')

		availDomain = availDomain.join(',')

		permIds = await this.validPermIds(c, permIds);

		await orm(c).update(role).set({
			name,
			description: params.description,
			banEmailType: params.banEmailType,
			sort: params.sort,
			sendType: params.sendType,
			sendCount: params.sendCount,
			accountCount: params.accountCount,
			banEmail,
			availDomain
		}).where(eq(role.roleId, roleId)).run();
		await orm(c).delete(rolePerm).where(eq(rolePerm.roleId, roleId)).run();

		if (permIds.length > 0) {
			const rolePermList = permIds.map(permId => ({ permId, roleId: roleId }));
			await orm(c).insert(rolePerm).values(rolePermList).run();
		}

	},

	async delete(c, params) {

		const { roleId } = params;

		const roleRow = await orm(c).select().from(role).where(eq(role.roleId, roleId)).get();

		if (!roleRow) {
			throw new BizError(t('notExist'));
		}

		if (roleRow.isDefault) {
			throw new BizError(t('delDefRole'));
		}

		const defRoleRow = await orm(c).select().from(role).where(eq(role.isDefault, roleConst.isDefault.OPEN)).get();

		await userService.updateAllUserType(c, defRoleRow.roleId, roleId);

		await orm(c).delete(rolePerm).where(eq(rolePerm.roleId, roleId)).run();
		await orm(c).delete(role).where(eq(role.roleId, roleId)).run();

	},

	roleSelectUse(c) {
		return orm(c).select({ name: role.name, roleId: role.roleId, isDefault: role.isDefault }).from(role).orderBy(asc(role.sort)).all();
	},

	async selectDefaultRole(c) {
		return await orm(c).select().from(role).where(eq(role.isDefault, roleConst.isDefault.OPEN)).get();
	},

	async setDefault(c, params, callerUserId) {
		// 默认角色决定新用户的初始权限，只允许超级管理员切换。
		if (!await this.isAdmin(c, callerUserId)) {
			throw new BizError(t('notAllowed'));
		}
		const roleRow = await orm(c).select().from(role).where(eq(role.roleId, params.roleId)).get();
		if (!roleRow) {
			throw new BizError(t('roleNotExist'));
		}
		await orm(c).update(role).set({ isDefault: 0 }).run();
		await orm(c).update(role).set({ isDefault: 1 }).where(eq(role.roleId, params.roleId)).run();
	},

	selectById(c, roleId) {
		return orm(c).select().from(role).where(eq(role.roleId, roleId)).get();
	},

	selectByIdsHasPermKey(c, types, permKey) {
		return orm(c).select({ roleId: role.roleId, sendType: role.sendType, sendCount: role.sendCount }).from(perm)
			.leftJoin(rolePerm, eq(perm.permId, rolePerm.permId))
			.leftJoin(role, eq(role.roleId, rolePerm.roleId))
			.where(and(eq(perm.permKey, permKey), inArray(role.roleId, types))).all();
	},

	selectByIdsAndSendType(c, permKey, sendType) {
		return orm(c).select({ roleId: role.roleId }).from(perm)
			.leftJoin(rolePerm, eq(perm.permId, rolePerm.permId))
			.leftJoin(role, eq(role.roleId, rolePerm.roleId))
			.where(and(eq(perm.permKey, permKey), eq(role.sendType, sendType))).all();
	},

	selectByUserId(c, userId) {
		return orm(c).select(role).from(user).leftJoin(role, eq(role.roleId, user.type)).where(eq(user.userId, userId)).get();
	},

	hasAvailDomainPerm(availDomain, email) {

		availDomain = String(availDomain || '').split(',').filter(item => item !== '');

		if (availDomain.length === 0) {
			return true
		}

		const availIndex = availDomain.findIndex(item => {
			const domain = emailUtils.getDomain(email.toLowerCase());
			const availDomainItem = item.toLowerCase();
			return domain === availDomainItem
		})

		return availIndex > -1
	},

	selectByName(c, roleName) {
		return orm(c).select().from(role).where(eq(role.name, roleName)).get();
	},

	selectByUserIds(c, userIds) {

		if (!userIds || userIds.length === 0) {
			return [];
		}

		return orm(c).select({ ...role, userId: user.userId }).from(user).leftJoin(role, eq(role.roleId, user.type)).where(inArray(user.userId, userIds)).all();

	},

	isBanEmail(banEmail, fromEmail) {

		banEmail = banEmail.split(',').filter(item => item !== '');

		if (banEmail.includes('*')) {
			return true;
		}

		for (const item of banEmail) {

			if (verifyUtils.isDomain(item)) {

				const banDomain = item.toLowerCase();
				const receiveDomain = emailUtils.getDomain(fromEmail.toLowerCase());

				if (banDomain === receiveDomain) {
					return true;
				}

			} else {

				if (item.toLowerCase() === fromEmail.toLowerCase()) {

					return true;

				}

			}

		}

		return false;
	}
};

export default roleService;

import orm from '../entity/orm';
import perm from '../entity/perm';
import { eq, ne, and, asc } from 'drizzle-orm';
import rolePerm from '../entity/role-perm';
import user from '../entity/user';
import role from '../entity/role';
import userPerm from '../entity/user-perm';
import { permConst } from '../const/entity-const';
import { t } from '../i18n/i18n'

const permService = {
	async tree(c) {
		const pList = await orm(c).select().from(perm).where(eq(perm.pid, 0)).orderBy(asc(perm.sort)).all();
		const cList = await orm(c).select().from(perm).where(ne(perm.pid, 0)).orderBy(asc(perm.sort)).all();

		cList.forEach(cItem => {
			cItem.name = t('perms.' + cItem.name)
		})

		pList.forEach(pItem => {
			pItem.name = t('perms.' + pItem.name)
			pItem.children = cList.filter(cItem => cItem.pid === pItem.permId)
		})
		return pList;
	},

	async userPermKeys(c, userId) {
		const [roleKeys, overrides] = await Promise.all([
			orm(c).select({ permKey: perm.permKey }).from(user)
				.leftJoin(role, eq(role.roleId, user.type))
				.rightJoin(rolePerm, eq(rolePerm.roleId, role.roleId))
				.leftJoin(perm, eq(rolePerm.permId, perm.permId))
				.where(and(eq(user.userId, userId), eq(perm.type, permConst.type.BUTTON)))
				.all(),
			orm(c).select({ permKey: perm.permKey, allow: userPerm.allow }).from(userPerm)
				.leftJoin(perm, eq(perm.permId, userPerm.permId))
				.where(eq(userPerm.userId, userId)).all()
		]);
		const keys = new Set(roleKeys.map(item => item.permKey).filter(Boolean));
		for (const item of overrides) {
			if (!item.permKey) continue;
			if (item.allow) keys.add(item.permKey); else keys.delete(item.permKey);
		}
		return [...keys];
	}
}

export default permService

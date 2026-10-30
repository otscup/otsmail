import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';

export const userPerm = sqliteTable('user_perm', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	permId: integer('perm_id').notNull(),
	allow: integer('allow').notNull().default(1)
});

export default userPerm;

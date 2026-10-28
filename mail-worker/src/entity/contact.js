import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const contact = sqliteTable('contact', {
	contactId: integer('contact_id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	name: text('name').notNull().default(''),
	email: text('email').notNull(),
	groupName: text('group_name').notNull().default('默认'),
	remark: text('remark').notNull().default(''),
	createTime: text('create_time')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	isDel: integer('is_del').notNull().default(0),
});

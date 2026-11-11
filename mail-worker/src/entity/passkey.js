import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const passkey = sqliteTable('passkey', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	credentialId: text('credential_id').notNull().unique(),
	publicKey: text('public_key').notNull(),
	name: text('name').default('Passkey'),
	counter: integer('counter').default(0),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	// 登录验签成功时回写；历史凭据为 NULL，表示从未使用过
	lastUsedAt: text('last_used_at')
});

export default passkey;

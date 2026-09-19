import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const oauth = sqliteTable('oauth', {
	oauthId: integer('oauth_id').primaryKey({ autoIncrement: true }),
	oauthUserId: text('oauth_user_id'),
	// v1.4：第三方平台标识（'github' | 'google' | 'linuxdo'），防跨平台 oauthUserId 撞号
	provider: text('provider'),
	username: text('username'),
	name: text('name'),
	avatar: text('avatar'),
	active: integer('active'),
	trustLevel: integer('trust_level'),
	silenced: integer('silenced'),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	userId: integer('user_id').default(0).notNull()
});

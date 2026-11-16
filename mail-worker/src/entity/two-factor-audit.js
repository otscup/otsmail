import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 两步验证审计：生成/使用/关闭/重新绑定/找回重置
export const twoFactorAudit = sqliteTable('two_factor_audit', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	action: text('action').notNull(),
	detail: text('detail').default('').notNull(),
	ip: text('ip').default('').notNull(),
	ua: text('ua').default('').notNull(),
	createdAt: text('created_at').notNull()
});

export default twoFactorAudit;

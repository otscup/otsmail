import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 备用码：明文不落库，只有 SHA-256(userId:code)
export const backupCode = sqliteTable('backup_code', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	codeHash: text('code_hash').notNull(),
	batchId: text('batch_id').notNull(),
	used: integer('used').default(0).notNull(),
	createdAt: text('created_at').notNull(),
	usedAt: text('used_at'),
	usedIp: text('used_ip'),
	usedUa: text('used_ua')
});

export default backupCode;

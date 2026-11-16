import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// 发信渠道用量：period 为 YYYY-MM-DD（日额度）或 YYYY-MM（月额度）
export const sendQuota = sqliteTable('send_quota', {
	provider: text('provider').notNull(),
	period: text('period').notNull(),
	used: integer('used').notNull().default(0),
	updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
}, table => ({
	pk: primaryKey({ columns: [table.provider, table.period] })
}));

export default sendQuota;

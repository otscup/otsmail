import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// MCP OAuth 客户端（client_credentials）：secret 只存 sha256 摘要
const mcpClient = sqliteTable('mcp_client', {
	clientId: text('client_id').primaryKey(),
	clientSecretHash: text('client_secret_hash').notNull(),
	name: text('name').notNull(),
	// 该客户端签发的令牌归属于创建者，决定能访问谁的邮箱
	userId: integer('user_id').default(0).notNull(),
	createdAt: text('create_time').default(sql`CURRENT_TIMESTAMP`),
	revoked: integer('revoked').default(0).notNull()
});
export default mcpClient

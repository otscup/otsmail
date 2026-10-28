import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// MCP 访问令牌：只存 sha256 摘要，明文仅在创建时返回一次
const mcpToken = sqliteTable('mcp_token', {
	tokenId: integer('token_id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	name: text('name').notNull(),
	tokenPrefix: text('token_prefix').notNull(),
	tokenHash: text('token_hash').notNull(),
	// OAuth client_credentials 签发的令牌带上 clientId，手工创建的令牌为空串
	clientId: text('client_id').default('').notNull(),
	createdAt: text('create_time').default(sql`CURRENT_TIMESTAMP`),
	lastUsedAt: text('last_used_at'),
	revoked: integer('revoked').default(0).notNull()
});
export default mcpToken

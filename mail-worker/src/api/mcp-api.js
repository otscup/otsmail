/**
 * MCP HTTP 端点（Streamable HTTP transport，无状态模式）
 *
 *   POST /mcp  - MCP JSON-RPC
 *   GET  /mcp  - 健康检查 / 能力发现
 *
 * 认证：Authorization: Bearer *** security 中间件（/mcp 不在 exclude）。
 * 开关：env.mcp_switch 默认关(OFF)；未开启时 POST /mcp 返回 403，防误开/可一键禁用。
 * 注意：未登录时 security 中间件会直接 401，先于开关判断。
 */
import app from '../hono/hono';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/mcp-server.js';

// Worker --var 注入的 env 是字符串 'true'，容错判定
function isMcpOn(c) {
	const v = c.env.mcp_switch;
	return v === true || v === 'true' || v === 1 || v === '1';
}

app.post('/mcp', async (c) => {
	if (!isMcpOn(c)) {
		return c.json({ error: 'mcp_disabled' }, 403);
	}
	const server = createMcpServer(c);
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	await server.connect(transport);
	return transport.handleRequest(c.req.raw);
});

app.get('/mcp', async (c) => {
	return c.json({ name: 'otsmail-mcp', version: '1.0.0', transport: 'streamable-http', enabled: isMcpOn(c) });
});

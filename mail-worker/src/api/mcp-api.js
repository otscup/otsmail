/**
 * MCP HTTP 端点（Streamable HTTP transport，无状态模式）
 *
 *   POST /mcp  - MCP JSON-RPC
 *   GET  /mcp  - 健康检查
 *
 * 认证：Authorization: Bearer <jwt>，走现有 security 中间件。
 * 注意：/mcp 需要登录态，未登录时中间件会直接 401。
 */
import app from '../hono/hono';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/mcp-server.js';

app.post('/mcp', async (c) => {
  const server = createMcpServer(c);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

app.get('/mcp', async (c) => {
  return c.json({ name: 'otsmail-mcp', version: '1.0.0', transport: 'streamable-http' });
});

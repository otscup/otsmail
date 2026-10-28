/**
 * MCP HTTP 端点（Streamable HTTP transport，无状态模式）
 *
 *   POST /mcp  - MCP JSON-RPC
 *   GET  /mcp  - 健康检查 / 能力发现
 *
 * 认证：Authorization: Bearer <JWT 或 mcp_ 令牌>，security 中间件校验（/mcp 不在 exclude）。
 * 开关：env.mcp_switch 默认关(OFF)；未开启时 POST /mcp 返回 403，防误开/可一键禁用。
 * 注意：未登录时 security 中间件会直接 401，先于开关判断。
 *
 * 后台管理（登录态，只操作自己的令牌/客户端）：
 *   GET  /mcp/status | /mcp/token/list | /mcp/client/list
 *   POST /mcp/token/create | /mcp/token/revoke | /mcp/client/create | /mcp/client/revoke
 *
 * OAuth 2.0（client_credentials，原始 JSON 响应不走 result 包装）：
 *   POST /api/oauth/mcp/token
 *   GET  /.well-known/oauth-authorization-server 与 /.well-known/oauth-protected-resource
 *   （/oauth 前缀本身在 security exclude 内；/.well-known 也在其中）
 */
import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import mcpService from '../service/mcp-service';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/mcp-server.js';

// Worker --var 注入的 env 是字符串 'true'，容错判定
function isMcpOn(c) {
	const v = c.env.mcp_switch;
	return v === true || v === 'true' || v === 1 || v === '1';
}

function origin(c) {
	return new URL(c.req.url).origin;
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

// ---------- 后台管理 ----------

app.get('/mcp/status', async (c) => {
	const data = await mcpService.status(c, userContext.getUserId(c));
	return c.json(result.ok({ enabled: isMcpOn(c), endpoint: origin(c) + '/mcp', ...data }));
});

app.get('/mcp/token/list', async (c) => {
	const list = await mcpService.listTokens(c, userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.post('/mcp/token/create', async (c) => {
	const data = await mcpService.createToken(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/mcp/token/revoke', async (c) => {
	await mcpService.revokeToken(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(null));
});

app.get('/mcp/client/list', async (c) => {
	const list = await mcpService.listClients(c, userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.post('/mcp/client/create', async (c) => {
	const data = await mcpService.createClient(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/mcp/client/revoke', async (c) => {
	await mcpService.revokeClient(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(null));
});

// ---------- OAuth 2.0 ----------

// RFC 8414：客户端据此发现 token 端点（grant_type=client_credentials）
app.get('/.well-known/oauth-authorization-server', async (c) => {
	const base = origin(c);
	return c.json({
		issuer: base,
		token_endpoint: base + '/api/oauth/mcp/token',
		grant_types_supported: ['client_credentials'],
		response_types_supported: ['token'],
		token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
		scopes_supported: ['mcp']
	});
});

// RFC 9728：告诉 MCP 客户端 /mcp 用 Bearer 令牌、授权服务器是本站
app.get('/.well-known/oauth-protected-resource', async (c) => {
	const base = origin(c);
	return c.json({
		resource: base + '/mcp',
		authorization_servers: [base],
		bearer_methods_supported: ['header'],
		scopes_supported: ['mcp']
	});
});

app.post('/oauth/mcp/token', async (c) => {
	let body = {};
	try {
		body = await c.req.parseBody();
	} catch (e) {
		body = {};
	}

	let clientId = body.client_id;
	let clientSecret = body.client_secret;

	// client_secret_basic: Authorization: Basic base64(client_id:client_secret)
	const basic = c.req.header('Authorization') || '';
	if (!clientId && basic.startsWith('Basic ')) {
		try {
			const [id, secret] = atob(basic.slice(6)).split(':');
			clientId = decodeURIComponent(id || '');
			clientSecret = decodeURIComponent(secret || '');
		} catch (e) {
			// 头格式坏了按缺少凭据处理
		}
	}

	if (body.grant_type && body.grant_type !== 'client_credentials') {
		return c.json({ error: 'unsupported_grant_type' }, 400);
	}

	const token = await mcpService.oauthToken(c, { client_id: clientId, client_secret: clientSecret });
	if (!token) {
		return c.json({ error: 'invalid_client' }, 401);
	}

	c.header('Cache-Control', 'no-store');
	return c.json(token);
});

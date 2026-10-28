import app from '../hono/hono';
import result from "../model/result";
import oauthService from "../service/oauth-service";

app.post('/oauth/linuxDo/login', async (c) => {
	const loginInfo = await oauthService.linuxDoLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo))
});

app.post('/oauth/github/login', async (c) => {
	const loginInfo = await oauthService.githubLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo))
});

app.post('/oauth/google/login', async (c) => {
	const loginInfo = await oauthService.googleLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo))
});

// 企业 SSO（OIDC）：登录页按钮先取授权端点（discovery 结果，缓存 1h）
app.get('/oauth/oidc/config', async (c) => {
	const config = await oauthService.oidcConfig(c, c.req.query('provider'));
	return c.json(result.ok(config))
});

app.post('/oauth/oidc/login', async (c) => {
	const loginInfo = await oauthService.oidcLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo))
});

app.put('/oauth/bind', async (c) => {
	const loginInfo = await oauthService.bind(c, await c.req.json());
	return c.json(result.ok(loginInfo))
});

app.put('/oauth/bindUser', async (c) => {
	const loginInfo = await oauthService.bindUser(c, await c.req.json());
	return c.json(result.ok(loginInfo))
})

app.get('/oauth/bindings', async (c) => {
	return c.json(result.ok(await oauthService.listBindings(c)))
})

app.put('/oauth/bindings/active', async (c) => {
	return c.json(result.ok(await oauthService.setBindingActive(c, await c.req.json())))
})

app.post('/oauth/unbind', async (c) => {
	return c.json(result.ok(await oauthService.unbind(c, await c.req.json())))
})

import app from '../hono/hono';
import loginService from '../service/login-service';
import result from '../model/result';
import userContext from '../security/user-context';

app.post('/login', async (c) => {
	const token = await loginService.login(c, await c.req.json());
	return c.json(result.ok({ token: token }));
});

app.post('/register', async (c) => {
	const jwt = await loginService.register(c, await c.req.json());
	return c.json(result.ok(jwt));
});

app.delete('/logout', async (c) => {
	await loginService.logout(c, userContext.getUserId(c));
	return c.json(result.ok());
});

// 扫码登录：网页端创建并轮询；App 用已登录会话确认。
app.post('/login/qr', async (c) => {
	return c.json(result.ok(await loginService.createQr(c)));
});

app.get('/login/qr/:id', async (c) => {
	return c.json(result.ok(await loginService.pollQr(c, c.req.param('id'))));
});

app.post('/my/qr/confirm', async (c) => {
	const body = await c.req.json();
	const origin = await loginService.confirmQr(c, userContext.getUserId(c), body.id);
	return c.json(result.ok(origin));
});


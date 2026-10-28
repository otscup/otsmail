import app from '../hono/hono';
import telegramService from '../service/telegram-service';
import result from '../model/result';

app.get('/telegram/getEmail/:token', async (c) => {
	const content = await telegramService.getEmailContent(c, c.req.param());
	c.header('Cache-Control', 'public, max-age=604800, immutable');
	return c.html(content)
});

// Telegram Bot webhook（/telegram 免登录，靠 secret_token 校验）：setWebhook 时把 secret_token 设成 Worker 的 jwt_secret
app.post('/telegram/webhook', async (c) => {
	const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token') || '';

	if (!c.env.jwt_secret || secret !== c.env.jwt_secret) {
		return c.json(result.fail('forbidden', 403));
	}

	await telegramService.webhook(c, await c.req.json());
	return c.json(result.ok(null));
});


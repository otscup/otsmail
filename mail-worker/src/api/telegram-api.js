import app from '../hono/hono';
import telegramService from '../service/telegram-service';
import result from '../model/result';

app.get('/telegram/getEmail/:token', async (c) => {
	const content = await telegramService.getEmailContent(c, c.req.param());
	c.header('Cache-Control', 'public, max-age=604800, immutable');
	return c.html(content)
});

// Telegram Bot 授权页：网页点“绑定”后打开，用户复制命令发给 bot
app.get('/telegram/bind', async (c) => {
	const code = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
	await c.env.kv.put('tg_bind_' + code, '1', {expirationTtl: 600});
	return c.html(`<!doctype html><meta charset="utf-8"><title>绑定 Telegram</title>
<div style="font-family:system-ui;max-width:560px;margin:60px auto;padding:24px;line-height:1.7">
<h2>绑定 Telegram</h2>
<p>在 Telegram 中打开你的机器人，发送下面这条命令：</p>
<p style="font-size:18px;background:#f4f4f5;padding:12px;border-radius:8px">/bind ${code}</p>
<p style="color:#666">命令 10 分钟内有效。绑定成功后，机器人会回复“绑定成功”。</p>
</div>`);
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


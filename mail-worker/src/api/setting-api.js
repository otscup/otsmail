import app from '../hono/hono';
import result from '../model/result';
import settingService from '../service/setting-service';
import webhookService from '../service/webhook-service';
import aiService from '../service/ai-service';
import telegramService from '../service/telegram-service';
import userContext from "../security/user-context";

app.put('/setting/set', async (c) => {
	await settingService.set(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/setting/query', async (c) => {
	const setting = await settingService.get(c);
	return c.json(result.ok(setting));
});

app.get('/setting/websiteConfig', async (c) => {
	const setting = await settingService.websiteConfig(c);
	return c.json(result.ok(setting));
})

app.put('/setting/setBackground', async (c) => {
	const key = await settingService.setBackground(c, await c.req.json());
	return c.json(result.ok(key));
});

app.delete('/setting/deleteBackground', async (c) => {
	await settingService.deleteBackground(c, c.req.query('target'));
	return c.json(result.ok());
});

app.put('/setting/setBlacklist', async (c) => {
	const setting = await settingService.setBlacklist(c, await c.req.json());
	return c.json(result.ok(setting));
})

app.post('/setting/tgWebhook', async (c) => {
	const body = await c.req.json();
	const data = await telegramService.setWebhook(c, body.url);
	return c.json(result.ok(data));
});

app.post('/setting/aiModels', async (c) => {
	const data = await aiService.listModels(c, await c.req.json());
	return c.json(result.ok(data));
});

app.post('/setting/webhookTest', async (c) => {
	const body = await c.req.json();
	const setting = await settingService.query(c);
	const resultData = await webhookService.test(c, {
		url: body.url || setting.webhookUrl,
		secret: body.secret || setting.webhookSecret
	});
	return c.json(result.ok(resultData));
})


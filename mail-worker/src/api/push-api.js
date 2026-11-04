import app from '../hono/hono';
import result from '../model/result';
import pushService from '../service/push-service';
import fcmService from '../service/fcm-service';
import BizError from '../error/biz-error';
import userContext from '../security/user-context';

app.get('/push/key', c => c.json(result.ok({ key: pushService.key(c) })));

app.post('/push/test', async c => {
	const results = await pushService.send(c, c.get('user').userId, {
		title: 'OTSMail 测试通知',
		body: '如果你看到这条通知，Web Push 正常。',
		url: '/'
	});
	return c.json(result.ok({ results }));
});

app.post('/push/subscribe', async c => {
	await pushService.subscribe(c, await c.req.json(), c.get('user').userId);
	return c.json(result.ok());
});

app.post('/push/unsubscribe', async c => {
	const { endpoint } = await c.req.json();
	await pushService.unsubscribe(c, String(endpoint || ''), c.get('user').userId);
	return c.json(result.ok());
});

app.post('/push/device', async c => {
	const body = await c.req.json().catch(() => ({}));
	const token = String(body.token || '').trim();
	if (!token || token.length > 4096) throw new BizError('缺少 token', 400);

	const platform = String(body.platform || 'android').slice(0, 32);
	const deviceId = String(body.deviceId || '').slice(0, 128);
	const appVersion = String(body.appVersion || '').slice(0, 64);

	await fcmService.upsertDevice(c, userContext.getUserId(c), { token, platform, deviceId, appVersion });
	return c.json(result.ok({ token, platform }));
});

app.delete('/push/device', async c => {
	const token = String(c.req.query('token') || '').trim();
	if (!token) throw new BizError('缺少 token', 400);

	await fcmService.deleteDevice(c, userContext.getUserId(c), token);
	return c.json(result.ok());
});

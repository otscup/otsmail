import app from '../hono/hono';
import pushService from '../service/push-service';

app.get('/push/key', c => c.json({ key: pushService.key(c) }));

app.post('/push/subscribe', async c => {
	await pushService.subscribe(c, await c.req.json(), c.get('user').userId);
	return c.json({});
});

app.post('/push/unsubscribe', async c => {
	const { endpoint } = await c.req.json();
	await pushService.unsubscribe(c, String(endpoint || ''), c.get('user').userId);
	return c.json({});
});

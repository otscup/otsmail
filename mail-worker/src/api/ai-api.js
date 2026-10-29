import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import aiService from '../service/ai-service';

app.post('/ai/reply', async (c) => {
	const params = await c.req.json();
	const userId = userContext.getUserId(c);
	const data = await aiService.replyEmail(c, { ...params, userId });
	return c.json(result.ok(data));
});

app.post('/ai/summary', async (c) => {
	const params = await c.req.json();
	const userId = userContext.getUserId(c);
	const data = await aiService.summaryEmail(c, { ...params, userId });
	return c.json(result.ok(data));
});

app.post('/ai/polish', async (c) => {
	const params = await c.req.json();
	const userId = userContext.getUserId(c);
	const data = await aiService.polishText(c, { ...params, userId });
	return c.json(result.ok(data));
});

app.post('/ai/classify', async (c) => {
	const userId = userContext.getUserId(c);
	const data = await aiService.classifyInbox(c, userId);
	return c.json(result.ok(data));
});

app.post('/ai/command', async (c) => {
	const params = await c.req.json();
	const userId = userContext.getUserId(c);
	const data = await aiService.command(c, { ...params, userId });
	return c.json(result.ok(data));
});

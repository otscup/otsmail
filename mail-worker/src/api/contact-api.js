import app from '../hono/hono';
import contactService from '../service/contact-service';
import userContext from '../security/user-context';
import result from '../model/result';

app.get('/contact/list', async (c) => {
	const data = await contactService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/contact/add', async (c) => {
	await contactService.add(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.post('/contact/set', async (c) => {
	await contactService.set(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.post('/contact/delete', async (c) => {
	await contactService.delete(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

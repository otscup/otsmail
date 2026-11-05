import app from '../hono/hono';
import result from '../model/result';
import versionService from '../service/version-service';
import updateService from '../service/update-service';

app.get('/version', c => c.json(result.ok(versionService.currentVersion(c))));

app.get('/update/check', async c => {
	const user = c.get('user') || {};
	const admin = String(c.env.admin || '').trim().toLowerCase();
	if (!admin || String(user.email || '').trim().toLowerCase() !== admin) {
		return c.json(result.fail('Forbidden', 403), 403);
	}
	const data = await updateService.check({ env: c.env });
	return c.json(result.ok(data));
});

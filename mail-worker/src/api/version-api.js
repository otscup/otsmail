import app from '../hono/hono';
import result from '../model/result';
import versionService from '../service/version-service';
import updateService from '../service/update-service';

app.get('/version', c => c.json(result.ok(versionService.currentVersion(c))));

// 登录页只读公开元数据；版本号可用前端构建号覆盖，避免后端 WEB_VERSION 滞后造成假提醒。
app.get('/version/latest', async c => {
	try {
		const data = await updateService.check({ env: c.env });
		const requested = String(c.req.query('v') || '').replace(/^web-v/i, '').trim();
		const current = requested || data.current;
		const hasUpdate = Boolean(data.latest) && current !== 'unknown' &&
			versionService.isNewer(data.latest, current);
		return c.json(result.ok({
			status: hasUpdate ? 'ok' : data.status,
			current,
			latest: data.latest || null,
			hasUpdate,
			url: data.url || null,
			checkedAt: data.checkedAt || null,
			cached: Boolean(data.cached)
		}));
	} catch (e) {
		console.error('version latest check failed', e?.message || e);
		return c.json(result.ok({ status: 'upstreamError', current: null, latest: null, hasUpdate: false }));
	}
});

app.get('/update/check', async c => {
	const user = c.get('user') || {};
	const admin = String(c.env.admin || '').trim().toLowerCase();
	if (!admin || String(user.email || '').trim().toLowerCase() !== admin) {
		return c.json(result.fail('Forbidden', 403), 403);
	}
	const data = await updateService.check({ env: c.env });
	return c.json(result.ok(data));
});

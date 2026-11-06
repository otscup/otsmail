import app from '../hono/hono';
import proxyService from '../service/proxy-service';
import BizError from '../error/biz-error';

app.get('/proxy/css', async (c) => {
	const url = c.req.query('url');
	const userId = c.req.query('uid');
	const exp = c.req.query('exp');
	const sig = c.req.query('sig');
	if (!url || !userId || !exp || !sig ||
		!await proxyService.verify(c, url, userId, exp, sig)) {
		return c.text('Forbidden', 403);
	}
	try {
		await proxyService.rateLimit(c, userId);
		const cacheKey = new Request(`https://otsmail-proxy.local/css?url=${encodeURIComponent(url)}`);
		const cache = typeof caches !== 'undefined' ? caches.default : null;
		const cached = cache ? await cache.match(cacheKey) : null;
		if (cached) return cached;
		const response = await proxyService.fetchCss(c, url, userId);
		if (cache) {
			const put = cache.put(cacheKey, response.clone());
			if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(put);
			else await put;
		}
		return response;
	} catch (e) {
		if (e instanceof BizError) throw e;
		console.error('样式代理失败:', e);
		throw new BizError('样式获取失败', 502);
	}
});

app.get('/proxy/image', async (c) => {
	const url = c.req.query('url');
	const userId = c.req.query('uid');
	const exp = c.req.query('exp');
	const sig = c.req.query('sig');

	if (!url || !userId || !exp || !sig ||
		!await proxyService.verify(c, url, userId, exp, sig)) {
		return c.text('Forbidden', 403);
	}

	try {
		await proxyService.rateLimit(c, userId);

		// 缓存 key 只包含归一化后的原图 URL，不把签名/用户带进 CDN。
		const cacheKey = new Request(`https://otsmail-proxy.local/?url=${encodeURIComponent(url)}`);
		const cache = typeof caches !== 'undefined' ? caches.default : null;
		const cached = cache ? await cache.match(cacheKey) : null;
		if (cached) return cached;

		const response = await proxyService.fetchImage(c, url);
		if (cache) {
			const put = cache.put(cacheKey, response.clone());
			if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(put);
			else await put;
		}
		return response;
	} catch (e) {
		if (e instanceof BizError) throw e;
		console.error('图片代理失败:', e);
		throw new BizError('图片获取失败', 502);
	}
});

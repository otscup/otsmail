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
		// 先查边缘缓存：命中时既不打上游也不该占用户的抓取配额。
		// 同一张图在多次打开同一封邮件时会重复请求，之前每次都先扣配额，
		// 一封 60 张图的邮件点开 5 次就把 300 次/小时的额度用光，之后整批图片 429。
		const cacheKey = new Request(`https://otsmail-proxy.local/css?url=${encodeURIComponent(url)}`);
		const cache = typeof caches !== 'undefined' ? caches.default : null;
		const cached = cache ? await cache.match(cacheKey) : null;
		if (cached) return cached;
		await proxyService.rateLimit(c, userId);
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
		// 缓存 key 只包含归一化后的原图 URL，不把签名/用户带进 CDN。
		// 先命中缓存再计配额：重复打开同一封邮件时图片直接由边缘返回，
		// 不会把 300 次/小时的额度耗在已经取过的图上（配额只约束真正回源的请求）。
		const cacheKey = new Request(`https://otsmail-proxy.local/?url=${encodeURIComponent(url)}`);
		const cache = typeof caches !== 'undefined' ? caches.default : null;
		const cached = cache ? await cache.match(cacheKey) : null;
		if (cached) return cached;

		await proxyService.rateLimit(c, userId);
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

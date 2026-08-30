// 前端静态资源服务：从 R2 (web/ 前缀) 读取 (绕开 Cloudflare Assets 绑定存储层故障)
// 移植策略：替代 env.assets.fetch，直接用 R2 托管前端构建产物

const webAssetService = {

	// content-type 推断
	contentType(path) {
		if (path.endsWith('.html')) return 'text/html; charset=utf-8';
		if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
		if (path.endsWith('.css')) return 'text/css; charset=utf-8';
		if (path.endsWith('.json')) return 'application/json; charset=utf-8';
		if (path.endsWith('.svg')) return 'image/svg+xml';
		if (path.endsWith('.png')) return 'image/png';
		if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
		if (path.endsWith('.ico')) return 'image/x-icon';
		if (path.endsWith('.woff2')) return 'font/woff2';
		if (path.endsWith('.woff')) return 'font/woff';
		if (path.endsWith('.webmanifest')) return 'application/manifest+json';
		return 'application/octet-stream';
	},

	// 读取前端资源，返回 Response
	async fetch(req, env) {
		const url = new URL(req.url);
		let pathname = decodeURIComponent(url.pathname);

		// 根路径返回 index.html (SPA)
		if (pathname === '/' || pathname === '') {
			pathname = '/index.html';
		}

		// 防止路径穿越
		if (pathname.includes('..')) {
			return new Response('Forbidden', { status: 403 });
		}

		const key = 'web' + pathname; // web/ 前缀
		try {
			const obj = await env.r2.get(key);
			if (!obj) {
				// SPA 回退：未知路径返回 index.html
				const indexObj = await env.r2.get('web/index.html');
				if (!indexObj) {
					return new Response('Not Found', { status: 404 });
				}
				return new Response(await indexObj.arrayBuffer(), {
					headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
				});
			}
			const body = await obj.arrayBuffer();
			return new Response(body, {
				headers: {
					'content-type': this.contentType(pathname),
					// no-store: 防止 CF/浏览器缓存坏响应导致白屏复发
					'cache-control': 'no-store',
					'cdn-cache-control': 'no-store'
				}
			});
		} catch (e) {
			return new Response('Internal Error: ' + e.message, { status: 500 });
		}
	}
};

export default webAssetService;

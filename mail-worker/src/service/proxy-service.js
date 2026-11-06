import BizError from '../error/biz-error';

const encoder = new TextEncoder();
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(['', '80', '443']);
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
	.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function ipv4Private(ip) {
	const p = ip.split('.').map(Number);
	if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
	return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
		(p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
		(p[0] === 169 && p[1] === 254) ||
		(p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
		(p[0] === 192 && p[1] === 168) ||
		(p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
		p[0] >= 224;
}

function isPrivateHost(host) {
	const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
	if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
	if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return ipv4Private(h);
	if (h.includes(':')) {
		return h === '::1' || h.startsWith('fc') || h.startsWith('fd') ||
			h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb') ||
			h.startsWith('::ffff:') || h.startsWith('ff');
	}
	return false;
}

async function resolvedPrivate(host) {
	const check = async (type) => {
		const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
			headers: { Accept: 'application/dns-json' },
			signal: AbortSignal.timeout(2500)
		});
		if (!res.ok) throw new Error('dns lookup failed');
		const doc = await res.json();
		return (doc.Answer || []).some(a => isPrivateHost(String(a.data || '')));
	};
	return (await check('A')) || (await check('AAAA'));
}

async function assertPublicUrl(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new BizError('图片地址无效', 400);
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new BizError('图片地址不允许', 400);
	}
	if (!ALLOWED_PORTS.has(url.port) || isPrivateHost(url.hostname)) {
		throw new BizError('图片地址不允许', 400);
	}
	if (!/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && await resolvedPrivate(url.hostname)) {
		throw new BizError('图片地址不允许', 400);
	}
	return url;
}

function sniffImage(bytes) {
	if (bytes.length < 12) return '';
	// JPEG / PNG / GIF / WebP / AVIF only. SVG is deliberately rejected.
	if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
	if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
		String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
	const brand = String.fromCharCode(...bytes.slice(8, 12));
	if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && /^avi[fs]$/.test(brand)) return 'image/avif';
	return '';
}

async function signPath(c, url, userId, path, ttl = 3600) {
	const exp = Math.floor(Date.now() / 1000) + ttl;
	const payload = `${userId}|${exp}|${url}`;
	const key = await crypto.subtle.importKey('raw', encoder.encode(c.env.jwt_secret || ''),
		{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = b64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
	return `${path}?url=${encodeURIComponent(url)}&uid=${userId}&exp=${exp}&sig=${sig}`;
}

async function sign(c, url, userId, ttl = 3600) {
	return signPath(c, url, userId, '/api/proxy/image', ttl);
}

async function signCss(c, url, userId, ttl = 3600) {
	return signPath(c, url, userId, '/api/proxy/css', ttl);
}

async function verify(c, url, userId, exp, sig) {
	if (!url || !userId || !exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
	const payload = `${userId}|${exp}|${url}`;
	const key = await crypto.subtle.importKey('raw', encoder.encode(c.env.jwt_secret || ''),
		{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	const expected = new Uint8Array(bytes);
	const actual = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(sig.length / 4) * 4, '=')), ch => ch.charCodeAt(0));
	if (expected.length !== actual.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
	return diff === 0;
}

async function fetchImage(c, rawUrl) {
	let url = await assertPublicUrl(rawUrl);
	let redirects = 0;

	while (true) {
		const res = await fetch(url.toString(), {
			redirect: 'manual',
			headers: {
				Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
				'User-Agent': 'otsmail-image-proxy'
			},
			signal: AbortSignal.timeout(10000)
		});

		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get('location');
			if (!location || redirects >= MAX_REDIRECTS) throw new BizError('图片重定向过多', 400);
			redirects++;
			url = await assertPublicUrl(new URL(location, url).toString());
			continue;
		}

		if (!res.ok) throw new BizError('图片获取失败', 502);
		const declared = Number(res.headers.get('content-length') || 0);
		if (declared > MAX_BYTES) throw new BizError('图片过大', 413);

		const type = (res.headers.get('content-type') || '').toLowerCase();
		if (!type.startsWith('image/') || type.includes('svg')) throw new BizError('不是受支持的图片', 415);

		const bytes = new Uint8Array(await res.arrayBuffer());
		if (bytes.length > MAX_BYTES) throw new BizError('图片过大', 413);
		const mime = sniffImage(bytes);
		if (!mime) throw new BizError('不是受支持的图片', 415);

		return new Response(bytes, {
			headers: {
				'Content-Type': mime,
				'Cache-Control': 'public, max-age=86400',
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': "default-src 'none'"
			}
		});
	}
}

async function fetchCss(c, rawUrl, userId) {
	let url = await assertPublicUrl(rawUrl);
	let redirects = 0;
	while (true) {
		const res = await fetch(url.toString(), {
			redirect: 'manual',
			headers: { Accept: 'text/css,*/*;q=0.1', 'User-Agent': 'otsmail-css-proxy' },
			signal: AbortSignal.timeout(10000)
		});
		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get('location');
			if (!location || redirects >= MAX_REDIRECTS) throw new BizError('样式重定向过多', 400);
			redirects++;
			url = await assertPublicUrl(new URL(location, url).toString());
			continue;
		}
		if (!res.ok) throw new BizError('样式获取失败', 502);
		const declared = Number(res.headers.get('content-length') || 0);
		if (declared > 2 * 1024 * 1024) throw new BizError('样式过大', 413);
		const type = (res.headers.get('content-type') || '').toLowerCase();
		if (!type.startsWith('text/css')) throw new BizError('不是受支持的样式', 415);
		const css = await res.text();
		if (css.length > 2 * 1024 * 1024) throw new BizError('样式过大', 413);

		// CSS 内图片相对原始样式地址解析，再签名；@import 仍保留原地址。
		const imageUrls = new Set();
		for (const m of css.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi)) {
			const raw = m[2].trim();
			if (!raw || raw.startsWith('data:') || raw.startsWith('#')) continue;
			try {
				const abs = new URL(raw, url).toString();
				if (/^https?:\/\//i.test(abs)) imageUrls.add(abs);
			} catch {}
		}
		const signed = new Map();
		for (const imageUrl of imageUrls) {
			try {
				signed.set(imageUrl, await sign(c, imageUrl, userId));
			} catch {}
		}
		const body = css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (all, quote, raw) => {
			try {
				const abs = new URL(raw.trim(), url).toString();
				const proxied = signed.get(abs);
				return proxied ? `url("${proxied}")` : all;
			} catch {
				return all;
			}
		});
		return new Response(body, {
			headers: {
				'Content-Type': 'text/css; charset=utf-8',
				'Cache-Control': 'public, max-age=3600',
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': "default-src 'none'"
			}
		});
	}
}

async function rateLimit(c, userId) {
	if (!c.env.kv || !userId) return;
	const hour = new Date().toISOString().slice(0, 13);
	const key = `proxy:rl:${userId}:${hour}`;
	const count = Number(await c.env.kv.get(key) || 0);
	if (count >= 300) throw new BizError('图片代理请求过多', 429);
	await c.env.kv.put(key, String(count + 1), { expirationTtl: 3700 });
}

async function signRemoteImages(c, content, userId) {
	if (!content || !userId) return content;

	const urls = new Set();
	const cssUrls = new Set();
	const add = (raw) => {
		const url = String(raw || '').replace(/&amp;/g, '&').trim();
		if (/^https?:\/\//i.test(url) && !url.includes('/api/proxy/image?')) urls.add(url);
	};
	const addCss = (raw) => {
		const url = String(raw || '').replace(/&amp;/g, '&').trim();
		if (/^https?:\/\//i.test(url) && !url.includes('/api/proxy/css?')) cssUrls.add(url);
	};

	for (const m of content.matchAll(/<link\b[^>]*\brel\s*=\s*(["'])stylesheet\1[^>]*>/gi)) {
		const href = m[0].match(/\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1/i);
		if (href) addCss(href[2]);
	}

	// srcset / source srcset：逗号后的描述符（1x、640w）原样保留。
	for (const m of content.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) {
		for (const part of m[2].split(',')) add(part.trim().split(/\s+/)[0]);
	}
	// 内联 style / <style> 里的 background-image、list-style-image 等。
	for (const m of content.matchAll(/url\(\s*(["']?)(https?:\/\/[^)"']+)\1\s*\)/gi)) add(m[2]);
	// 普通 img src、background 和 video poster 属性。
	for (const m of content.matchAll(/(?:\bsrc|\bbackground|\bposter)\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi)) add(m[2]);

	const signed = new Map();
	for (const url of urls) {
		try {
			signed.set(url, await sign(c, url, userId));
		} catch {
			// 签名失败时保留原 URL，不因一张图阻断整封邮件。
		}
	}
	const signedCss = new Map();
	for (const url of cssUrls) {
		try {
			signedCss.set(url, await signCss(c, url, userId));
		} catch {}
	}
	if (!signed.size && !signedCss.size) return content;

	const signedUrl = (raw) => {
		const key = String(raw || '').replace(/&amp;/g, '&').trim();
		return signed.get(key) || raw;
	};

	let result = content.replace(/<link\b[^>]*\brel\s*=\s*(["'])stylesheet\1[^>]*>/gi, (tag) => {
		const href = tag.match(/\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1/i);
		if (!href) return tag;
		const signedHref = signedCss.get(href[2].replace(/&amp;/g, '&'));
		return signedHref ? tag.replace(href[0], `href="${signedHref}"`) : tag;
	});
	result = result.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (all, quote, value) => {
		const parts = value.split(',').map(part => {
			const bits = part.trim().split(/\s+/);
			const url = bits.shift();
			return [signedUrl(url), ...bits].join(' ');
		});
		return `srcset="${parts.join(', ')}"`;
	});
	result = result.replace(/url\(\s*(["']?)(https?:\/\/[^)"']+)\1\s*\)/gi,
		(all, quote, url) => `url("${signedUrl(url)}")`);
	result = result.replace(/(\bsrc|\bbackground|\bposter)\s*=\s*(["'])(https?:\/\/[^"']+)\2/gi,
		(all, name, quote, url) => `${name}="${signedUrl(url)}"`);
	return result;
}

export default {
	sign,
	signCss,
	verify,
	fetchImage,
	fetchCss,
	rateLimit,
	signRemoteImages,
	isPrivateHost,
	sniffImage
};

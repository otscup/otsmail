import { describe, expect, it } from 'vitest';
import proxyService from '../src/service/proxy-service';
import attService from '../src/service/att-service';
import settingService from '../src/service/setting-service';
import { vi } from 'vitest';

const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);

describe('image proxy', () => {
	it('rejects private and odd hosts', () => {
		for (const host of ['localhost', '127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254',
			'172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1']) {
			expect(proxyService.isPrivateHost(host), host).toBe(true);
		}
		expect(proxyService.isPrivateHost('example.com')).toBe(false);
		expect(proxyService.isPrivateHost('1.1.1.1')).toBe(false);
	});

	it('sniffs raster images and rejects svg', () => {
		expect(proxyService.sniffImage(png)).toBe('image/png');
		expect(proxyService.sniffImage(new Uint8Array([0xFF, 0xD8, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
		expect(proxyService.sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe('');
	});

	it('signs and verifies a bounded URL', async () => {
		const c = { env: { jwt_secret: 'test-secret' } };
		const url = 'https://example.com/a.png';
		const signed = await proxyService.sign(c, url, 7, 60);
		const parsed = new URL(signed, 'https://mail.example.com');
		const exp = parsed.searchParams.get('exp');
		const sig = parsed.searchParams.get('sig');
		expect(await proxyService.verify(c, url, '7', exp, sig)).toBe(true);
		expect(await proxyService.verify(c, url, '7', exp, 'bad')).toBe(false);
		expect(await proxyService.verify(c, url, '8', exp, sig)).toBe(false);
	});

	it('rewrites img src, srcset, style url and background attr', async () => {
		const c = { env: { jwt_secret: 'test-secret' } };
		const html = `<link rel="stylesheet" href="https://css.example/mail.css">
<img src="https://a.example/x.png" srcset="https://a.example/x.png 1x, https://b.example/y.png 2x">
<div style="background:url('https://c.example/bg.png')"></div>
<style>.x{background:url(https://d.example/bg.png)}</style>
<table background="https://e.example/bg.png"></table>
<video poster="https://f.example/poster.jpg"></video>`;
		const out = await proxyService.signRemoteImages(c, html, 7);
		expect(out).toContain('/api/proxy/image?url=');
		expect(out).toContain('/api/proxy/css?url=');
		expect(out).toContain('srcset="');
		expect(out).toContain('url("');
		expect(out).toContain('background="');
		expect(out).toContain('poster="');
		expect(out).not.toContain('https://a.example/x.png');
		expect(out).not.toContain('https://c.example/bg.png');
		expect(out).not.toContain('https://e.example/bg.png');
	});

	it('rewrites CSS image urls through the signed image proxy', async () => {
		const c = { env: { jwt_secret: 'test-secret' } };
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response(
			'.mail{background:url("../bg.png")}',
			{ status: 200, headers: { 'content-type': 'text/css' } }
		);
		try {
			const res = await proxyService.fetchCss(c, 'https://1.2.3.4/css/mail.css', 7);
			const text = await res.text();
			expect(text).toContain('/api/proxy/image?url=');
			expect(text).not.toContain('../bg.png');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('uses the requester uid when the email has no owner', async () => {
		const c = {
			env: { jwt_secret: 'test-secret' },
			get: () => ({ userId: 9 })
		};
		const settingSpy = vi.spyOn(settingService, 'query').mockResolvedValue({ r2Domain: '' });
		const proxySpy = vi.spyOn(proxyService, 'signRemoteImages')
			.mockImplementation(async (ctx, html, uid) => `${html}|${uid}`);
		try {
			const out = await attService.signContent(c, '<img src="https://x.example/a.png">', 0);
			expect(out).toContain('|9');
		} finally {
			settingSpy.mockRestore();
			proxySpy.mockRestore();
		}
	});
});

import { describe, expect, it } from 'vitest';
import attService from '../src/service/att-service';

describe('attachment signed URLs', () => {
	it('accepts its own signature and rejects tampering', async () => {
		const c = { env: { jwt_secret: 'test-secret' } };
		const url = new URL(await attService.signKey(c, 'attachments/a.pdf', 7), 'https://mail.test');
		const key = url.pathname.slice('/attachments/'.length);
		const uid = url.searchParams.get('uid');
		const exp = url.searchParams.get('exp');
		const sig = url.searchParams.get('sig');

		expect(await attService.verifyKey(c, key, uid, exp, sig)).toBe(true);
		expect(await attService.verifyKey(c, key, '8', exp, sig)).toBe(false);
		expect(await attService.verifyKey(c, key, uid, exp, `${sig}x`)).toBe(false);
	});

	it('缓存期内仍有效、超期必拒（与客户端 7 天正文缓存对齐）', async () => {
		const c = { env: { jwt_secret: 'test-secret' } };
		const url = new URL(await attService.signKey(c, 'attachments/inline-body-image.png', 7), 'https://mail.test');
		const key = url.pathname.slice('/attachments/'.length);
		const uid = url.searchParams.get('uid');
		const exp = Number(url.searchParams.get('exp'));
		const sig = url.searchParams.get('sig');
		const now = Math.floor(Date.now() / 1000);

		// 安卓对打开过的正文保留 7 天，签名必须撑满这段缓存（第 2 小时、第 6 天都还要能取）
		expect(exp - now).toBeGreaterThan(7 * 24 * 3600);
		expect(await attService.verifyKey(c, key, uid, String(now + 6 * 24 * 3600), sig)).toBe(false);
		expect(await attService.verifyKey(c, key, uid, String(exp), sig)).toBe(true);
		// 过期后同一个签名必须拒绝
		expect(await attService.verifyKey(c, key, uid, String(now - 1), sig)).toBe(false);
	});
});

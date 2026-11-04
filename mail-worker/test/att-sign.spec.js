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
});

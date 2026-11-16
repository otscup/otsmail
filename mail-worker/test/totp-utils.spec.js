import { afterEach, describe, expect, it, vi } from 'vitest';
import totpUtils from '../src/utils/totp-utils';

// RFC 6238 SHA-1 测试向量：secret = ASCII "12345678901234567890"
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totpUtils', () => {
	afterEach(() => vi.restoreAllMocks());

	it('与 RFC 6238 已知向量一致（取 6 位）', async () => {
		expect(await totpUtils.code(SECRET, 1)).toBe('287082');           // T=59
		expect(await totpUtils.code(SECRET, 37037036)).toBe('081804');   // T=1111111109
		expect(await totpUtils.code(SECRET, 41152263)).toBe('005924');   // T=1234567890
	});

	it('verify 容忍前后一个时间窗', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(59000);
		const current = await totpUtils.code(SECRET, 1);
		const previous = await totpUtils.code(SECRET, 0);
		const next = await totpUtils.code(SECRET, 2);

		expect(await totpUtils.verify(SECRET, current)).toBe(true);
		expect(await totpUtils.verify(SECRET, previous)).toBe(true);
		expect(await totpUtils.verify(SECRET, next)).toBe(true);
	});

	it('verify 拒绝错码、格式错误与缺 secret', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(59000);
		expect(await totpUtils.verify(SECRET, '000000')).toBe(false);
		expect(await totpUtils.verify(SECRET, '12345')).toBe(false);
		expect(await totpUtils.verify('', '287082')).toBe(false);
		expect(await totpUtils.verify(SECRET, null)).toBe(false);
	});

	it('otpauth URL 包含标准参数', () => {
		const url = totpUtils.otpauthUrl(SECRET, 'alice@example.com');
		expect(url.startsWith('otpauth://totp/')).toBe(true);
		expect(url).toContain(`secret=${SECRET}`);
		expect(url).toContain('issuer=otsmail');
		expect(url).toContain('digits=6');
		expect(url).toContain('period=30');
	});
});

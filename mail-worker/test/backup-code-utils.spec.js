import { describe, expect, it } from 'vitest';
import backupCodeUtils from '../src/utils/backup-code-utils';

describe('backupCodeUtils', () => {
	it('生成 10 个 10 位、字符集安全的唯一码', () => {
		const codes = backupCodeUtils.generate();
		expect(codes).toHaveLength(10);
		expect(new Set(codes).size).toBe(10);
		for (const code of codes) {
			expect(code).toHaveLength(10);
			// 去掉了 I/O/0/1，避免抄写歧义
			expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
		}
	});

	it('归一化容忍空格、连字符与小写', () => {
		expect(backupCodeUtils.normalize(' abcd-efgh-jk ')).toBe('ABCDEFGHJK');
		expect(backupCodeUtils.normalize('ABCDE-FGHJK')).toBe('ABCDEFGHJK');
		expect(backupCodeUtils.normalize(null)).toBe('');
	});

	it('格式化按 5-5 分组，异常长度原样返回', () => {
		expect(backupCodeUtils.format('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
		expect(backupCodeUtils.format('ABCD')).toBe('ABCD');
	});

	it('哈希稳定、与 userId 绑定、且不包含明文', async () => {
		const code = 'ABCDEFGHJK';
		const first = await backupCodeUtils.hash(1, code);
		const again = await backupCodeUtils.hash(1, 'abcde-fghjk');
		const otherUser = await backupCodeUtils.hash(2, code);

		expect(first).toBe(again);
		expect(first).not.toBe(otherUser);
		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(first).not.toContain(code);
	});
});

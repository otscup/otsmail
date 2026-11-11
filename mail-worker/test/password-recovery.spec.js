import { describe, it, expect, vi } from 'vitest';
import passwordRecoveryService from '../src/service/password-recovery-service';

describe('passwordRecoveryService.maskEmail', () => {
	it('正确脱敏标准邮箱', () => {
		expect(passwordRecoveryService.maskEmail('alice@example.com')).toBe('al***e@example.com');
		expect(passwordRecoveryService.maskEmail('bob@gmail.com')).toBe('bo***b@gmail.com');
	});

	it('正确脱敏短用户名邮箱', () => {
		expect(passwordRecoveryService.maskEmail('me@domain.com')).toBe('m***@domain.com');
		expect(passwordRecoveryService.maskEmail('a@domain.com')).toBe('a***@domain.com');
	});

	it('异常输入安全降级', () => {
		expect(passwordRecoveryService.maskEmail('')).toBe('***');
		expect(passwordRecoveryService.maskEmail(null)).toBe('***');
		expect(passwordRecoveryService.maskEmail('invalid-email')).toBe('***');
	});
});

import { describe, expect, it } from 'vitest';
import { classifyByRules } from '../src/service/ai-service';
import roleService from '../src/service/role-service';

describe('spam rules', () => {
	it('classifies English spam before updates', () => {
		expect(classifyByRules({ sendEmail: 'x@example.com', subject: 'Claim your lottery jackpot' })).toBe('spam');
	});

	it('classifies crypto/work-from-home spam', () => {
		expect(classifyByRules({ sendEmail: 'x@example.com', subject: 'Risk-free bitcoin investment' })).toBe('spam');
	});

	it('treats a null availDomain as unrestricted', () => {
		expect(roleService.hasAvailDomainPerm(null, 'gmail@otscup.com')).toBe(true);
		expect(roleService.hasAvailDomainPerm('otscup.com', 'gmail@otscup.com')).toBe(true);
	});
});

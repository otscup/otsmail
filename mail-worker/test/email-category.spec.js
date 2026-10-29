import { describe, expect, it } from 'vitest';
import { classifyByRules } from '../src/service/ai-service';

describe('email category fallback', () => {
	it('classifies social senders', () => {
		expect(classifyByRules({ sendEmail: 'notice@linkedin.com', subject: 'New message' })).toBe('social');
	});

	it('classifies promotions', () => {
		expect(classifyByRules({ sendEmail: 'shop@example.com', subject: '限时优惠券' })).toBe('promotion');
	});

	it('classifies spam keywords', () => {
		expect(classifyByRules({ sendEmail: 'x@example.com', subject: '中奖通知' })).toBe('spam');
	});

	it('classifies ads', () => {
		expect(classifyByRules({ sendEmail: 'ads@example.com', subject: 'Sponsored offer' })).toBe('ads');
	});

	it('classifies account updates', () => {
		expect(classifyByRules({ sendEmail: 'security@example.com', subject: 'Security verification' })).toBe('updates');
	});

	it('does not classify ordinary body mentions as updates', () => {
		expect(classifyByRules({ sendEmail: 'alice@example.com', subject: 'Lunch', text: 'My account and login are fine' })).toBe('primary');
	});

	it('falls back to primary', () => {
		expect(classifyByRules({ name: 'Alice', sendEmail: 'alice@example.com', subject: 'Lunch' })).toBe('primary');
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/service/telegram-service', () => ({
	default: { sendAlert: vi.fn().mockResolvedValue(undefined) }
}));

import telegramService from '../src/service/telegram-service';
import loginGuard from '../src/service/login-guard';

function context() {
	const store = new Map();
	return {
		store,
		c: {
			env: {
				kv: {
					get: async (key, opts) => {
						const value = store.get(key);
						return opts?.type === 'json' && value ? JSON.parse(value) : value;
					},
					put: async (key, value) => store.set(key, value),
					delete: async (key) => store.delete(key)
				}
			},
			req: { header: () => '203.0.113.9' }
		}
	};
}

describe('login guard', () => {
	beforeEach(() => telegramService.sendAlert.mockClear());

	it('locks after five failures and clears on success', async () => {
		const { c } = context();
		for (let i = 0; i < 4; i++) expect(await loginGuard.recordFailure(c, 'a@test.com')).toBe(false);
		expect(await loginGuard.recordFailure(c, 'a@test.com')).toBe(true);
		expect(await loginGuard.lockRemaining(c, 'a@test.com')).toBeGreaterThan(0);
		expect(telegramService.sendAlert).toHaveBeenCalledTimes(1);
		await loginGuard.clear(c, 'a@test.com');
		expect(await loginGuard.lockRemaining(c, 'a@test.com')).toBe(0);
	});

	it('does not lock other emails on the same IP', async () => {
		const { c } = context();
		for (let i = 0; i < 5; i++) await loginGuard.recordFailure(c, 'a@test.com');
		expect(await loginGuard.lockRemaining(c, 'b@test.com')).toBe(0);
	});
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/security/user-context', () => ({
	default: { getToken: vi.fn().mockResolvedValue('tok-a') }
}));

import loginService from '../src/service/login-service';
import KvConst from '../src/const/kv-const';

function context(authInfo) {
	const store = new Map([[KvConst.AUTH_INFO + 7, JSON.stringify(authInfo)]]);
	return {
		store,
		c: {
			env: {
				kv: {
					get: async (key, opts) => {
						const value = store.get(key);
						return opts?.type === 'json' && value ? JSON.parse(value) : value;
					},
					put: async (key, value) => store.set(key, value)
				}
			}
		}
	};
}

describe('login sessions', () => {
	it('lists tokens with metadata and marks the current one', async () => {
		const { c } = context({
			tokens: ['tok-a', 'tok-b'],
			sessions: {
				'tok-a': { ip: '203.0.113.9', browser: 'Chrome', os: 'Windows', device: 'Desktop', time: '2026-11-07T00:00:00Z' },
				'tok-b': { ip: '198.51.100.4', browser: 'Safari', os: 'iOS', device: 'iPhone', time: '2026-11-06T00:00:00Z' }
			}
		});

		const list = await loginService.sessions(c, 7);

		expect(list).toHaveLength(2);
		expect(list[0]).toMatchObject({ id: 'tok-a', current: true, device: 'Desktop', ip: '203.0.113.9' });
		expect(list[1]).toMatchObject({ id: 'tok-b', current: false, device: 'iPhone' });
	});

	it('tolerates old KV entries without session metadata', async () => {
		const { c } = context({ tokens: ['tok-a'] });

		const list = await loginService.sessions(c, 7);

		expect(list).toEqual([{ id: 'tok-a', current: true, ip: '', browser: '', os: '', device: '', time: '' }]);
	});

	it('kicks a session and drops its metadata', async () => {
		const { c, store } = context({
			tokens: ['tok-a', 'tok-b'],
			sessions: { 'tok-b': { ip: '198.51.100.4', device: 'iPhone' } }
		});

		await loginService.kickSession(c, 7, 'tok-b');

		const saved = JSON.parse(store.get(KvConst.AUTH_INFO + 7));
		expect(saved.tokens).toEqual(['tok-a']);
		expect(saved.sessions['tok-b']).toBeUndefined();
	});

	it('rejects kicking an unknown session', async () => {
		const { c } = context({ tokens: ['tok-a'] });

		await expect(loginService.kickSession(c, 7, 'nope')).rejects.toThrow();
	});
});

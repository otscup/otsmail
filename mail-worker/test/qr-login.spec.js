import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/service/user-service', () => ({
	default: { selectById: vi.fn() }
}));

import loginService from '../src/service/login-service';
import userService from '../src/service/user-service';
import KvConst from '../src/const/kv-const';

function context() {
	const store = new Map();
	return {
		store,
		c: {
			env: {
				kv: {
					get: async (key) => store.get(key) ?? null,
					put: async (key, value) => store.set(key, value),
					delete: async (key) => store.delete(key)
				}
			}
		}
	};
}

describe('qr login', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		userService.selectById.mockResolvedValue({ userId: 7, email: 'a@example.com', isDel: 0, status: 0 });
	});

	it('creates a pending ticket and reports pending until confirmed', async () => {
		const { c, store } = context();
		const { id, expiresIn } = await loginService.createQr(c);
		expect(id).toMatch(/^[0-9a-f]{32}$/);
		expect(expiresIn).toBe(120);
		expect(store.get(KvConst.QR_LOGIN + id)).toContain('pending');
		expect(await loginService.pollQr(c, id)).toEqual({ status: 'pending' });
	});

	it('returns the origin device info on confirm', async () => {
		const { c } = context();
		const { id } = await loginService.createQr(c);
		const origin = await loginService.confirmQr(c, 7, id);
		expect(origin).toHaveProperty('ip');
		expect(origin).toHaveProperty('browser');
	});

	it('treats a repeated confirm from the same user as success', async () => {
		const { c } = context();
		const { id } = await loginService.createQr(c);
		await loginService.confirmQr(c, 7, id);
		await expect(loginService.confirmQr(c, 7, id)).resolves.toBeTruthy();
	});

	it('rejects a confirm from a different user', async () => {
		const { c } = context();
		const { id } = await loginService.createQr(c);
		await loginService.confirmQr(c, 7, id);
		await expect(loginService.confirmQr(c, 8, id)).rejects.toThrow();
	});

	it('rate limits ticket creation per ip', async () => {
		const { c } = context();
		for (let i = 0; i < 20; i++) await loginService.createQr(c);
		await expect(loginService.createQr(c)).rejects.toThrow();
	});

	it('returns expired for an unknown ticket', async () => {
		const { c } = context();
		expect(await loginService.pollQr(c, 'deadbeef')).toEqual({ status: 'expired' });
	});

	it('exchanges a confirmed ticket for a token exactly once', async () => {
		const { c, store } = context();
		const { id } = await loginService.createQr(c);
		await loginService.confirmQr(c, 7, id);
		vi.spyOn(loginService, 'login').mockResolvedValue('jwt-token');

		expect(await loginService.pollQr(c, id)).toEqual({ status: 'confirmed', token: 'jwt-token' });
		expect(store.has(KvConst.QR_LOGIN + id)).toBe(false);
		expect(await loginService.pollQr(c, id)).toEqual({ status: 'expired' });
	});

	it('rejects a banned user at exchange time', async () => {
		const { c } = context();
		const { id } = await loginService.createQr(c);
		await loginService.confirmQr(c, 7, id);
		userService.selectById.mockResolvedValue({ userId: 7, email: 'a@example.com', isDel: 0, status: 1 });
		await expect(loginService.pollQr(c, id)).rejects.toThrow();
	});
});

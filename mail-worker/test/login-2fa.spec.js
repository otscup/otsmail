import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/service/user-service', () => ({
	default: {
		selectByEmailIncludeDel: vi.fn(),
		updatePwd: vi.fn(),
		updateUserInfo: vi.fn()
	}
}));

vi.mock('../src/utils/crypto-utils', () => ({
	default: {
		verifyPassword: vi.fn(),
		isLegacyHash: () => false,
		hashPassword: vi.fn()
	}
}));

vi.mock('../src/service/two-factor-service', () => ({
	default: {
		verifyLoginFactor: vi.fn(),
		audit: vi.fn()
	}
}));

vi.mock('../src/service/login-guard', () => ({
	default: {
		lockRemaining: vi.fn(),
		recordFailure: vi.fn(),
		clear: vi.fn()
	}
}));

vi.mock('../src/service/turnstile-service', () => ({
	default: { verify: vi.fn() }
}));

vi.mock('../src/utils/jwt-utils', () => ({
	default: { generateToken: vi.fn().mockResolvedValue('test-jwt') }
}));

vi.mock('../src/service/session-service', () => ({
	default: { upsert: vi.fn(), removeMany: vi.fn() },
	rowToMeta: vi.fn()
}));

vi.mock('../src/service/auth-cache', () => ({
	default: { put: vi.fn(), clear: vi.fn() }
}));

import loginService from '../src/service/login-service';
import userService from '../src/service/user-service';
import cryptoUtils from '../src/utils/crypto-utils';
import twoFactorService from '../src/service/two-factor-service';
import loginGuard from '../src/service/login-guard';
import turnstileService from '../src/service/turnstile-service';
import KvConst from '../src/const/kv-const';

function context() {
	const store = new Map();
	return {
		store,
		c: {
			env: {
				kv: {
					get: async key => store.get(key) ?? null,
					put: async (key, value) => store.set(key, value),
					delete: async key => store.delete(key)
				}
			},
			req: { header: () => '' }
		}
	};
}

const userRow = {
	userId: 7,
	email: 'a@test.com',
	isDel: 0,
	status: 0,
	password: 'hash',
	salt: 'salt',
	disablePasswordLogin: 0,
	twoFactorSwitch: 1,
	twoFactorRequired: 0,
	twoFactorSecret: 'JBSWY3DPEHPK3PXP',
	twoFactorPendingSecret: ''
};

describe('login 两步验证分支', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		userService.selectByEmailIncludeDel.mockResolvedValue({ ...userRow });
		cryptoUtils.verifyPassword.mockResolvedValue(true);
		loginGuard.lockRemaining.mockResolvedValue(0);
		loginGuard.recordFailure.mockResolvedValue(false);
		loginGuard.clear.mockResolvedValue(undefined);
		twoFactorService.verifyLoginFactor.mockResolvedValue(false);
		turnstileService.verify.mockImplementation(async (c, token) => {
			if (!token) throw Object.assign(new Error('Turnstile token required'), { code: 400 });
		});
	});

	it('缺码时返回 428 LOGIN_2FA_REQUIRED，且不消耗登录失败次数', async () => {
		const { c } = context();
		await expect(loginService.login(c, { email: 'a@test.com', password: 'p' }))
			.rejects.toMatchObject({ code: 428, errorCode: 'LOGIN_2FA_REQUIRED' });
		expect(twoFactorService.verifyLoginFactor).not.toHaveBeenCalled();
		expect(loginGuard.recordFailure).not.toHaveBeenCalled();
		expect(turnstileService.verify).not.toHaveBeenCalled();
	});

	it('TOTP 或备用码命中即登录成功，并清空失败计数', async () => {
		const { c, store } = context();
		twoFactorService.verifyLoginFactor.mockResolvedValue(true);

		await expect(loginService.login(c, { email: 'a@test.com', password: 'p', twoFactorCode: '123456' }))
			.resolves.toBe('test-jwt');

		expect(twoFactorService.verifyLoginFactor).toHaveBeenCalledWith(c, expect.objectContaining({ userId: 7 }), '123456');
		expect(loginGuard.clear).toHaveBeenCalledOnce();
		expect(loginGuard.recordFailure).not.toHaveBeenCalled();

		// 会话缓存里不能出现两步验证密钥
		const authInfo = JSON.parse(store.get(KvConst.AUTH_INFO + 7));
		expect(authInfo.user.twoFactorSecret).toBeUndefined();
		expect(authInfo.user.twoFactorPendingSecret).toBeUndefined();
		expect(authInfo.user.password).toBeUndefined();
	});

	it('备用码字段同样进入第二因素校验', async () => {
		const { c } = context();
		twoFactorService.verifyLoginFactor.mockResolvedValue(true);

		await expect(loginService.login(c, { email: 'a@test.com', password: 'p', backupCode: 'ABCDE-FGHJK' }))
			.resolves.toBe('test-jwt');

		expect(twoFactorService.verifyLoginFactor).toHaveBeenCalledWith(c, expect.anything(), 'ABCDE-FGHJK');
	});

	it('TOTP 与备用码都不匹配时计一次失败并返回 428', async () => {
		const { c } = context();
		twoFactorService.verifyLoginFactor.mockResolvedValue(false);

		await expect(loginService.login(c, { email: 'a@test.com', password: 'p', twoFactorCode: '000000' }))
			.rejects.toMatchObject({ code: 428, errorCode: 'LOGIN_2FA_INVALID' });

		expect(loginGuard.recordFailure).toHaveBeenCalledOnce();
		expect(loginGuard.clear).not.toHaveBeenCalled();
	});

	it('第二因素连续失败触发锁定后返回 429', async () => {
		const { c } = context();
		twoFactorService.verifyLoginFactor.mockResolvedValue(false);
		loginGuard.recordFailure.mockResolvedValue(true);

		await expect(loginService.login(c, { email: 'a@test.com', password: 'p', twoFactorCode: '000000' }))
			.rejects.toMatchObject({ code: 429, errorCode: 'LOGIN_RATE_LIMITED' });
	});

	it('密码错误仍走原有失败计数，不进入第二因素', async () => {
		const { c } = context();
		cryptoUtils.verifyPassword.mockResolvedValue(false);

		await expect(loginService.login(c, { email: 'a@test.com', password: 'bad' }))
			.rejects.toMatchObject({ errorCode: 'LOGIN_CREDENTIALS' });

		expect(twoFactorService.verifyLoginFactor).not.toHaveBeenCalled();
		expect(loginGuard.recordFailure).toHaveBeenCalledOnce();
	});

	it('网页登录先校验 Turnstile，再进入原有密码和两步验证流程', async () => {
		const { c } = context();

		await expect(loginService.login(c, {
			email: 'a@test.com', password: 'p', turnstileToken: 'cf-token'
		})).rejects.toMatchObject({ code: 428, errorCode: 'LOGIN_2FA_REQUIRED' });

		expect(turnstileService.verify).toHaveBeenCalledWith(c, 'cf-token');
		expect(userService.selectByEmailIncludeDel).toHaveBeenCalledOnce();
	});

	it('网页登录的 Turnstile token 为空时直接拒绝，不查询账户', async () => {
		const { c } = context();

		await expect(loginService.login(c, {
			email: 'a@test.com', password: 'p', turnstileToken: ''
		})).rejects.toMatchObject({ code: 400, errorCode: 'LOGIN_TURNSTILE' });

		expect(userService.selectByEmailIncludeDel).not.toHaveBeenCalled();
		expect(loginGuard.recordFailure).not.toHaveBeenCalled();
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.hoisted(() => vi.fn().mockResolvedValue({ meta: { changes: 1 } }));

vi.mock('../src/entity/orm', () => ({
	default: () => ({
		insert: () => ({ values: () => ({ run }) }),
		update: () => ({ set: () => ({ where: () => ({ run }) }) })
	})
}));

vi.mock('../src/utils/totp-utils', () => ({
	default: {
		verify: vi.fn(),
		randomSecret: vi.fn(() => 'NEWSECRET'),
		otpauthUrl: vi.fn(() => 'otpauth://totp/test')
	}
}));

vi.mock('../src/utils/crypto-utils', () => ({
	default: { verifyPassword: vi.fn() }
}));

vi.mock('../src/service/backup-code-service', () => ({
	default: {
		verifyAndConsume: vi.fn(),
		removeAll: vi.fn(),
		generate: vi.fn()
	}
}));

import twoFactorService from '../src/service/two-factor-service';
import totpUtils from '../src/utils/totp-utils';
import cryptoUtils from '../src/utils/crypto-utils';
import backupCodeService from '../src/service/backup-code-service';

function context() {
	return { env: {}, req: { header: () => '' } };
}

const userRow = {
	userId: 7,
	email: 'a@test.com',
	salt: 'salt',
	password: 'hash',
	twoFactorSwitch: 1,
	twoFactorSecret: 'OLDSECRET',
	twoFactorPendingSecret: ''
};

describe('twoFactorService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		totpUtils.verify.mockResolvedValue(false);
		cryptoUtils.verifyPassword.mockResolvedValue(false);
		backupCodeService.verifyAndConsume.mockResolvedValue(false);
		backupCodeService.removeAll.mockResolvedValue(undefined);
		backupCodeService.generate.mockResolvedValue(['ABCDE-FGHJK']);
	});

	it('登录第二因素先校验 TOTP，命中后不再碰备用码', async () => {
		const c = context();
		totpUtils.verify.mockResolvedValue(true);

		expect(await twoFactorService.verifyLoginFactor(c, userRow, '123456')).toBe(true);
		expect(backupCodeService.verifyAndConsume).not.toHaveBeenCalled();
	});

	it('TOTP 不匹配时回退到备用码，命中即成功', async () => {
		const c = context();
		backupCodeService.verifyAndConsume.mockResolvedValue(true);

		expect(await twoFactorService.verifyLoginFactor(c, userRow, 'ABCDE-FGHJK')).toBe(true);
		expect(backupCodeService.verifyAndConsume).toHaveBeenCalledWith(c, 7, 'ABCDE-FGHJK');
	});

	it('两种凭证都不匹配返回 false', async () => {
		const c = context();
		expect(await twoFactorService.verifyLoginFactor(c, userRow, 'BAD')).toBe(false);
	});

	it('reauth 允许密码或 TOTP', async () => {
		const c = context();
		cryptoUtils.verifyPassword.mockResolvedValue(true);
		expect(await twoFactorService.reauth(c, userRow, { password: 'p' })).toBe('password');

		cryptoUtils.verifyPassword.mockResolvedValue(false);
		totpUtils.verify.mockResolvedValue(true);
		expect(await twoFactorService.reauth(c, userRow, { twoFactorCode: '123456' })).toBe('totp');
	});

	it('生成备用码的再验证不允许使用备用码', async () => {
		const c = context();
		backupCodeService.verifyAndConsume.mockResolvedValue(true);

		await expect(twoFactorService.reauth(c, userRow, { backupCode: 'ABCDE-FGHJK' }, { allowBackupCode: false }))
			.rejects.toMatchObject({ errorCode: 'TWO_FACTOR_REAUTH_FAILED' });
		expect(backupCodeService.verifyAndConsume).not.toHaveBeenCalled();
	});

	it('关闭 2FA 时备用码可用，并清空 secret 与整批备用码', async () => {
		const c = context();
		backupCodeService.verifyAndConsume.mockResolvedValue(true);

		expect(await twoFactorService.disable(c, userRow, { backupCode: 'ABCDE-FGHJK' })).toBe(true);
		expect(backupCodeService.removeAll).toHaveBeenCalledWith(c, 7);
		expect(run).toHaveBeenCalled();
	});

	it('重新绑定第一步只写 pending，不动现有 secret', async () => {
		const c = context();
		totpUtils.verify.mockResolvedValue(true);

		const result = await twoFactorService.startRebind(c, userRow, { code: '123456' });
		expect(result).toEqual({ secret: 'NEWSECRET', otpauthUrl: 'otpauth://totp/test' });
		expect(run).toHaveBeenCalled();
	});

	it('重新绑定确认会作废旧备用码并返回新码', async () => {
		const c = context();
		totpUtils.verify.mockResolvedValue(true);
		const result = await twoFactorService.confirmRebind(c, { ...userRow, twoFactorPendingSecret: 'NEWSECRET' }, { code: '123456' });

		expect(result).toEqual({ backupCodes: ['ABCDE-FGHJK'] });
		expect(backupCodeService.removeAll).toHaveBeenCalledWith(c, 7);
		expect(backupCodeService.generate).toHaveBeenCalledWith(c, 7);
	});
});

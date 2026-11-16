import orm from '../entity/orm';
import user from '../entity/user';
import { twoFactorAudit } from '../entity/two-factor-audit';
import { eq } from 'drizzle-orm';
import BizError from '../error/biz-error';
import totpUtils from '../utils/totp-utils';
import cryptoUtils from '../utils/crypto-utils';
import reqUtils from '../utils/req-utils';
import backupCodeService from './backup-code-service';
import { t } from '../i18n/i18n';

function uaText(c) {
	const ua = reqUtils.getUserAgent(c);
	return [ua.browser, ua.os, ua.device].filter(Boolean).join(' / ');
}

const twoFactorService = {

	// 审计失败不能阻断主流程（登录/关闭 2FA），只记日志
	async audit(c, userId, action, detail = '') {
		try {
			await orm(c).insert(twoFactorAudit).values({
				userId,
				action,
				detail,
				ip: reqUtils.getIp(c),
				ua: uaText(c),
				createdAt: new Date().toISOString()
			}).run();
		} catch (e) {
			console.warn('2fa audit failed (non-fatal):', e.message);
		}
	},

	// 登录第二因素：先 TOTP，未命中再试备用码（命中即标记已用）
	async verifyLoginFactor(c, userRow, rawCode) {
		const code = String(rawCode || '').trim();
		if (!code) return false;
		if (await totpUtils.verify(userRow.twoFactorSecret, code)) return true;
		if (await backupCodeService.verifyAndConsume(c, userRow.userId, code)) {
			await this.audit(c, userRow.userId, 'backup_code_used', 'login');
			return true;
		}
		return false;
	},

	/**
	 * 敏感操作的再验证。
	 * 允许密码或当前 TOTP；allowBackupCode=false 时禁止用备用码，
	 * 用于「生成备用码」——否则一个泄露的备用码能无限续期。
	 */
	async reauth(c, userRow, params, { allowBackupCode = true } = {}) {
		const password = String(params?.password || '');
		const code = String(params?.twoFactorCode || params?.code || params?.backupCode || '').trim();

		if (password && await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password)) {
			return 'password';
		}
		if (code) {
			if (await totpUtils.verify(userRow.twoFactorSecret, code)) return 'totp';
			if (allowBackupCode && await backupCodeService.verifyAndConsume(c, userRow.userId, code)) {
				await this.audit(c, userRow.userId, 'backup_code_used', 'settings reauth');
				return 'backup_code';
			}
		}
		throw new BizError(t('twoFactorReauthFailed'), 400, 'TWO_FACTOR_REAUTH_FAILED');
	},

	// 关闭 2FA：密码 / TOTP / 备用码任一即可，并作废全部备用码
	async disable(c, userRow, params) {
		if (userRow.twoFactorSwitch !== 1) return false;
		await this.reauth(c, userRow, params, { allowBackupCode: true });
		await orm(c).update(user).set({
			twoFactorSwitch: 0,
			twoFactorSecret: '',
			twoFactorPendingSecret: '',
			twoFactorRequired: 0
		}).where(eq(user.userId, userRow.userId)).run();
		await backupCodeService.removeAll(c, userRow.userId);
		await this.audit(c, userRow.userId, 'disable');
		return true;
	},

	// 重新绑定第一步：旧验证器与旧备用码仍然有效，新密钥只写进 pending
	async startRebind(c, userRow, params) {
		if (userRow.twoFactorSwitch !== 1) {
			throw new BizError(t('twoFactorNotOpen'), 400);
		}
		await this.reauth(c, userRow, params, { allowBackupCode: true });
		const secret = totpUtils.randomSecret();
		await orm(c).update(user).set({ twoFactorPendingSecret: secret })
			.where(eq(user.userId, userRow.userId)).run();
		await this.audit(c, userRow.userId, 'rebind_start');
		return { secret, otpauthUrl: totpUtils.otpauthUrl(secret, userRow.email) };
	},

	// 重新绑定第二步：单条 UPDATE 原子切换 secret，旧备用码整批作废并发新码
	async confirmRebind(c, userRow, params) {
		if (!userRow.twoFactorPendingSecret) {
			throw new BizError(t('twoFactorRebindNotStarted'), 400);
		}
		if (!await totpUtils.verify(userRow.twoFactorPendingSecret, params?.code)) {
			throw new BizError(t('twoFactorCodeInvalid'), 400);
		}
		await orm(c).update(user).set({
			twoFactorSecret: userRow.twoFactorPendingSecret,
			twoFactorPendingSecret: '',
			twoFactorSwitch: 1
		}).where(eq(user.userId, userRow.userId)).run();
		await backupCodeService.removeAll(c, userRow.userId);
		const backupCodes = await backupCodeService.generate(c, userRow.userId);
		await this.audit(c, userRow.userId, 'rebind_confirm');
		return { backupCodes };
	}
};

export default twoFactorService;

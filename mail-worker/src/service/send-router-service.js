import settingService from './setting-service';
import senderProviderConfig from './sender-provider-config';
import sendQuotaService from './send-quota-service';
import { getProvider } from './provider';
import { toBase64Attachments } from './provider/attachment';
import { ProviderError, PROVIDER_ERROR } from './provider/provider-error';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';

// 认证失败说明 Key 已失效，冷却 6 小时避免每个请求都先撞一次 401
const COOLDOWN_SECONDS = 6 * 60 * 60;
const COOLDOWN_KEY = 'send_provider_cooldown:';

function domainOf(address) {
	const value = String(address || '');
	const index = value.lastIndexOf('@');
	return index > -1 ? value.slice(index + 1).toLowerCase() : '';
}

function recipientCount(params) {
	return (params.receiveEmail?.length || 0) + (params.cc?.length || 0) + (params.bcc?.length || 0);
}

const sendRouterService = {
	domainOf,

	async markCooldown(c, providerId) {
		await c.env.kv?.put(COOLDOWN_KEY + providerId, '1', { expirationTtl: COOLDOWN_SECONDS });
	},

	async clearCooldown(c, providerId) {
		await c.env.kv?.delete(COOLDOWN_KEY + providerId);
	},

	async isCooling(c, providerId) {
		return !!(await c.env.kv?.get(COOLDOWN_KEY + providerId));
	},

	/**
	 * 按优先级轮换发送。
	 * options.providerId：只试指定渠道（管理端测试用），跳过冷却检查并把真实错误抛给管理员。
	 * options.units：额度占用量，默认按收件人数。
	 */
	async send(c, params, options = {}) {
		const setting = await settingService.query(c);
		const domain = domainOf(params.accountEmail);

		let list = senderProviderConfig.routable(setting, domain);
		if (options.providerId) {
			list = list.filter(item => item.id === options.providerId);
			if (!list.length) {
				throw new BizError('该渠道未启用或未配置完整（Mailjet 需要 Key + Secret）', 400);
			}
		}
		if (!list.length) {
			throw new BizError(t('noSendProvider'));
		}

		const units = Number(options.units) || recipientCount(params) || 1;
		const attachments = await toBase64Attachments(params.attachments);

		const errors = [];
		let quotaBlocked = 0;

		for (const item of list) {
			if (!options.providerId && await this.isCooling(c, item.id)) {
				errors.push(new ProviderError(PROVIDER_ERROR.AUTH, `${item.id} is cooling down`, { provider: item.id }));
				continue;
			}

			const reservation = await sendQuotaService.reserve(c, item.id, item.config, units);
			if (!reservation.ok) {
				quotaBlocked += 1;
				continue;
			}

			try {
				const adapter = getProvider(item.id);
				const result = await adapter.send({
					config: item.credentials,
					params,
					attachments
				});
				return { id: result.id, provider: item.id };
			} catch (e) {
				const error = e instanceof ProviderError
					? e
					: new ProviderError(PROVIDER_ERROR.UNKNOWN, e?.message || String(e), { provider: item.id });

				// 明确没发出去才释放占额；网络超时可能已投递，保留占额更安全
				if (error.definitelyNotSent) {
					await sendQuotaService.release(c, item.id, reservation.reserved);
				}
				if (error.kind === PROVIDER_ERROR.AUTH) {
					await this.markCooldown(c, item.id);
				}
				// 收件人地址错误不重试、不切换，避免把同一封错信烧到所有渠道
				if (error.kind === PROVIDER_ERROR.RECIPIENT) {
					throw new BizError(error.message, 400);
				}
				console.warn(`[send-router] ${item.id} failed: ${error.kind} ${error.message}`);
				errors.push(error);
			}
		}

		if (options.providerId) {
			const first = errors[0];
			throw toBizError(first);
		}

		if (errors.length && errors.every(error => error.kind === PROVIDER_ERROR.AUTH)) {
			throw new BizError(t('sendProviderAuthFailed'), 502);
		}
		if (quotaBlocked > 0 && errors.length === 0) {
			throw new BizError(t('sendQuotaExhausted'), 429);
		}
		if (errors.length && errors.every(error => error.kind === PROVIDER_ERROR.QUOTA)) {
			throw new BizError(t('sendQuotaExhausted'), 429);
		}
		if (quotaBlocked > 0) {
			throw new BizError(t('sendQuotaExhausted'), 429);
		}
		throw new BizError(t('sendProviderUnavailable'), 503);
	}
};

function toBizError(error) {
	if (!error) return new BizError(t('sendProviderUnavailable'), 503);
	if (error.kind === PROVIDER_ERROR.QUOTA) return new BizError(t('sendQuotaExhausted'), 429);
	if (error.kind === PROVIDER_ERROR.AUTH) return new BizError(t('sendProviderAuthFailed'), 502);
	return new BizError(error.message || t('sendProviderUnavailable'), error.httpStatus >= 500 ? 502 : 400);
}

export default sendRouterService;

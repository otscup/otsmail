import { SEND_PROVIDERS, PROVIDER_IDS, defaultProviderConfig } from '../const/send-provider-const';
import BizError from '../error/biz-error';
import verifyUtils from '../utils/verify-utils';

const MASK = '******';

/**
 * 渠道配置只存在 setting.sender_providers（JSON）。这里集中处理：
 * 默认值补齐、排序、凭据解析、读写掩码。
 *
 * accounts 是新的凭据列表：[{ domain, apiKey, secret }]，一个渠道可以按域名配置多套 Key。
 * domain 为空表示通用 Key（匹配所有域名，作为兜底）。老版本的单组 apiKey/secret
 * 以及 Resend 的 setting.resend_tokens 都会在解析时折算成 accounts，保证升级后原配置继续可用。
 */
const senderProviderConfig = {

	normalizeDomain(domain) {
		return String(domain || '').trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '');
	},

	requiredFields(id) {
		return id === 'mailjet'
			? account => !!(account.apiKey && account.secret)
			: account => !!account.apiKey;
	},

	parse(raw, setting) {
		let value = raw;
		if (typeof value === 'string') {
			try { value = JSON.parse(value); } catch (e) { value = {}; }
		}
		if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};

		const defaults = defaultProviderConfig();
		const result = {};
		for (const id of PROVIDER_IDS) {
			const item = value[id] && typeof value[id] === 'object' ? value[id] : {};
			const defaultDailyLimit = defaults[id].dailyLimit;
			const defaultMonthlyLimit = defaults[id].monthlyLimit;
			// 手填额度优先；没填（或填回目录默认值）就跟随渠道目录的默认额度
			const dailyLimit = hasNumber(item.dailyLimit) ? Number(item.dailyLimit) : defaultDailyLimit;
			const monthlyLimit = hasNumber(item.monthlyLimit) ? Number(item.monthlyLimit) : defaultMonthlyLimit;
			result[id] = {
				...defaults[id],
				...item,
				enabled: item.enabled === undefined ? defaults[id].enabled : (item.enabled === true || item.enabled === 1),
				order: Number.isFinite(Number(item.order)) ? Number(item.order) : defaults[id].order,
				dailyLimit,
				monthlyLimit,
				defaultDailyLimit,
				defaultMonthlyLimit,
				dailyLimitManual: hasNumber(item.dailyLimit) && Number(item.dailyLimit) !== defaultDailyLimit,
				monthlyLimitManual: hasNumber(item.monthlyLimit) && Number(item.monthlyLimit) !== defaultMonthlyLimit,
				apiKey: String(item.apiKey || ''),
				secret: String(item.secret || ''),
				dnsRecords: item.dnsRecords && typeof item.dnsRecords === 'object' ? item.dnsRecords : {},
				accounts: Array.isArray(item.accounts) ? item.accounts.map(account => ({
					domain: this.normalizeDomain(account?.domain),
					apiKey: String(account?.apiKey || ''),
					secret: String(account?.secret || '')
				})) : []
			};
		}

		// Resend 的历史 Token 仍按域名存放，这里折算成 accounts（域名重复时以 accounts 为准）
		const tokens = setting?.resendTokens || {};
		for (const [domain, token] of Object.entries(tokens)) {
			const normalized = this.normalizeDomain(domain);
			if (!normalized || !token) continue;
			if (result.resend.accounts.some(account => account.domain === normalized)) continue;
			result.resend.accounts.push({ domain: normalized, apiKey: String(token), secret: '' });
		}

		// 老的单组 Key 折算成 domain 为空的通用凭据（没有同域条目时作为兜底）
		for (const id of PROVIDER_IDS) {
			const config = result[id];
			if ((!config.apiKey && !config.secret) || config.accounts.some(account => account.domain === '')) continue;
			config.accounts.push({ domain: '', apiKey: config.apiKey, secret: config.secret });
		}

		return result;
	},

	/** 某渠道的全部凭据：老的单组 apiKey/secret 折算成 domain 为空的通用 Key */
	accountsOf(id, config, setting) {
		const accounts = (config?.accounts || []).map(account => ({
			domain: this.normalizeDomain(account?.domain),
			apiKey: String(account?.apiKey || ''),
			secret: String(account?.secret || '')
		})).filter(account => account.domain || account.apiKey || account.secret);

		if (accounts.length === 0 && (config?.apiKey || config?.secret)) {
			accounts.push({ domain: '', apiKey: String(config.apiKey || ''), secret: String(config.secret || '') });
		}
		return accounts;
	},

	matchAccount(id, config, setting, domain) {
		const required = this.requiredFields(id);
		const accounts = this.accountsOf(id, config, setting);
		const target = this.normalizeDomain(domain);

		return accounts.find(account => account.domain === target && required(account))
			|| accounts.find(account => account.domain === '' && required(account))
			|| null;
	},

	credentials(id, config, setting, domain) {
		const account = this.matchAccount(id, config, setting, domain);
		if (account) return { apiKey: account.apiKey || '', secret: account.secret || '' };
		return { apiKey: '', secret: '' };
	},

	isConfigured(id, config, setting, domain) {
		const required = this.requiredFields(id);
		const accounts = this.accountsOf(id, config, setting);
		if (domain) return !!this.matchAccount(id, config, setting, domain);
		return accounts.some(required);
	},

	/** 参与轮换的渠道：启用 + 已配置，按 order 升序（同序按目录顺序） */
	routable(setting, domain) {
		const configs = this.parse(setting?.senderProviders, setting);
		return SEND_PROVIDERS
			.map((meta, index) => ({ meta, index, config: configs[meta.id] }))
			.filter(item => item.config.enabled && this.isConfigured(item.meta.id, item.config, setting, domain))
			.sort((a, b) => (a.config.order - b.config.order) || (a.index - b.index))
			.map(item => ({
				id: item.meta.id,
				meta: item.meta,
				config: item.config,
				credentials: this.credentials(item.meta.id, item.config, setting, domain)
			}));
	},

	hasAnyConfigured(setting, domain) {
		return this.routable(setting, domain).length > 0;
	},

	/** 管理端读：apiKey / secret 只回显前 12 位 */
	mask(setting) {
		const configs = this.parse(setting?.senderProviders, setting);
		const result = {};
		for (const id of PROVIDER_IDS) {
			const item = configs[id];
			result[id] = {
				...item,
				accounts: this.accountsOf(id, item, setting).map(account => ({
					domain: account.domain,
					apiKey: account.apiKey ? `${account.apiKey.slice(0, 12)}${MASK}` : '',
					secret: account.secret ? `${account.secret.slice(0, 12)}${MASK}` : ''
				})),
				apiKey: item.apiKey ? `${item.apiKey.slice(0, 12)}${MASK}` : '',
				secret: item.secret ? `${item.secret.slice(0, 12)}${MASK}` : '',
				configured: this.isConfigured(id, item, setting, '')
			};
		}
		return result;
	},

	/** 管理端写：占位值说明未修改；新的受限字段做基本校验，不把任意 JSON 写进库 */
	sanitizeInput(incoming, setting) {
		const oldConfigs = this.parse(setting?.senderProviders, setting);
		const defaults = defaultProviderConfig();
		let value = incoming;
		if (typeof value === 'string') {
			try { value = JSON.parse(value); } catch (e) { value = null; }
		}
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new BizError('Invalid sender provider config', 400);
		}

		const keepSecret = input => (typeof input === 'string' && input.includes(MASK) ? '' : String(input || ''));
		const result = {};

		for (const id of PROVIDER_IDS) {
			const item = value[id] && typeof value[id] === 'object' ? value[id] : null;
			if (!item) {
				result[id] = oldConfigs[id];
				continue;
			}

			const old = oldConfigs[id] || defaults[id];
			const apiKeyInput = keepSecret(item.apiKey);
			const secretInput = keepSecret(item.secret);

			let accounts = old.accounts || [];
			let apiKey = apiKeyInput || old.apiKey || '';
			let secret = secretInput || old.secret || '';

			if (item.accounts !== undefined) {
				const oldAccounts = this.accountsOf(id, old, setting);
				const usedDomains = new Set();
				accounts = (Array.isArray(item.accounts) ? item.accounts : []).map((account, index) => {
					const domain = this.normalizeDomain(account?.domain);
					if (domain && !verifyUtils.isDomain(domain)) {
						throw new BizError('Invalid sender domain', 400);
					}
					if (usedDomains.has(domain)) {
						throw new BizError('Duplicate sender domain', 400);
					}
					usedDomains.add(domain);

					const oldAccount = oldAccounts.find(row => row.domain === domain)
						|| oldAccounts[index]
						|| {};
					const rawKey = String(account?.apiKey || '');
					const rawSecret = String(account?.secret || '');

					return {
						domain,
						apiKey: rawKey.includes(MASK) ? (oldAccount.apiKey || '') : rawKey.trim(),
						secret: rawSecret.includes(MASK) ? (oldAccount.secret || '') : rawSecret.trim()
					};
				});
				// accounts 为唯一凭据来源，清空老字段避免又被折算成通用 Key
				apiKey = '';
				secret = '';
			}

			result[id] = {
				enabled: item.enabled === true || item.enabled === 1,
				order: clampNumber(item.order, 1, 99, old.order),
				// 留空 = 跟随渠道目录默认额度（不再把空值兜成 1）
				dailyLimit: optionalClampNumber(item.dailyLimit, 1, 100000),
				monthlyLimit: optionalClampNumber(item.monthlyLimit, 1, 3000000),
				apiKey,
				secret,
				accounts,
				dnsRecords: sanitizeDnsRecords(item.dnsRecords, old.dnsRecords)
			};
		}
		return result;
	}
};

function clampNumber(value, min, max, fallback) {
	const number = Number(value);
	if (!Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, Math.round(number)));
}

/** 留空（null / undefined / 空串）时返回 undefined，让 parse 回落到目录默认额度 */
function optionalClampNumber(value, min, max) {
	if (value === undefined || value === null || value === '') return undefined;
	const number = Number(value);
	if (!Number.isFinite(number)) return undefined;
	return Math.min(max, Math.max(min, Math.round(number)));
}

function hasNumber(value) {
	if (value === undefined || value === null || value === '') return false;
	return Number.isFinite(Number(value));
}

function sanitizeDnsRecords(incoming, old = {}) {
	if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return old || {};
	const result = {};
	for (const [key, value] of Object.entries(incoming)) {
		if (typeof value !== 'string') continue;
		result[String(key).slice(0, 120)] = value.trim().slice(0, 1000);
	}
	return result;
}

export default senderProviderConfig;

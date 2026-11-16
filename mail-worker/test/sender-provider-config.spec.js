import { describe, expect, it } from 'vitest';
import senderProviderConfig from '../src/service/sender-provider-config';
import { defaultProviderConfig } from '../src/const/send-provider-const';

function settingWith(overrides = {}, resendTokens = {}) {
	const config = defaultProviderConfig();
	Object.assign(config, overrides);
	return {
		senderProviders: JSON.stringify(config),
		resendTokens
	};
}

describe('senderProviderConfig', () => {
	it('空配置时只有 Resend 启用，顺序保持目录优先级', () => {
		const setting = { senderProviders: '{}', resendTokens: { 'otscup.com': 're_123' } };
		const list = senderProviderConfig.routable(setting, 'otscup.com');
		expect(list).toHaveLength(1);
		expect(list[0].id).toBe('resend');
		expect(list[0].credentials.apiKey).toBe('re_123');
	});

	it('未配置 Key 的渠道被跳过，启用顺序按 order 排序', () => {
		const setting = settingWith({
			resend: { enabled: true, order: 3 },
			brevo: { enabled: true, order: 1, apiKey: 'brevo-key' },
			mailjet: { enabled: true, order: 2, apiKey: 'mj-key', secret: '' },
			elastic: { enabled: true, order: 4, apiKey: 'elastic-key' }
		}, { 'otscup.com': 're_123' });

		const ids = senderProviderConfig.routable(setting, 'otscup.com').map(item => item.id);
		// mailjet 缺 secret 视为未配置
		expect(ids).toEqual(['brevo', 'resend', 'elastic']);
	});

	it('Resend 仍优先使用按域名存放的 token，其次才用渠道配置里的兜底 Key', () => {
		const setting = settingWith({ resend: { enabled: true, order: 1, apiKey: 'fallback' } }, { 'otscup.com': 'domain-token' });
		expect(senderProviderConfig.routable(setting, 'otscup.com')[0].credentials.apiKey).toBe('domain-token');
		expect(senderProviderConfig.routable(setting, 'other.com')[0].credentials.apiKey).toBe('fallback');
	});

	it('读取时掩码 Key，写回占位值不覆盖真实 Key', () => {
		const setting = settingWith({ brevo: { enabled: true, order: 2, apiKey: 'brevo-secret-key' } });
		const masked = senderProviderConfig.mask(setting);
		expect(masked.brevo.apiKey).toBe('brevo-secret******');

		const saved = senderProviderConfig.sanitizeInput({
			brevo: { enabled: true, order: 2, apiKey: 'brevo-secret******' }
		}, setting);
		expect(saved.brevo.apiKey).toBe('brevo-secret-key');
	});

	it('手填额度优先，等于目录默认值时仍标记为默认', () => {
		const setting = settingWith({
			brevo: { enabled: true, order: 2, apiKey: 'brevo-key', dailyLimit: 500, monthlyLimit: 9000 }
		});
		const configs = senderProviderConfig.parse(setting.senderProviders, setting);
		expect(configs.brevo.dailyLimit).toBe(500);
		expect(configs.brevo.dailyLimitManual).toBe(true);
		expect(configs.brevo.monthlyLimit).toBe(9000);
		expect(configs.brevo.monthlyLimitManual).toBe(false);
		expect(configs.brevo.defaultDailyLimit).toBe(300);
	});

	it('额度留空时保存不写库，读取回落到渠道目录默认额度', () => {
		const setting = settingWith({
			brevo: { enabled: true, order: 2, apiKey: 'brevo-key', dailyLimit: 500 }
		});
		const saved = senderProviderConfig.sanitizeInput({
			brevo: { enabled: true, order: 2, apiKey: 'brevo-key', dailyLimit: null, monthlyLimit: '' }
		}, setting);
		expect(saved.brevo.dailyLimit).toBeUndefined();
		expect(saved.brevo.monthlyLimit).toBeUndefined();

		const roundTrip = senderProviderConfig.parse(JSON.stringify({ brevo: saved.brevo }), {});
		expect(roundTrip.brevo.dailyLimit).toBe(300);
		expect(roundTrip.brevo.monthlyLimit).toBe(9000);
		expect(roundTrip.brevo.dailyLimitManual).toBe(false);
	});
});

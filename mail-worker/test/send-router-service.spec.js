import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map();

vi.mock('../src/service/setting-service', () => ({
	default: { query: vi.fn() }
}));

vi.mock('../src/service/send-quota-service', () => ({
	default: { reserve: vi.fn(), release: vi.fn(), usage: vi.fn() }
}));

vi.mock('../src/service/provider/attachment', () => ({
	toBase64Attachments: vi.fn(async () => [])
}));

vi.mock('../src/service/provider', () => ({
	getProvider: vi.fn()
}));

import sendRouterService from '../src/service/send-router-service';
import settingService from '../src/service/setting-service';
import sendQuotaService from '../src/service/send-quota-service';
import { getProvider } from '../src/service/provider';
import { ProviderError, PROVIDER_ERROR } from '../src/service/provider/provider-error';

const resendSend = vi.fn();
const brevoSend = vi.fn();

function context() {
	return {
		env: {
			kv: {
				get: vi.fn(async key => kvStore.get(key) ?? null),
				put: vi.fn(async (key, value) => { kvStore.set(key, value); }),
				delete: vi.fn(async key => { kvStore.delete(key); })
			}
		}
	};
}

function params() {
	return {
		name: 'Sender',
		accountEmail: 'me@otscup.com',
		receiveEmail: ['a@example.com', 'b@example.com'],
		cc: ['c@example.com'],
		bcc: [],
		subject: 'hello',
		text: 'text',
		html: '<p>text</p>',
		attachments: []
	};
}

function setting() {
	return {
		resendTokens: { 'otscup.com': 're_123' },
		senderProviders: JSON.stringify({
			resend: { enabled: true, order: 1, dailyLimit: 100, monthlyLimit: 3000 },
			brevo: { enabled: true, order: 2, apiKey: 'brevo-key', dailyLimit: 300, monthlyLimit: 9000 }
		})
	};
}

describe('sendRouterService', () => {
	beforeEach(() => {
		kvStore.clear();
		vi.clearAllMocks();
		settingService.query.mockResolvedValue(setting());
		sendQuotaService.reserve.mockResolvedValue({ ok: true, reserved: [{ period: '2026-11-14', amount: 3 }] });
		sendQuotaService.release.mockResolvedValue(undefined);
		resendSend.mockResolvedValue({ id: 're-id' });
		brevoSend.mockResolvedValue({ id: 'brevo-id' });
		getProvider.mockImplementation(id => {
			if (id === 'resend') return { id, isConfigured: () => true, send: resendSend };
			if (id === 'brevo') return { id, isConfigured: () => true, send: brevoSend };
			return null;
		});
	});

	it('只配 Resend 时走 Resend，并按收件人数占额', async () => {
		settingService.query.mockResolvedValue({
			resendTokens: { 'otscup.com': 're_123' },
			senderProviders: '{}'
		});

		const result = await sendRouterService.send(context(), params());

		expect(result).toEqual({ id: 're-id', provider: 'resend' });
		expect(sendQuotaService.reserve).toHaveBeenCalledWith(expect.anything(), 'resend', expect.anything(), 3);
		expect(brevoSend).not.toHaveBeenCalled();
	});

	it('Resend 额度用完自动切 Brevo', async () => {
		sendQuotaService.reserve
			.mockResolvedValueOnce({ ok: false, period: '2026-11-14', limit: 100 })
			.mockResolvedValueOnce({ ok: true, reserved: [] });

		const result = await sendRouterService.send(context(), params());

		expect(result.provider).toBe('brevo');
		expect(resendSend).not.toHaveBeenCalled();
	});

	it('Resend 5xx 时释放占额并切 Brevo', async () => {
		resendSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.TRANSIENT, 'boom', { provider: 'resend', httpStatus: 503 }));

		const result = await sendRouterService.send(context(), params());

		expect(result.provider).toBe('brevo');
		expect(sendQuotaService.release).toHaveBeenCalledTimes(1);
	});

	it('网络异常可能已投递，保留占额但仍切下一个渠道', async () => {
		resendSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.TRANSIENT, 'timeout', { provider: 'resend' }));

		const result = await sendRouterService.send(context(), params());

		expect(result.provider).toBe('brevo');
		expect(sendQuotaService.release).not.toHaveBeenCalled();
	});

	it('认证失败标记冷却并继续下一个渠道', async () => {
		resendSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.AUTH, 'bad key', { provider: 'resend', httpStatus: 401 }));
		const c = context();

		const result = await sendRouterService.send(c, params());

		expect(result.provider).toBe('brevo');
		expect(c.env.kv.put).toHaveBeenCalledWith('send_provider_cooldown:resend', '1', expect.anything());
	});

	it('收件人错误不重试、不切换', async () => {
		resendSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.RECIPIENT, 'invalid recipient', { provider: 'resend', httpStatus: 400 }));

		await expect(sendRouterService.send(context(), params())).rejects.toThrow('invalid recipient');
		expect(brevoSend).not.toHaveBeenCalled();
	});

	it('全部渠道满额返回统一可读提示', async () => {
		sendQuotaService.reserve.mockResolvedValue({ ok: false, period: '2026-11-14', limit: 100 });

		await expect(sendRouterService.send(context(), params())).rejects.toMatchObject({ code: 429 });
	});

	it('全部渠道认证失败返回管理员可读错误', async () => {
		resendSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.AUTH, 'bad key', { provider: 'resend', httpStatus: 401 }));
		brevoSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.AUTH, 'bad key', { provider: 'brevo', httpStatus: 401 }));

		await expect(sendRouterService.send(context(), params())).rejects.toMatchObject({ code: 502 });
	});

	it('指定渠道测试时把原始错误抛给管理员', async () => {
		resendSend.mockRejectedValue(new ProviderError(PROVIDER_ERROR.QUOTA, 'quota', { provider: 'resend', httpStatus: 429 }));

		await expect(sendRouterService.send(context(), params(), { providerId: 'resend' })).rejects.toMatchObject({ code: 429 });
		expect(brevoSend).not.toHaveBeenCalled();
	});
});

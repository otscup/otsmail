import { beforeEach, describe, expect, it, vi } from 'vitest';

const resendSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
	Resend: class {
		constructor() {
			this.emails = { send: resendSend };
		}
	}
}));

import resendProvider from '../src/service/provider/resend-provider';
import brevoProvider from '../src/service/provider/brevo-provider';
import mailjetProvider from '../src/service/provider/mailjet-provider';
import elasticProvider from '../src/service/provider/elastic-provider';
import smtp2goProvider from '../src/service/provider/smtp2go-provider';
import { toBase64Attachments } from '../src/service/provider/attachment';
import { PROVIDER_ERROR } from '../src/service/provider/provider-error';

const params = {
	name: 'Sender',
	accountEmail: 'me@otscup.com',
	receiveEmail: ['a@example.com'],
	cc: [],
	bcc: [],
	subject: 'hello',
	text: 'text',
	html: '<p>text</p>',
	attachments: [],
	sendType: 'send'
};

function httpResponse(status, body) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
	};
}

describe('发信渠道适配器', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it('Resend 429 归类为 quota', async () => {
		resendSend.mockResolvedValue({ data: null, error: { statusCode: 429, name: 'rate_limit_exceeded', message: 'too many requests' } });
		await expect(resendProvider.send({ config: { apiKey: 'k' }, params, attachments: [] }))
			.rejects.toMatchObject({ kind: PROVIDER_ERROR.QUOTA });
	});

	it('Resend 无效 Key 归类为 auth', async () => {
		resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, name: 'missing_api_key', message: 'API key is invalid' } });
		await expect(resendProvider.send({ config: { apiKey: 'k' }, params, attachments: [] }))
			.rejects.toMatchObject({ kind: PROVIDER_ERROR.AUTH });
	});

	it('Brevo 成功返回 messageId', async () => {
		global.fetch.mockResolvedValue(httpResponse(201, { messageId: '<abc@brevo>' }));
		const result = await brevoProvider.send({ config: { apiKey: 'k' }, params, attachments: [] });
		expect(result.id).toBe('<abc@brevo>');
	});

	it('Brevo 429 归类为 quota', async () => {
		global.fetch.mockResolvedValue(httpResponse(429, { code: 'too_many_requests', message: 'daily limit' }));
		await expect(brevoProvider.send({ config: { apiKey: 'k' }, params, attachments: [] }))
			.rejects.toMatchObject({ kind: PROVIDER_ERROR.QUOTA, definitelyNotSent: true });
	});

	it('Mailjet 200 但 Messages[0].Status=error 时按内容分类', async () => {
		global.fetch.mockResolvedValue(httpResponse(200, {
			Messages: [{ Status: 'error', ErrorCode: 'mj-0002', ErrorMessage: 'invalid email address' }]
		}));
		await expect(mailjetProvider.send({ config: { apiKey: 'k', secret: 's' }, params, attachments: [] }))
			.rejects.toMatchObject({ kind: PROVIDER_ERROR.RECIPIENT });
	});

	it('Mailjet 成功取 To[0].MessageID', async () => {
		global.fetch.mockResolvedValue(httpResponse(200, { Messages: [{ Status: 'success', To: [{ MessageID: 12345 }] }] }));
		const result = await mailjetProvider.send({ config: { apiKey: 'k', secret: 's' }, params, attachments: [] });
		expect(result.id).toBe('12345');
	});

	it('Elastic 5xx 归类为 transient 且明确未发出', async () => {
		global.fetch.mockResolvedValue(httpResponse(503, 'service unavailable'));
		await expect(elasticProvider.send({ config: { apiKey: 'k' }, params, attachments: [] }))
			.rejects.toMatchObject({ kind: PROVIDER_ERROR.TRANSIENT, definitelyNotSent: true });
	});

	it('SMTP2GO 200 + error_code 也能识别认证失败', async () => {
		global.fetch.mockResolvedValue(httpResponse(200, { data: { error_code: 'E_ApiKey', error: 'Invalid API key' } }));
		await expect(smtp2goProvider.send({ config: { apiKey: 'k' }, params, attachments: [] }))
			.rejects.toMatchObject({ kind: PROVIDER_ERROR.AUTH });
	});

	it('SMTP2GO 成功返回 email_id', async () => {
		global.fetch.mockResolvedValue(httpResponse(200, { data: { succeeded: 1, email_id: 'smtp-id' } }));
		const result = await smtp2goProvider.send({ config: { apiKey: 'k' }, params, attachments: [] });
		expect(result.id).toBe('smtp-id');
	});

	it('附件统一转 base64 并去掉 data: 前缀', async () => {
		const list = await toBase64Attachments([
			{ filename: 'a.txt', contentType: 'text/plain', content: 'data:text/plain;base64,aGk=' }
		]);
		expect(list[0]).toMatchObject({ filename: 'a.txt', contentType: 'text/plain', content: 'aGk=' });
	});
});

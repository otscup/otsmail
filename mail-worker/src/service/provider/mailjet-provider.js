import ProviderError, { PROVIDER_ERROR, classifyHttpStatus } from './provider-error';
import { sanitizeHeaderValue } from '../../utils/header-utils';

const API_URL = 'https://api.mailjet.com/v3.1/send';

// Mailjet 部分错误以 HTTP 200 + Messages[0].Status=error 返回
function mapMessageError(providerStatus) {
	const code = String(providerStatus?.ErrorCode || '');
	const message = String(providerStatus?.ErrorMessage || 'mailjet send failed');
	const lower = message.toLowerCase();

	if (/mj-0003|rate|limit|quota/.test(`${code} ${lower}`)) {
		return new ProviderError(PROVIDER_ERROR.QUOTA, message, { provider: 'mailjet', httpStatus: 429 });
	}
	if (/mj-0001|api key|authentication|unauthorized/.test(`${code} ${lower}`)) {
		return new ProviderError(PROVIDER_ERROR.AUTH, message, { provider: 'mailjet', httpStatus: 401 });
	}
	return new ProviderError(PROVIDER_ERROR.RECIPIENT, message, { provider: 'mailjet', httpStatus: 400 });
}

export default {
	id: 'mailjet',

	isConfigured(config) {
		return !!(config?.apiKey && config?.secret);
	},

	async send({ config, params, attachments = [] }) {
		const message = {
			From: { Email: params.accountEmail, Name: params.name },
			To: params.receiveEmail.map(address => ({ Email: address })),
			Subject: params.subject,
			TextPart: params.text || '',
			HTMLPart: params.html || ''
		};

		if (params.cc?.length) message.Cc = params.cc.map(address => ({ Email: address }));
		if (params.bcc?.length) message.Bcc = params.bcc.map(address => ({ Email: address }));

		const inline = attachments.filter(item => item.contentId);
		const normal = attachments.filter(item => !item.contentId);
		if (normal.length) {
			message.Attachments = normal.map(item => ({
				ContentType: item.contentType,
				Filename: item.filename,
				Base64Content: item.content
			}));
		}
		if (inline.length) {
			message.InlinedAttachments = inline.map(item => ({
				ContentType: item.contentType,
				Filename: item.filename,
				Base64Content: item.content,
				ContentID: item.contentId
			}));
		}

		if (params.sendType === 'reply' && params.messageId) {
			const messageId = sanitizeHeaderValue(params.messageId);
			message.Headers = { 'In-Reply-To': messageId, References: messageId };
		}

		let response;
		try {
			response = await fetch(API_URL, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json',
					authorization: 'Basic ' + btoa(`${config.apiKey}:${config.secret}`)
				},
				body: JSON.stringify({ Messages: [message] })
			});
		} catch (e) {
			throw new ProviderError(PROVIDER_ERROR.TRANSIENT, `mailjet network error: ${e.message}`, { provider: 'mailjet' });
		}

		const text = await response.text();
		let data = {};
		try { data = JSON.parse(text); } catch (e) { /* 非 JSON 错误体按原文分类 */ }

		if (!response.ok) throw classifyHttpStatus(response.status, text || data, 'mailjet');

		const result = data?.Messages?.[0];
		if (result?.Status === 'error') throw mapMessageError(result);
		const id = result?.To?.[0]?.MessageID || result?.To?.[0]?.MessageUUID;
		if (!id) throw new ProviderError(PROVIDER_ERROR.UNKNOWN, 'mailjet returned no message id', { provider: 'mailjet', httpStatus: response.status });

		return { id: String(id) };
	}
};

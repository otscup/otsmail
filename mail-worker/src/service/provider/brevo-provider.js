import ProviderError, { PROVIDER_ERROR, classifyHttpStatus } from './provider-error';
import { sanitizeHeaderValue } from '../../utils/header-utils';

const API_URL = 'https://api.brevo.com/v3/smtp/email';

export default {
	id: 'brevo',

	isConfigured(config) {
		return !!config?.apiKey;
	},

	async send({ config, params, attachments = [] }) {
		const body = {
			sender: { email: params.accountEmail, name: params.name },
			to: params.receiveEmail.map(address => ({ email: address })),
			subject: params.subject,
			htmlContent: params.html || '',
			textContent: params.text || ''
		};

		if (params.cc?.length) body.cc = params.cc.map(address => ({ email: address }));
		if (params.bcc?.length) body.bcc = params.bcc.map(address => ({ email: address }));

		if (attachments.length) {
			body.attachment = attachments.map(item => ({ name: item.filename, content: item.content }));
		}

		if (params.sendType === 'reply' && params.messageId) {
			const messageId = sanitizeHeaderValue(params.messageId);
			body.headers = { 'In-Reply-To': messageId, References: messageId };
		}

		let response;
		try {
			response = await fetch(API_URL, {
				method: 'POST',
				headers: {
					'api-key': config.apiKey,
					'content-type': 'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify(body)
			});
		} catch (e) {
			throw new ProviderError(PROVIDER_ERROR.TRANSIENT, `brevo network error: ${e.message}`, { provider: 'brevo' });
		}

		const text = await response.text();
		let data = {};
		try { data = JSON.parse(text); } catch (e) { /* 非 JSON 错误体按原文分类 */ }

		if (!response.ok) throw classifyHttpStatus(response.status, text || data, 'brevo');
		if (!data.messageId) {
			throw new ProviderError(PROVIDER_ERROR.UNKNOWN, 'brevo returned no messageId', { provider: 'brevo', httpStatus: response.status });
		}

		return { id: data.messageId };
	}
};

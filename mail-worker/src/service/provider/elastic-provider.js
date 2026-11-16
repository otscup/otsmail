import ProviderError, { PROVIDER_ERROR, classifyHttpStatus } from './provider-error';
import { sanitizeHeaderValue } from '../../utils/header-utils';

const API_URL = 'https://api.elasticemail.com/v4/emails/transactional';

export default {
	id: 'elastic',

	isConfigured(config) {
		return !!config?.apiKey;
	},

	async send({ config, params, attachments = [] }) {
		const body = [];

		if (params.text) body.push({ ContentType: 'PlainText', Charset: 'utf-8', Content: params.text });
		body.push({ ContentType: 'HTML', Charset: 'utf-8', Content: params.html || params.text || '' });

		const content = {
			From: params.name ? `${params.name} <${params.accountEmail}>` : params.accountEmail,
			Subject: params.subject,
			Body: body
		};

		if (attachments.length) {
			content.Attachments = attachments.map(item => ({
				Name: item.filename,
				ContentType: item.contentType,
				Content: item.content
			}));
		}

		if (params.sendType === 'reply' && params.messageId) {
			const messageId = sanitizeHeaderValue(params.messageId);
			content.Headers = { 'In-Reply-To': messageId, References: messageId };
		}

		const payload = {
			Recipients: params.receiveEmail.map(address => ({ Email: address })),
			Content: content
		};
		if (params.cc?.length) payload.Recipients.push(...params.cc.map(address => ({ Email: address })));
		if (params.bcc?.length) payload.Recipients.push(...params.bcc.map(address => ({ Email: address })));

		let response;
		try {
			response = await fetch(API_URL, {
				method: 'POST',
				headers: {
					'X-ElasticEmail-ApiKey': config.apiKey,
					'content-type': 'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify(payload)
			});
		} catch (e) {
			throw new ProviderError(PROVIDER_ERROR.TRANSIENT, `elastic network error: ${e.message}`, { provider: 'elastic' });
		}

		const text = await response.text();
		let data = {};
		try { data = JSON.parse(text); } catch (e) { /* 非 JSON 错误体按原文分类 */ }

		if (!response.ok) throw classifyHttpStatus(response.status, text || data, 'elastic');

		const id = data?.MessageID || data?.TransactionID;
		if (!id) throw new ProviderError(PROVIDER_ERROR.UNKNOWN, 'elastic returned no message id', { provider: 'elastic', httpStatus: response.status });

		return { id };
	}
};

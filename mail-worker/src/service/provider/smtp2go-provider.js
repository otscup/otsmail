import ProviderError, { PROVIDER_ERROR } from './provider-error';
import { sanitizeHeaderValue } from '../../utils/header-utils';

const API_URL = 'https://api.smtp2go.com/v3/email/send';

// SMTP2GO 大部分业务错误以 HTTP 200 + data.error_code 返回
function mapBodyError(data) {
	const code = String(data?.error_code || '');
	const message = String(data?.error || 'smtp2go send failed');
	const lower = message.toLowerCase();

	if (/api.?key|auth|permission|unauthorized/i.test(`${code} ${lower}`)) {
		return new ProviderError(PROVIDER_ERROR.AUTH, message, { provider: 'smtp2go', httpStatus: 401 });
	}
	if (/quota|limit|exceed/i.test(`${code} ${lower}`)) {
		return new ProviderError(PROVIDER_ERROR.QUOTA, message, { provider: 'smtp2go', httpStatus: 429 });
	}
	return new ProviderError(PROVIDER_ERROR.RECIPIENT, message, { provider: 'smtp2go', httpStatus: 400 });
}

export default {
	id: 'smtp2go',

	isConfigured(config) {
		return !!config?.apiKey;
	},

	async send({ config, params, attachments = [] }) {
		const body = {
			api_key: config.apiKey,
			sender: params.name ? `${params.name} <${params.accountEmail}>` : params.accountEmail,
			to: [...params.receiveEmail],
			subject: params.subject
		};

		if (params.text) body.text_body = params.text;
		if (params.html) body.html_body = params.html;
		if (params.cc?.length) body.cc = [...params.cc];
		if (params.bcc?.length) body.bcc = [...params.bcc];

		const inline = attachments.filter(item => item.contentId);
		const normal = attachments.filter(item => !item.contentId);
		if (normal.length) {
			body.attachments = normal.map(item => ({
				filename: item.filename,
				fileblob: item.content,
				mimetype: item.contentType
			}));
		}
		if (inline.length) {
			body.inline_images = inline.map(item => ({
				filename: item.filename,
				fileblob: item.content,
				mimetype: item.contentType,
				cid: item.contentId
			}));
		}

		if (params.sendType === 'reply' && params.messageId) {
			const messageId = sanitizeHeaderValue(params.messageId);
			body.custom_headers = [
				{ header: 'In-Reply-To', value: messageId },
				{ header: 'References', value: messageId }
			];
		}

		let response;
		try {
			response = await fetch(API_URL, {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify(body)
			});
		} catch (e) {
			throw new ProviderError(PROVIDER_ERROR.TRANSIENT, `smtp2go network error: ${e.message}`, { provider: 'smtp2go' });
		}

		const text = await response.text();
		let payload = {};
		try { payload = JSON.parse(text); } catch (e) { /* 非 JSON 错误体按原文分类 */ }

		if (response.status === 401 || response.status === 403) {
			throw new ProviderError(PROVIDER_ERROR.AUTH, 'smtp2go authentication failed', { provider: 'smtp2go', httpStatus: response.status });
		}
		if (response.status === 429) {
			throw new ProviderError(PROVIDER_ERROR.QUOTA, 'smtp2go quota exceeded', { provider: 'smtp2go', httpStatus: 429 });
		}
		if (!response.ok) {
			if (response.status >= 500) {
				throw new ProviderError(PROVIDER_ERROR.TRANSIENT, `smtp2go server error (${response.status})`, { provider: 'smtp2go', httpStatus: response.status });
			}
			throw new ProviderError(PROVIDER_ERROR.RECIPIENT, `smtp2go rejected the message: ${text.slice(0, 200)}`, { provider: 'smtp2go', httpStatus: response.status });
		}

		const data = payload?.data || {};
		if (data.error_code) throw mapBodyError(data);
		if (!Number(data.succeeded)) {
			throw new ProviderError(PROVIDER_ERROR.RECIPIENT, 'smtp2go sent 0 messages', { provider: 'smtp2go', httpStatus: 400 });
		}

		return { id: String(data.email_id || data.email_id_list?.[0] || '') };
	}
};

import { Resend } from 'resend';
import ProviderError, { PROVIDER_ERROR } from './provider-error';
import { sanitizeHeaderValue } from '../../utils/header-utils';

function mapError(error) {
	const status = Number(error?.statusCode) || 0;
	const name = String(error?.name || '');
	const message = String(error?.message || '');

	if (status === 429 || name.includes('rate_limit') || /rate limit|quota/i.test(message)) {
		return new ProviderError(PROVIDER_ERROR.QUOTA, 'resend quota exceeded', { provider: 'resend', httpStatus: status || 429 });
	}
	if (status === 401 || status === 403 || name.includes('api_key') || /api key/i.test(message)) {
		return new ProviderError(PROVIDER_ERROR.AUTH, 'resend authentication failed', { provider: 'resend', httpStatus: status || 401 });
	}
	if (status === 422 || name === 'validation_error') {
		return new ProviderError(PROVIDER_ERROR.RECIPIENT, `resend rejected the message: ${message}`, { provider: 'resend', httpStatus: status });
	}
	if (status >= 500) {
		return new ProviderError(PROVIDER_ERROR.TRANSIENT, `resend server error (${status})`, { provider: 'resend', httpStatus: status });
	}
	return new ProviderError(PROVIDER_ERROR.UNKNOWN, message || 'resend send failed', { provider: 'resend', httpStatus: status });
}

export default {
	id: 'resend',

	isConfigured(config) {
		return !!config?.apiKey;
	},

	async send({ config, params, attachments = [] }) {
		const resend = new Resend(config.apiKey);

		const sendForm = {
			from: `${params.name} <${params.accountEmail}>`,
			to: [...params.receiveEmail],
			subject: params.subject,
			text: params.text,
			html: params.html
		};

		if (attachments.length) {
			sendForm.attachments = attachments.map(item => ({
				filename: item.filename,
				content: item.content,
				contentType: item.contentType,
				...(item.contentId ? { contentId: item.contentId } : {})
			}));
		}

		if (params.cc?.length) sendForm.cc = [...params.cc];
		if (params.bcc?.length) sendForm.bcc = [...params.bcc];

		if (params.sendType === 'reply' && params.messageId) {
			const messageId = sanitizeHeaderValue(params.messageId);
			sendForm.headers = { 'in-reply-to': messageId, references: messageId };
		}

		const { data, error } = await resend.emails.send(sendForm);
		if (error) throw mapError(error);
		if (!data?.id) throw new ProviderError(PROVIDER_ERROR.UNKNOWN, 'resend returned no id', { provider: 'resend' });

		return { id: data.id };
	}
};

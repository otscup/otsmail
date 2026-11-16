/**
 * 渠道错误分类。路由层只认 kind，不读各家原始错误结构。
 *   quota     额度用完（429 / daily limit）→ 切下一个渠道
 *   auth      Key 失效 → 标记冷却后切下一个渠道
 *   recipient 收件人地址等参数错误 → 不重试、不切换，直接返回
 *   transient 5xx / 网络错误 → 切下一个渠道
 *   unknown   未识别 → 切下一个渠道
 */
export const PROVIDER_ERROR = {
	QUOTA: 'quota',
	AUTH: 'auth',
	RECIPIENT: 'recipient',
	TRANSIENT: 'transient',
	UNKNOWN: 'unknown'
};

export class ProviderError extends Error {
	constructor(kind, message, options = {}) {
		super(message);
		this.name = 'ProviderError';
		this.kind = kind;
		this.provider = options.provider || '';
		// 只有拿到了 HTTP 状态码才说明请求被明确拒绝；网络异常可能已经投递，不能释放额度占位
		this.httpStatus = options.httpStatus || 0;
		this.definitelyNotSent = options.definitelyNotSent ?? !!this.httpStatus;
	}
}

export function classifyHttpStatus(status, body, provider) {
	const text = typeof body === 'string' ? body : JSON.stringify(body || {});
	const lower = text.toLowerCase();

	if (status === 429 || lower.includes('rate limit') || lower.includes('daily limit') || lower.includes('quota') || lower.includes('too many requests')) {
		return new ProviderError(PROVIDER_ERROR.QUOTA, `${provider} quota exceeded`, { provider, httpStatus: status });
	}

	if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('invalid_api_key') || lower.includes('unauthorized') || lower.includes('authentication')) {
		return new ProviderError(PROVIDER_ERROR.AUTH, `${provider} authentication failed`, { provider, httpStatus: status });
	}

	if (status === 400 || status === 422) {
		return new ProviderError(PROVIDER_ERROR.RECIPIENT, `${provider} rejected the message: ${text.slice(0, 200)}`, { provider, httpStatus: status });
	}

	if (status >= 500) {
		return new ProviderError(PROVIDER_ERROR.TRANSIENT, `${provider} server error (${status})`, { provider, httpStatus: status });
	}

	return new ProviderError(PROVIDER_ERROR.UNKNOWN, `${provider} failed (${status})`, { provider, httpStatus: status });
}

export default ProviderError;

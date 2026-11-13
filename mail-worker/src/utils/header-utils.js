/**
 * 邮件头字段值来自不可信输入（例如回复时引用的 Message-ID）。
 * 去掉 CR/LF，避免下游 MIME 组装器把换行当成新头的开始。
 */
export function sanitizeHeaderValue(value) {
	return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export default {sanitizeHeaderValue};

// 轻量 SSRF 兜底：只拦明显的本机/内网字面量，不处理 DNS 重绑定。
export function isPrivateUrl(input) {
	try {
		const url = new URL(String(input));
		const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
		if (!host || host === 'localhost' || host.endsWith('.local') || host === '::1') return true;
		if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$)/.test(host)) return true;
		if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
		if (/^(fc|fd|fe80)/.test(host)) return true;
		return false;
	} catch {
		return true;
	}
}

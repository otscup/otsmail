// 轻量 SSRF 兜底：拦本机/内网/保留地址字面量。不做 DNS 解析，域名解析到内网的情况由 proxy-service 处理。
export function isPrivateUrl(input) {
	try {
		const url = new URL(String(input));
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
		const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
		if (!host) return true;
		if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
		if (host === '::1' || host === '::') return true;
		if (/^(fc|fd|fe80|ff)/.test(host)) return true;
		// IPv4 映射的 IPv6（::ffff:127.0.0.1 或 URL 规范化后的 ::ffff:7f00:1）一律拒绝
		if (host.includes('::ffff:')) return true;
		// IPv4 映射的 IPv6，例如 ::ffff:127.0.0.1
		const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
		const v4 = mapped ? mapped[1] : host;
		if (!/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return false;
		const [a, b] = v4.split('.').map(Number);
		if (a === 0 || a === 10 || a === 127) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true;
		if (a === 198 && (b === 18 || b === 19)) return true;
		if (a >= 224) return true;
		return false;
	} catch {
		return true;
	}
}

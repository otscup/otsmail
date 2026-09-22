const emailRules = {

	/**
	 * 判定一封邮件是否属于「Google/Gmail 来源」（A 类语义，架构 v1.2）。
	 * 用于 N-02 分流：Google/Gmail 来源邮件只 TG+保存，跳过 forward 转发（不送 Outlook/QQ）。
	 *
	 * 命中任一即 true（不看 From 是否 Gmail，避免朋友发到你 Gmail 再转发的场景被漏判）：
	 *   1. 来源域：from.address 的域名 ∈ {google.com, gmail.com, googlemail.com}（覆盖 noreply-accounts@google.com 等 Google 直发）
	 *   2. 转发签名头：扫描 GMAIL_FORWARD_HEADERS 清单（默认 X-Gm-Original-From / X-Google-Smtp-Source / X-Google-Original-From），命中且值可信
	 *
	 * 防伪造（QA + 产品硬性要求）：
	 *   - 来源域判定要求【完整域名匹配】（非子串），普通邮件带伪 @google.com 来源不误判；
	 *   - 签名头判定要求【值可信】：X-Google-Smtp-Source 值长度>=16（Gmail 真实值为长令牌），
	 *     X-Gm-Original-From / X-Google-Original-From 值须为合法邮箱格式；空/畸形值不视为可信。
	 *
	 * 开关 SKIP_FORWARD_GMAIL_FORWARDED 必须字符串容错（=== true || === 'true'）：
	 *   Worker --var 注入时为字符串 "true"，严格布尔判 false = P0 bug（对齐 linuxdo_switch 模式）。
	 *   开关关闭时恒返回 false（零回归）。
	 *
	 * @param {object} email - PostalMime 解析后的 email 对象（含 from.address、headers:[{key,value}]）
	 * @param {object} env - Worker env（读 SKIP_FORWARD_GMAIL_FORWARDED / GMAIL_FORWARD_HEADERS）
	 * @returns {boolean}
	 */
	isGoogleSourcedEmail(email, env, toEmail) {

		// 开关关闭或未开启：不做任何分流，恒 false（零回归）——字符串容错
		const flag = env && env.SKIP_FORWARD_GMAIL_FORWARDED;
		if (flag !== true && flag !== 'true') {
			return false;
		}

		// 判定 0（架构 §4.11 v1.3 主信号）：收件地址命中 Gmail 定向通道地址
		// GMAIL_ROUTING_INBOX（默认 gmail@otscup.com）。该地址不对外公开，整体视为
		// "Google 转发通道"→ 只进 TG 不转发。即使 From 是 163 等非 Google 域也归此通道
		// （419 现成代价样本，豆豆已接受）。
		const routingInbox = (env && env.GMAIL_ROUTING_INBOX) || 'gmail@otscup.com';
		if (typeof toEmail === 'string' && toEmail.toLowerCase() === routingInbox.toLowerCase()) {
			return true;
		}

		// 判定 1：来源域完整匹配（辅助）
		if (email && email.from && this.isGoogleDomain(email.from.address)) {
			return true;
		}

		// 判定 2：转发签名头（辅助，不依赖——CF 跨域可能剥头且 D1 无 headers 列）
		if (this.hasTrustedGmailHeader(email && email.headers, env)) {
			return true;
		}

		return false;
	},

	/**
	 * 兼容别名（架构 §4.11 允许保留旧函数名）：
	 * isGmailForwardedEmail(headers, env) 升为 isGoogleSourcedEmail 的转发。
	 * 注：旧签名只收 headers；为兼容，若传入的是 email 对象（含 from），走完整判定；
	 * 若只传 headers 数组，则仅做签名头一层判定（来源域无 email 不可判）。
	 */
	isGmailForwardedEmail(emailOrHeaders, env) {

		// 数组 = 只传了 headers（旧调用）：退化为仅签名头判定
		if (Array.isArray(emailOrHeaders)) {
			return this.hasTrustedGmailHeader(emailOrHeaders, env);
		}

		return this.isGoogleSourcedEmail(emailOrHeaders, env);
	},

	/**
	 * 来源域是否为 Google/Gmail（完整域名匹配，非子串）。
	 * 从 from.address 提取主机部分（@ 之后）精确比对，避免 "notgmail.com"/"gmail.com.evil.cn" 之类子串/伪域误判。
	 */
	isGoogleDomain(address) {

		if (typeof address !== 'string' || address.length === 0) {
			return false;
		}

		const at = address.lastIndexOf('@');
		if (at < 0) {
			return false;
		}

		const domain = address.slice(at + 1).trim().toLowerCase();

		return domain === 'google.com' || domain === 'gmail.com' || domain === 'googlemail.com';
	},

	/**
	 * 是否命中可信的 Gmail/Google 转发签名头。
	 * 结构：headers = [{ key, value }]（postal-mime，key 已小写）。
	 * 命中任一签名头且值可信即 true。
	 */
	hasTrustedGmailHeader(headers, env) {

		if (!Array.isArray(headers) || headers.length === 0) {
			return false;
		}

		// 可配置的签名头清单（逗号分隔），默认三个 Gmail 转发专属头
		const defaultHeaders = 'X-Gm-Original-From,X-Google-Smtp-Source,X-Google-Original-From';
		const configStr = (env && env.GMAIL_FORWARD_HEADERS) || defaultHeaders;
		const signatureKeys = configStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

		// 归一化：key 转小写比对
		const headerMap = headers.reduce((acc, h) => {
			if (h && h.key) {
				acc[h.key.toLowerCase()] = h.value;
			}
			return acc;
		}, {});

		for (const sigKey of signatureKeys) {
			const val = headerMap[sigKey];
			if (val !== undefined && this.isTrustworthyValue(sigKey, val)) {
				return true;
			}
		}

		return false;
	},

	/**
	 * 签名头值是否「可信」——用于拦伪造头。
	 * Gmail 转发会在这些头里带上真实来源信息，值有稳定格式：
	 *  - X-Gm-Original-From / X-Google-Original-From：真实原始发件人邮箱
	 *  - X-Google-Smtp-Source：一段较长的 base64/令牌串（几十字符）
	 * 仅当值符合预期格式才判定，空值/畸形值一律视为不可信。
	 */
	isTrustworthyValue(sigKey, value) {

		if (typeof value !== 'string') {
			return false;
		}

		const v = value.trim();

		if (v.length === 0) {
			return false;
		}

		// 邮箱型头：必须匹配合法邮箱（且非空、有最终域）
		if (sigKey === 'x-gm-original-from' || sigKey === 'x-google-original-from') {
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
		}

		// X-Google-Smtp-Source：真实值为较长令牌（Gmail base64 ~ 20+ 字符）
		// 至少要求一定长度，避免空/短伪造头误判
		if (sigKey === 'x-google-smtp-source') {
			return v.length >= 16;
		}

		// 其它自定义签名头：非空即视为可信（管理员自行决定头含义）
		return true;
	}
}

export default emailRules
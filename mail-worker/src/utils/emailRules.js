const emailRules = {

	/**
	 * 判定一封邮件是否是由 Gmail 自动转发进入系统的邮件。
	 * 用于 N-02 分流：Gmail 转发邮件只 TG+保存，跳过 forward 转发（不送 Outlook/QQ）。
	 *
	 * 识别依据（不看 From，避免朋友发到你 Gmail 再转发的场景被误判）：
	 *   扫描 postal-mime 解析出的 headers（结构 [{ key, value }]，key 均为小写），
	 *   命中任一 Gmail 专属转发签名头（默认 X-Gm-Original-From /
	 *   X-Google-Smtp-Source / X-Google-Original-From）即判定为 Gmail 转发邮件。
	 *
	 * 防误判（QA + 产品硬性要求）：
	 *   伪造/边界头不得误伤普通邮件——判定要求「命中签名头」且「该头的值可信」，
	 *   空值或非预期格式的值不视为可信（普通邮件即使被人为塞进伪装 Gmail 头，
	 *   只要值不合规，仍走正常转发，不丢 Outlook/QQ）。
	 *
	 * 开关 SKIP_FORWARD_GMAIL_FORWARDED=false（默认）时恒返回 false，零回归。
	 *
	 * @param {Array<{key:string, value:string}>} headers - postal-mime 解析后的 email.headers
	 * @param {object} env - Worker env（读 SKIP_FORWARD_GMAIL_FORWARDED / GMAIL_FORWARD_HEADERS）
	 * @returns {boolean}
	 */
	isGmailForwardedEmail(headers = [], env) {

		// 开关关闭或未开启：不做任何分流，恒 false（零回归）
		if (!env || env.SKIP_FORWARD_GMAIL_FORWARDED !== true) {
			return false;
		}

		if (!Array.isArray(headers) || headers.length === 0) {
			return false;
		}

		// 可配置的签名头清单（逗号分隔），默认三个 Gmail 转发专属头
		const defaultHeaders = 'X-Gm-Original-From,X-Google-Smtp-Source,X-Google-Original-From';
		const configStr = env.GMAIL_FORWARD_HEADERS || defaultHeaders;
		const signatureKeys = configStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

		// 归一化：key 转小写比对；value 断言「可信值」
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
		// 至少要求一定长度且不完全是空白，避免空/单字符伪造头误判
		if (sigKey === 'x-google-smtp-source') {
			return v.length >= 16;
		}

		// 其它自定义签名头：非空即视为可信（管理员自行决定头含义）
		return true;
	}
}

export default emailRules
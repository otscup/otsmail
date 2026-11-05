// 内置五类分类规则（主要 / 社交 / 推广 / 动态 / 垃圾）。
// 纯函数：无数据库、无网络、无新依赖，只读收信时的邮件对象与邮件头。
//
// 设计约定：
// 1) 强信号直接定类（如社交平台域名、人工对话），弱信号累加，事务词做反向惩罚；
// 2) 返回 null 表示"本模块没有足够信号"，由调用方继续走现有 AI / 本地兜底；
// 3) 垃圾只做辅助加分，单一弱信号永远达不到阈值，避免把现有垃圾判定放宽；
// 4) 所有词表、权重、阈值集中在文件顶部，调参只改这一块，不要在规则体内写魔法值。

// ============================ 可调参数 ============================

const THRESHOLDS = {
	promotion: 4,
	updates: 4,
	social: 4,
	spam: 5
};

// 社交平台官方发件域名；命中即直判 social（子域名同样命中）
const SOCIAL_DOMAINS = [
	'facebook.com', 'facebookmail.com', 'instagram.com', 'linkedin.com',
	'x.com', 'twitter.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
	'discord.com', 'slack.com', 'telegram.org', 'telegram.com',
	'weibo.com', 'zhihu.com', 'douyin.com', 'xiaohongshu.com'
];

// 弱信号：正文/主题里出现平台名
const SOCIAL_NAMES = [
	'facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'pinterest',
	'reddit', 'discord', 'slack', 'telegram', 'weibo', '微博', '知乎', '抖音', '小红书'
];

// 弱信号：社交互动文案
const SOCIAL_COPY = [
	'new follower', 'started following', 'commented on your', 'mentioned you',
	'invited you to', 'sent you a message', 'added you',
	'新增粉丝', '关注了你', '评论了你', '提到了你', '邀请你加入', '给你发来消息'
];

// 推广词：主题命中权重更高，正文命中权重相同但只记一次
const PROMO_TERMS = [
	'sale', 'sales', 'discount', 'off', 'coupon', 'deal', 'deals', 'promo',
	'promotion', 'limited time', 'black friday', 'cyber monday', 'free shipping',
	'限时', '优惠', '折扣', '促销', '优惠券', '双11', '双十一', '黑五', '秒杀',
	'特惠', '立减', '满减', '领券'
];

// 事务词：命中后给"推广"减分，避免把订单/验证码通知判成促销
const TRANSACTIONAL_TERMS = [
	'verification code', 'security code', 'one-time password', 'passcode', 'otp',
	'receipt', 'invoice', 'order', 'shipped', 'shipping', 'delivery',
	'password reset', 'reset your password', 'two-factor',
	'验证码', '校验码', '账单', '订单', '发货', '收货', '密码重置', '安全验证', '退款'
];

// 自动化发件人本地部分（按 . _ - + 切词后精确比对）
const AUTOMATED_LOCAL_PARTS = [
	'noreply', 'no-reply', 'donotreply', 'notification', 'notifications',
	'alert', 'alerts', 'billing', 'security', 'verify', 'verification',
	'accounts', 'orders', 'receipts', 'mailer-daemon', 'postmaster'
];

// ESP 发信域名：只作弱信号，需与其它推广信号叠加才生效
const ESP_DOMAINS = [
	'mailchimp.com', 'mcsv.net', 'list-manage.com', 'sendgrid.net',
	'mailgun.org', 'mailgun.net', 'amazonses.com', 'sparkpostmail.com',
	'brevo.com', 'sendinblue.com', 'klaviyo.com', 'constantcontact.com',
	'createsend.com', 'hubspot.com', 'intercom-mail.com'
];

// 强垃圾词：只做辅助加分，需要与认证失败叠加才可能达到阈值
const SPAM_TERMS = [
	'viagra', 'cialis', 'casino', 'lottery', 'jackpot', 'unclaimed',
	'claim your', 'risk-free', 'pre-approved', 'no credit check',
	'work from home', 'make money', 'bitcoin', 'forex',
	'代开发票', '办证', '刷单', '返利', '博彩', '赌场', '中奖', '彩票',
	'低息贷款', '无抵押', '加微信', '加vx'
];

// ============================ 工具函数 ============================

// 邮件头是 [{ key, value }]，同名头可能重复，统一拼接后匹配
function headerValue(email, name) {
	const list = Array.isArray(email?.headers) ? email.headers : [];
	return list
		.filter(item => String(item?.key || '').toLowerCase() === name)
		.map(item => String(item?.value || '').trim())
		.filter(Boolean)
		.join(' ');
}

function textOf(value) {
	if (Array.isArray(value)) return value.join(' ').trim();
	return String(value || '').trim();
}

function senderAddress(email) {
	return textOf(email?.from?.address).toLowerCase();
}

function senderDomain(email) {
	const address = senderAddress(email);
	const at = address.lastIndexOf('@');
	return at === -1 ? '' : address.slice(at + 1).trim();
}

function senderLocalPart(email) {
	const address = senderAddress(email);
	const at = address.lastIndexOf('@');
	return at === -1 ? address : address.slice(0, at);
}

// 精确域名或子域名命中，避免 "x.com" 之类的短串做子串匹配
function domainIn(list, domain) {
	if (!domain) return '';
	return list.find(item => domain === item || domain.endsWith(`.${item}`)) || '';
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 纯 ASCII 词按单词边界匹配（避免 sale 命中 wholesale、off 命中 office）；
// 中文词直接做子串匹配
function buildTermRegExp(term) {
	const lower = term.toLowerCase();
	if (!/^[\x00-\x7f]+$/.test(lower)) return null;
	const escaped = escapeRegExp(lower);
	const left = /^[a-z0-9]/.test(lower) ? '(^|[^a-z0-9])' : '';
	const right = /[a-z0-9]$/.test(lower) ? '(?=$|[^a-z0-9])' : '';
	return new RegExp(`${left}${escaped}${right}`, 'i');
}

// 预先编译词表，避免每封信重复构造正则
function createMatcher(list) {
	const entries = list.map(term => ({ term, re: buildTermRegExp(term) }));
	return text => {
		for (const entry of entries) {
			if (entry.re ? entry.re.test(text) : text.includes(entry.term)) return entry.term;
		}
		return '';
	};
}

const matchSocialName = createMatcher(SOCIAL_NAMES);
const matchSocialCopy = createMatcher(SOCIAL_COPY);
const matchPromoTerm = createMatcher(PROMO_TERMS);
const matchTransactionalTerm = createMatcher(TRANSACTIONAL_TERMS);
const matchSpamTerm = createMatcher(SPAM_TERMS);

function isAutomatedSender(localPart) {
	if (!localPart) return false;
	const tokens = localPart.split(/[._+-]/);
	// 整串比对覆盖 no-reply / mailer-daemon 这类带连字符的写法
	return AUTOMATED_LOCAL_PARTS.some(item => localPart === item || tokens.includes(item));
}

function isAutoSubmitted(email) {
	const value = headerValue(email, 'auto-submitted').toLowerCase();
	// RFC 3834：auto-submitted: no 表示不是自动回复
	return /^auto-(generated|replied|notified)/.test(value);
}

function authResult(email, name) {
	const raw = `${headerValue(email, 'authentication-results')} ${headerValue(email, 'arc-authentication-results')}`;
	const match = raw.match(new RegExp(`\\b${name}\\s*=\\s*([a-z]+)`, 'i'));
	return match ? match[1].toLowerCase() : '';
}

// ============================ 规则主体 ============================

/**
 * 返回 { category, scores, hits }。
 * category 为 null 时表示本模块弃权，调用方继续走兜底。
 */
export function explainBuiltinRules(email) {
	const scores = { social: 0, promotion: 0, updates: 0, spam: 0 };
	const hits = [];

	const add = (category, weight, rule, intent) => {
		if (!weight) return;
		scores[category] += weight;
		hits.push({ rule, category, weight, intent });
	};

	const subject = textOf(email?.subject).toLowerCase();
	const body = textOf(email?.text).toLowerCase().slice(0, 8000);
	const domain = senderDomain(email);
	const localPart = senderLocalPart(email);

	// R0：人工对话优先。回复/转发链条存在时，直接回 primary，压制推广与垃圾规则。
	const replyChain = `${textOf(email?.inReplyTo)} ${textOf(email?.references)} ${headerValue(email, 'in-reply-to')} ${headerValue(email, 'references')}`.trim();
	if (replyChain) {
		add('primary', 0, 'R0-REPLY', '存在 In-Reply-To / References，视为人工对话');
		return { category: 'primary', scores, hits };
	}

	// R1：社交平台官方域名，直判（子域名同样命中）
	const socialDomain = domainIn(SOCIAL_DOMAINS, domain);
	if (socialDomain) {
		add('social', 0, 'R1-SOCIAL-DOMAIN', `发件域名命中社交平台：${socialDomain}`);
		return { category: 'social', scores, hits };
	}

	// R2/R3：平台名 + 互动文案，两条弱信号叠加才够阈值，用于非官方域名的社交通知
	const socialText = `${subject} ${body}`;
	const socialName = matchSocialName(socialText);
	if (socialName) add('social', 2, 'R2-SOCIAL-NAME', `正文提到平台名：${socialName}`);

	const socialCopy = matchSocialCopy(socialText);
	if (socialCopy) add('social', 2, 'R3-SOCIAL-COPY', `正文含社交互动文案：${socialCopy}`);

	// R4：一键退订（RFC 8058），推广的最强信号
	if (/one-?click/i.test(headerValue(email, 'list-unsubscribe-post'))) {
		add('promotion', 4, 'R4-ONE-CLICK', 'List-Unsubscribe-Post 声明一键退订');
	}

	// R5：存在 List-Unsubscribe，说明是批量/订阅类邮件；一键退订已单独计分，不重复累加
	if (headerValue(email, 'list-unsubscribe') && !/one-?click/i.test(headerValue(email, 'list-unsubscribe-post'))) {
		add('promotion', 3, 'R5-UNSUBSCRIBE', '存在 List-Unsubscribe 头');
	}

	// R6/R7：促销词，主题与正文各记一次
	const promoSubject = matchPromoTerm(subject);
	if (promoSubject) add('promotion', 2, 'R6-PROMO-SUBJECT', `主题含促销词：${promoSubject}`);

	const promoBody = matchPromoTerm(body);
	if (promoBody) add('promotion', 2, 'R7-PROMO-BODY', `正文含促销词：${promoBody}`);

	// R8：ESP 发信域名，只作弱信号
	const espDomain = domainIn(ESP_DOMAINS, domain);
	if (espDomain) add('promotion', 2, 'R8-ESP-DOMAIN', `发件域名属于 ESP：${espDomain}`);

	// R9：事务词反向惩罚，订单/验证码邮件不应被判成推广
	const transactionalSubject = matchTransactionalTerm(subject);
	const transactionalBody = matchTransactionalTerm(body);
	if (transactionalSubject || transactionalBody) {
		add('promotion', -2, 'R9-TRANSACTIONAL', `含事务词：${transactionalSubject || transactionalBody}`);
	}

	// R10：noreply / notification / billing 类自动化发件人
	if (isAutomatedSender(localPart)) {
		add('updates', 2, 'R10-AUTOMATED-SENDER', `自动化发件人：${localPart}`);
	}

	// R11/R12：事务词，主题权重高于正文
	if (transactionalSubject) add('updates', 3, 'R11-TX-SUBJECT', `主题含事务词：${transactionalSubject}`);
	if (transactionalBody) add('updates', 1, 'R12-TX-BODY', `正文含事务词：${transactionalBody}`);

	// R13：Auto-Submitted 自动生成（RFC 3834）
	if (isAutoSubmitted(email)) {
		add('updates', 3, 'R13-AUTO-SUBMITTED', `Auto-Submitted：${headerValue(email, 'auto-submitted')}`);
	}

	// R14/R15：垃圾辅助信号。单条永远达不到 spam 阈值，只有"强垃圾词 + SPF/DMARC 双失败"才可能命中
	const spamTerm = matchSpamTerm(`${subject} ${body}`);
	if (spamTerm) add('spam', 2, 'R14-SPAM-TERM', `正文含强垃圾词：${spamTerm}`);

	if (authResult(email, 'spf') === 'fail' && authResult(email, 'dmarc') === 'fail') {
		add('spam', 3, 'R15-AUTH-FAIL', 'SPF 与 DMARC 同时失败');
	}

	// 决策：分数最高且达阈值；平分时按 spam > updates > promotion > social 的顺序取前者
	const order = ['spam', 'updates', 'promotion', 'social'];
	let best = null;
	let bestScore = 0;
	for (const category of order) {
		if (scores[category] >= THRESHOLDS[category] && scores[category] > bestScore) {
			best = category;
			bestScore = scores[category];
		}
	}

	return { category: best, scores, hits };
}

// email.js 只关心最终类别
export function classifyByBuiltinRules(email) {
	return explainBuiltinRules(email).category;
}

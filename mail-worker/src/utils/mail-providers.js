/**
 * 第三方邮箱自动探测规则表（服务端唯一真源）。
 * 客户端 ExtProviders.kt 是同一份数据的离线副本，两边改动必须同步。
 *
 * 置信度说明：
 * - Gmail / Outlook / 163 / 126 / QQ 的 IMAP·SMTP 主机与端口来自各家官方帮助页，属已核实。
 * - foo.163.com 一类的子域按 suffix 匹配；163 系（163/126/yeah）要求 IMAP 先发 ID 命令，否则回 Unsafe Login。
 * - foxmail.com 复用 QQ 的 imap.qq.com / smtp.qq.com，属推断（未逐条实测）。
 * - 未列入的域名一律回 unknown，由用户手填服务器，不做猜测。
 */

const PROVIDERS = [
	{
		id: 'gmail',
		name: 'Gmail',
		domains: ['gmail.com', 'googlemail.com'],
		imap: { host: 'imap.gmail.com', port: 993, secure: true, needsId: false },
		smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
		auth: [
			{
				type: 'app_password',
				label: '应用专用密码',
				steps: [
					'浏览器打开 myaccount.google.com/security',
					'开启「两步验证」（应用专用密码必须先开两步验证）',
					'搜索「应用专用密码」，新建一个，选择「邮件」',
					'把生成的 16 位密码粘贴到这里（不是 Google 账号密码）',
				],
			},
			{
				type: 'oauth',
				label: 'Google 账号授权登录',
				enabled: false,
				note: 'OAuth 授权接入在下一批实现；本批请用应用专用密码。',
				steps: [],
			},
		],
		note: 'Gmail 的 IMAP 需要在网页版「转发和 POP/IMAP」里保持启用。',
	},
	{
		id: 'outlook',
		name: 'Outlook / Hotmail',
		domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.jp'],
		imap: { host: 'outlook.office365.com', port: 993, secure: true, needsId: false },
		smtp: { host: 'smtp.office365.com', port: 587, secure: false },
		auth: [
			{
				type: 'oauth',
				label: 'Microsoft 账号授权登录',
				enabled: false,
				note: 'Microsoft 已于 2024-09-16 停用基础认证，Outlook 只能用 OAuth；本批为占位，尚不能完成绑定。',
				steps: [],
			},
		],
		note: 'Outlook 不支持应用密码走 IMAP/SMTP，必须 OAuth（下一批接入）。',
	},
	{
		id: 'netease163',
		name: '网易 163',
		domains: ['163.com', 'vip.163.com', '188.com'],
		imap: { host: 'imap.163.com', port: 993, secure: true, needsId: true },
		smtp: { host: 'smtp.163.com', port: 465, secure: true },
		auth: [
			{
				type: 'auth_code',
				label: '客户端授权码',
				steps: [
					'网页登录 mail.163.com',
					'右上角「设置」→「POP3/SMTP/IMAP」',
					'开启「IMAP/SMTP 服务」',
					'同页「客户端授权码」里新增一个，复制 16 位授权码粘贴到这里',
				],
			},
		],
		note: '163 系 IMAP 必须先发送 ID 命令声明客户端名，否则服务器回 Unsafe Login。',
	},
	{
		id: 'netease126',
		name: '网易 126',
		domains: ['126.com', 'yeah.net'],
		imap: { host: 'imap.126.com', port: 993, secure: true, needsId: true },
		smtp: { host: 'smtp.126.com', port: 465, secure: true },
		auth: [
			{
				type: 'auth_code',
				label: '客户端授权码',
				steps: [
					'网页登录 mail.126.com',
					'右上角「设置」→「POP3/SMTP/IMAP」',
					'开启「IMAP/SMTP 服务」',
					'在「客户端授权码」里新增并复制授权码粘贴到这里',
				],
			},
		],
		note: 'yeah.net 与 126 同属网易免费邮，主机名按 126 处理；yeah.net 若连接失败需手填服务器。',
	},
	{
		id: 'qq',
		name: 'QQ 邮箱',
		domains: ['qq.com', 'foxmail.com'],
		imap: { host: 'imap.qq.com', port: 993, secure: true, needsId: false },
		smtp: { host: 'smtp.qq.com', port: 465, secure: true },
		auth: [
			{
				type: 'auth_code',
				label: '16 位授权码',
				steps: [
					'网页登录 mail.qq.com',
					'「设置」→「账号」→ 开启「IMAP/SMTP 服务」',
					'按提示用手机发送短信完成验证',
					'复制弹出的 16 位授权码粘贴到这里（不是 QQ 密码）',
				],
			},
		],
		note: 'foxmail.com 域名复用 QQ 的服务器（推断，未逐条实测）。',
	},
];

const MANUAL = {
	id: 'custom',
	name: '其他邮箱（手动填写）',
	domains: [],
	imap: { host: '', port: 993, secure: true, needsId: false },
	smtp: { host: '', port: 465, secure: true },
	auth: [
		{ type: 'auth_code', label: '授权码 / 密码', steps: [] },
		{ type: 'app_password', label: '应用专用密码', steps: [] },
	],
	note: '未收录的域名需要自己填写 IMAP / SMTP 主机与端口。',
};

/** 只允许 993/143（IMAP·POP 加密/STARTTLS）与 465/587（SMTP），避免被当成任意端口探测器 */
const ALLOWED_PORTS = { imap: [993, 143], smtp: [465, 587] };

function normalizeAddress(address) {
	return String(address || '').trim().toLowerCase();
}

function domainOf(address) {
	const at = normalizeAddress(address).lastIndexOf('@');
	return at === -1 ? '' : normalizeAddress(address).slice(at + 1);
}

export function detectProvider(address) {
	const domain = domainOf(address);
	if (!domain) return null;
	return PROVIDERS.find(p => p.domains.some(d => domain === d || domain.endsWith(`.${d}`))) || null;
}

export function getProvider(id) {
	if (id === MANUAL.id) return MANUAL;
	return PROVIDERS.find(p => p.id === id) || null;
}

export function isKnownDomain(address) {
	return Boolean(detectProvider(address));
}

/**
 * 绑定参数校验：域名必须与 provider 匹配；custom 只接受白名单端口与合法主机名。
 * 返回规范化后的服务器配置（不信任客户端传来的主机/端口，除 custom 外一律用规则表）。
 */
export function resolveEndpoint(address, providerId, input = {}) {
	const provider = getProvider(providerId);
	if (!provider) return { error: '未知的邮箱服务商' };

	if (provider.id !== MANUAL.id) {
		const detected = detectProvider(address);
		if (!detected || detected.id !== provider.id) {
			return { error: '邮箱域名与服务商不匹配，请重新输入邮箱地址' };
		}
		return {
			provider,
			imap: provider.imap,
			smtp: provider.smtp,
		};
	}

	const hostRe = /^(?!-)[a-z0-9.-]{1,253}$/;
	const imapHost = String(input.imapHost || '').trim().toLowerCase();
	const smtpHost = String(input.smtpHost || '').trim().toLowerCase();
	const imapPort = Number(input.imapPort || 993);
	const smtpPort = Number(input.smtpPort || 465);

	if (!hostRe.test(imapHost) || !hostRe.test(smtpHost)) return { error: 'IMAP / SMTP 主机名不合法' };
	if (!ALLOWED_PORTS.imap.includes(imapPort)) return { error: 'IMAP 端口只支持 993 或 143' };
	if (!ALLOWED_PORTS.smtp.includes(smtpPort)) return { error: 'SMTP 端口只支持 465 或 587' };

	return {
		provider,
		imap: { host: imapHost, port: imapPort, secure: imapPort === 993, needsId: false },
		smtp: { host: smtpHost, port: smtpPort, secure: smtpPort === 465 },
	};
}

export function publicCatalog() {
	return [MANUAL, ...PROVIDERS].map(p => ({
		id: p.id,
		name: p.name,
		domains: p.domains,
		imap: p.imap,
		smtp: p.smtp,
		auth: p.auth,
		note: p.note,
	}));
}

export function allowedAuthTypes(providerId) {
	const provider = getProvider(providerId);
	return provider ? provider.auth.map(a => a.type) : [];
}

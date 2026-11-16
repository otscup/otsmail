// 多渠道发信：渠道目录与默认额度
// 额度为 2026 年各渠道公开的长期免费档，管理员可在设置页调整。
// DNS 记录名一律相对发信域名（otscup.com），记录值必须由管理员从各渠道后台复制，代码里不写死示例值。

export const PROVIDER_IDS = ['resend', 'brevo', 'mailjet', 'elastic', 'smtp2go'];

export const SEND_PROVIDERS = [
	{
		id: 'resend',
		name: 'Resend',
		order: 1,
		dailyLimit: 100,
		monthlyLimit: 3000,
		keyFields: ['apiKey'],
		signupUrl: 'https://resend.com/signup',
		spfInclude: '',
		dnsRecords: [
			{ type: 'CNAME', name: 'resend._domainkey', purpose: 'DKIM' }
		],
		note: 'Resend token 仍按域名存放在原「Resend Token」设置里；此处 Key 仅作为未匹配到域名时的兜底。'
	},
	{
		id: 'brevo',
		name: 'Brevo',
		order: 2,
		dailyLimit: 300,
		monthlyLimit: 9000,
		keyFields: ['apiKey'],
		signupUrl: 'https://www.brevo.com/',
		spfInclude: '',
		dnsRecords: [
			{ type: 'CNAME', name: 'brevo1._domainkey', purpose: 'DKIM' },
			{ type: 'CNAME', name: 'brevo2._domainkey', purpose: 'DKIM' }
		],
		note: '共享套餐的 envelope 发件域是 Brevo 自己的，不需要加 SPF include；老账号后台可能只给 mail._domainkey 一条 TXT，以后台实际值为准。'
	},
	{
		id: 'mailjet',
		name: 'Mailjet',
		order: 3,
		dailyLimit: 200,
		monthlyLimit: 6000,
		keyFields: ['apiKey', 'secret'],
		signupUrl: 'https://www.mailjet.com/signup/',
		spfInclude: 'spf.mailjet.com',
		dnsRecords: [
			{ type: 'TXT', name: 'mailjet._domainkey', purpose: 'DKIM' }
		],
		note: 'API Key 与 Secret 都要填。SPF 需在根域唯一一条 TXT 里合并 include:spf.mailjet.com。'
	},
	{
		id: 'elastic',
		name: 'Elastic Email',
		order: 4,
		dailyLimit: 100,
		monthlyLimit: 3000,
		keyFields: ['apiKey'],
		signupUrl: 'https://elasticemail.com/register',
		spfInclude: '_spf.elasticemail.com',
		dnsRecords: [
			{ type: 'TXT', name: 'api._domainkey', purpose: 'DKIM' }
		],
		note: 'SPF 需合并 include:_spf.elasticemail.com；若 SPF 查询次数超 10 次，优先砍掉这条，靠 DKIM 过 DMARC。'
	},
	{
		id: 'smtp2go',
		name: 'SMTP2GO',
		order: 5,
		dailyLimit: 200,
		monthlyLimit: 1000,
		keyFields: ['apiKey'],
		signupUrl: 'https://www.smtp2go.com/',
		spfInclude: 'spf.smtp2go.com',
		dnsRecords: [
			{ type: 'CNAME', name: 'smtp._domainkey', purpose: 'DKIM' }
		],
		note: '月封顶 1000 封是硬约束，排最后；到达月上限后当月不再参与轮换。'
	}
];

export function providerMeta(id) {
	return SEND_PROVIDERS.find(item => item.id === id) || null;
}

export function defaultProviderConfig() {
	const config = {};
	for (const provider of SEND_PROVIDERS) {
		config[provider.id] = {
			enabled: provider.id === 'resend',
			order: provider.order,
			apiKey: '',
			secret: '',
			accounts: [],
			dailyLimit: provider.dailyLimit,
			monthlyLimit: provider.monthlyLimit,
			dnsRecords: {}
		};
	}
	return config;
}

export default SEND_PROVIDERS;

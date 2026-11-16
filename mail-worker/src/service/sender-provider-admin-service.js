import settingService from './setting-service';
import senderProviderConfig from './sender-provider-config';
import sendQuotaService from './send-quota-service';
import sendRouterService from './send-router-service';
import { SEND_PROVIDERS, PROVIDER_IDS } from '../const/send-provider-const';
import { getProvider } from './provider';
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import settingTable from '../entity/setting';
import { eq } from 'drizzle-orm';

const DOH_URL = 'https://cloudflare-dns.com/dns-query';

function normalizeDomain(value) {
	return String(value || '').trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '');
}

function normalizeRecordValue(value) {
	return String(value || '')
		.replace(/^"|"$/g, '')
		.replace(/\s+/g, '')
		.toLowerCase();
}

async function dohQuery(name, type) {
	const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
	const response = await fetch(url, { headers: { accept: 'application/dns-json' } });
	if (!response.ok) throw new Error(`DoH ${response.status}`);
	const data = await response.json();
	return (data.Answer || []).map(item => String(item.data || ''));
}

const senderProviderAdminService = {

	async overview(c) {
		const setting = await settingService.query(c);
		const configs = senderProviderConfig.mask(setting);

		// 用量一次 SQL 取全（原来是每渠道一次 SELECT），冷却判断并发做，避免管理端概览放大 D1 读
		const usageMap = await sendQuotaService.usageAll(c, PROVIDER_IDS);
		const cooling = await Promise.all(PROVIDER_IDS.map(id => sendRouterService.isCooling(c, id)));
		const coolingMap = {};
		PROVIDER_IDS.forEach((id, index) => { coolingMap[id] = cooling[index]; });

		const list = [];
		for (const meta of SEND_PROVIDERS) {
			const config = configs[meta.id];
			const usage = usageMap[meta.id] || { day: 0, month: 0 };
			const dailyLimit = Math.max(0, Number(config.dailyLimit) || 0);
			const monthlyLimit = Math.max(0, Number(config.monthlyLimit) || 0);

			list.push({
				id: meta.id,
				name: meta.name,
				order: config.order,
				enabled: config.enabled,
				apiKey: config.apiKey,
				secret: config.secret,
				accounts: config.accounts || [],
				dailyLimit,
				monthlyLimit,
				// 目录默认额度 + 是否手填：前端据此提示「默认 / 手动」并支持一键恢复默认
				defaultDailyLimit: meta.dailyLimit,
				defaultMonthlyLimit: meta.monthlyLimit,
				dailyLimitManual: !!config.dailyLimitManual,
				monthlyLimitManual: !!config.monthlyLimitManual,
				dnsRecords: config.dnsRecords,
				configured: config.configured,
				cooling: coolingMap[meta.id] || false,
				usage,
				// 服务商都不提供额度查询接口：used 是本站真实计数，remaining 按本站配置的上限算
				remaining: {
					day: Math.max(0, dailyLimit - usage.day),
					month: Math.max(0, monthlyLimit - usage.month)
				},
				quota: { source: 'local', providerQueryable: false },
				meta: {
					keyFields: meta.keyFields,
					signupUrl: meta.signupUrl,
					spfInclude: meta.spfInclude,
					dnsRecords: meta.dnsRecords,
					note: meta.note
				}
			});
		}

		const providers = list.sort((a, b) => a.order - b.order);
		// 已同步 = 凭据填全（能直接参与发信）；可接入 = 目录里的渠道总数
		const synced = providers.filter(item => item.configured);
		const routable = synced.filter(item => item.enabled && !item.cooling);
		// 汇总只统计已同步的渠道（含被暂停/冷却的），未添加的渠道不计入额度与剩余
		const sumLimits = key => synced.reduce((total, item) => total + (Number(item[key]) || 0), 0);

		return {
			adminEmail: c.env.admin || '',
			hasCloudflareEmail: !!c.env.email,
			providers,
			summary: {
				total: providers.length,
				synced: synced.length,
				enabled: providers.filter(item => item.enabled).length,
				routable: routable.length,
				limits: {
					day: sumLimits('dailyLimit'),
					month: sumLimits('monthlyLimit')
				},
				usage: {
					day: synced.reduce((total, item) => total + item.usage.day, 0),
					month: synced.reduce((total, item) => total + item.usage.month, 0)
				},
				remaining: {
					day: synced.reduce((total, item) => total + item.remaining.day, 0),
					month: synced.reduce((total, item) => total + item.remaining.month, 0)
				},
				scope: 'synced',
				quota: { source: 'local', providerQueryable: false }
			}
		};
	},

	async save(c, params) {
		const setting = await settingService.query(c);
		const sanitized = senderProviderConfig.sanitizeInput(params.senderProviders ?? params, setting);

		// 凭据已全部收敛到 sender_providers.accounts；清空旧的 resend_tokens，避免两处配置互相覆盖
		await orm(c).update(settingTable)
			.set({ senderProviders: JSON.stringify(sanitized), resendTokens: '{}' })
			.where(eq(1, 1))
			.run();
		await settingService.refresh(c);

		// 管理员刚改过 Key，之前因认证失败进入冷却的渠道应立刻可再试
		for (const id of PROVIDER_IDS) {
			await sendRouterService.clearCooldown(c, id);
		}

		return this.overview(c);
	},

	/** 测试发送：默认走完整轮换；指定 providerId 时只试该渠道并把原始错误抛出来 */
	async test(c, params = {}) {
		const target = String(params.to || c.env.admin || '').trim();
		if (!target || !target.includes('@')) {
			throw new BizError('管理员邮箱未配置，无法测试发送', 400);
		}

		const providerId = params.provider ? String(params.provider) : '';
		if (providerId && !getProvider(providerId)) {
			throw new BizError('未知的发信渠道', 400);
		}

		const setting = await settingService.query(c);
		// 指定 domain 时用该域名的发件人，能测到渠道里对应域名的 Key
		const testDomain = normalizeDomain(params.domain);
		const senderEmail = String(setting.systemSenderEmail || '').trim();
		const fallbackEmail = senderEmail.includes('@') && !testDomain
			? senderEmail
			: `noreply@${testDomain || (setting.domainList || ['@localhost'])[0].replace(/^@/, '')}`;
		const accountEmail = fallbackEmail;
		const domain = testDomain || target.split('@')[1];

		const result = await sendRouterService.send(c, {
			name: setting.title || 'OTSMail',
			accountEmail,
			receiveEmail: [target],
			subject: `【${setting.title || 'OTSMail'}】发信渠道测试`,
			text: `这是一封发信渠道测试邮件。\n渠道：${providerId || '自动轮换'}\n时间：${new Date().toISOString()}`,
			html: `<p>这是一封发信渠道测试邮件。</p><p>渠道：${providerId || '自动轮换'}</p><p>时间：${new Date().toISOString()}</p>`,
			attachments: []
		}, { providerId: providerId || '', units: 1 });

		return {
			provider: result.provider,
			id: result.id,
			to: target,
			domain
		};
	},

	/** 用 DoH 核验用户录入的 DKIM/SPF 记录，不写入任何状态 */
	async checkDns(c, params = {}) {
		const setting = await settingService.query(c);
		const configs = senderProviderConfig.parse(setting.senderProviders, setting);
		const fallbackDomain = (setting.domainList || [''])[0] || '';
		const domain = normalizeDomain(params.domain || fallbackDomain);
		if (!domain) throw new BizError('发信域名未配置', 400);

		const providers = {};
		for (const meta of SEND_PROVIDERS) {
			const entered = configs[meta.id]?.dnsRecords || {};
			const records = [];

			for (const template of meta.dnsRecords) {
				const key = Object.keys(entered).find(name => normalizeDomain(name) === template.name || normalizeDomain(name) === `${template.name}.${domain}`) || template.name;
				const expected = entered[key] || '';
				const fqdn = key.includes(domain) ? key : `${key}.${domain}`;
				const item = { name: fqdn, type: template.type, purpose: template.purpose, expected, actual: '', status: 'unverified' };

				if (!expected) {
					records.push(item);
					continue;
				}

				try {
					const answers = await dohQuery(fqdn, template.type);
					item.actual = answers.join(' | ').slice(0, 500);
					if (!answers.length) {
						item.status = 'missing';
					} else {
						const wanted = normalizeRecordValue(expected);
						const hit = answers.some(answer => normalizeRecordValue(answer).includes(wanted));
						item.status = hit ? 'ok' : 'mismatch';
					}
				} catch (e) {
					item.status = 'error';
					item.actual = e.message;
				}
				records.push(item);
			}

			const spf = { required: !!meta.spfInclude, include: meta.spfInclude, status: 'not_required', actual: '' };
			if (meta.spfInclude) {
				try {
					const answers = await dohQuery(domain, 'TXT');
					const spfValue = answers.find(item => normalizeRecordValue(item).startsWith('v=spf1')) || '';
					spf.actual = spfValue.slice(0, 500);
					if (!spfValue) spf.status = 'missing';
					else if (normalizeRecordValue(spfValue).includes(`include:${meta.spfInclude}`)) spf.status = 'ok';
					else spf.status = 'mismatch';
				} catch (e) {
					spf.status = 'error';
					spf.actual = e.message;
				}
			}

			providers[meta.id] = { name: meta.name, records, spf };
		}

		return { domain, checkedAt: new Date().toISOString(), providers };
	}
};

export default senderProviderAdminService;

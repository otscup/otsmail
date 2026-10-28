import { describe, it, expect } from 'vitest';
import { isSpamByHeaders } from '../src/email/email';
import settingService from '../src/service/setting-service';
import oauthService from '../src/service/oauth-service';

describe('isSpamByHeaders — 自动垃圾判定', () => {
	const row = (headers, subject = 'hello') => ({ subject, headers });

	it('X-Spam-Status: Yes 命中', () => {
		expect(isSpamByHeaders(row([{ key: 'X-Spam-Status', value: 'Yes, hits=6.1' }]))).toBe(true);
	});

	it('X-Spam-Flag: YES 命中（大小写不敏感）', () => {
		expect(isSpamByHeaders(row([{ key: 'x-spam-flag', value: 'YES' }]))).toBe(true);
	});

	it('X-Spam-Score >= 5 命中，4.9 不命中', () => {
		expect(isSpamByHeaders(row([{ key: 'x-spam-score', value: '5.0' }]))).toBe(true);
		expect(isSpamByHeaders(row([{ key: 'x-spam-score', value: '4.9' }]))).toBe(false);
	});

	it('X-Spam-Level 五颗星及以上命中', () => {
		expect(isSpamByHeaders(row([{ key: 'x-spam-level', value: '*****' }]))).toBe(true);
		expect(isSpamByHeaders(row([{ key: 'x-spam-level', value: '****' }]))).toBe(false);
	});

	it('主题 [SPAM] / ***SPAM*** / [垃圾邮件] 命中', () => {
		expect(isSpamByHeaders(row([], '[SPAM] sale'))).toBe(true);
		expect(isSpamByHeaders(row([], '***SPAM*** sale'))).toBe(true);
		expect(isSpamByHeaders(row([], '[垃圾邮件] 促销'))).toBe(true);
		expect(isSpamByHeaders(row([], '普通邮件'))).toBe(false);
	});
});

describe('OIDC 多服务商纯逻辑', () => {
	it('老库单条 oidc_* 字段会兜底成一个 legacy 服务商', () => {
		const list = settingService.parseOidcProviders({
			oidcProviders: '[]', oidcIssuer: 'https://idp.example.com', oidcClientId: 'cid',
			oidcClientSecret: 'secret', oidcName: '企业 SSO', oidcSwitch: 1
		});
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: 'legacy', enabled: true, clientSecret: 'secret' });
	});

	it('后台列表不回传 secret，只给 hasSecret', () => {
		const list = settingService.publicOidcProviders({
			oidcProviders: JSON.stringify([{
				id: 'a', name: 'A', issuer: 'https://a', clientId: 'c', clientSecret: 's', enabled: true
			}])
		});
		expect(list[0]).not.toHaveProperty('clientSecret');
		expect(list[0].hasSecret).toBe(true);
	});

	it('每个服务商在 oauth 表里用独立的 provider key', () => {
		expect(oauthService.oidcUserToOauth({ sub: '1' }, 'oidc:okta').provider).toBe('oidc:okta');
	});
});

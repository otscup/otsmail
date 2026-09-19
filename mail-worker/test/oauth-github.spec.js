import { describe, it, expect } from 'vitest';
import oauthService from '../src/service/oauth-service';

// N-01 GitHub/Google OAuth 登录 —— 纯函数单测（githubUserToOauth / googleUserToOauth 字段映射）
// 对齐架构 v1.4 §3.1：oauth_user_id←github id / google sub, provider←'github'/'google',
// username←login / email, name←name, avatar←avatar_url / picture
// 生产调用走 githubLogin()/googleLogin() 网络链路（E2E 交给 QA）；此处只测不涉及 DB/网络的纯映射。

describe('githubUserToOauth — GitHub /user 响应 → oauth 表行映射', () => {
	it('标准 GitHub /user 响应：id/login/name/avatar_url + provider 逐字段映射', () => {
		const githubUser = {
			id: 123456789,
			login: 'octocat',
			name: 'The Octocat',
			avatar_url: 'https://avatars.githubusercontent.com/u/123456789?v=4'
		};
		expect(oauthService.githubUserToOauth(githubUser)).toEqual({
			oauthUserId: '123456789',
			provider: 'github',
			username: 'octocat',
			name: 'The Octocat',
			avatar: 'https://avatars.githubusercontent.com/u/123456789?v=4'
		});
	});

	it('oauthUserId 必须字符串化（github id 为 number）', () => {
		const s = oauthService.githubUserToOauth({ id: 42, login: 'x', name: null, avatar_url: null });
		expect(s.oauthUserId).toBe('42');
		expect(typeof s.oauthUserId).toBe('string');
	});

	it('name / avatar_url 为 null 时透传（不报错，存空）', () => {
		const s = oauthService.githubUserToOauth({ id: 1, login: 'anonymous', name: null, avatar_url: null });
		expect(s).toEqual({
			oauthUserId: '1',
			provider: 'github',
			username: 'anonymous',
			name: null,
			avatar: null
		});
	});

	it('只取白名单字段，github 多余字段被剔除', () => {
		const s = oauthService.githubUserToOauth({
			id: 7, login: 'a', name: 'A', avatar_url: 'u', email: 'x@x.com', node_id: 'n', bio: 'bio'
		});
		expect(s).toEqual({
			oauthUserId: '7',
			provider: 'github',
			username: 'a',
			name: 'A',
			avatar: 'u'
		});
		expect(s).not.toHaveProperty('email');
		expect(s).not.toHaveProperty('node_id');
		expect(s).not.toHaveProperty('bio');
	});
});

describe('googleUserToOauth — Google userinfo 响应 → oauth 表行映射', () => {
	it('标准 Google userinfo：sub/email/name/picture + provider 逐字段映射', () => {
		const googleUser = {
			sub: '10987654321',
			email: 'octo@gmail.com',
			email_verified: true,
			name: 'Octo Cat',
			picture: 'https://lh3.googleusercontent.com/photo'
		};
		expect(oauthService.googleUserToOauth(googleUser)).toEqual({
			oauthUserId: '10987654321',
			provider: 'google',
			username: 'octo@gmail.com',
			name: 'Octo Cat',
			avatar: 'https://lh3.googleusercontent.com/photo'
		});
	});

	it('oauthUserId 必须字符串化（google sub 为 number）', () => {
		const s = oauthService.googleUserToOauth({ sub: 99, email: 'x@gmail.com' });
		expect(s.oauthUserId).toBe('99');
		expect(typeof s.oauthUserId).toBe('string');
		expect(s.provider).toBe('google');
	});

	it('name / picture 缺失时透传 undefined（不报错）', () => {
		const s = oauthService.googleUserToOauth({ sub: '1', email: 'anon@gmail.com' });
		expect(s).toEqual({
			oauthUserId: '1',
			provider: 'google',
			username: 'anon@gmail.com',
			name: undefined,
			avatar: undefined
		});
	});

	it('只取白名单字段，google 多余字段（email_verified 等）被剔除', () => {
		const s = oauthService.googleUserToOauth({
			sub: '7', email: 'a@gmail.com', email_verified: true, name: 'A', picture: 'u', locale: 'en', hd: 'gmail.com'
		});
		expect(s).toEqual({
			oauthUserId: '7',
			provider: 'google',
			username: 'a@gmail.com',
			name: 'A',
			avatar: 'u'
		});
		expect(s).not.toHaveProperty('email_verified');
		expect(s).not.toHaveProperty('locale');
		expect(s).not.toHaveProperty('hd');
	});
});

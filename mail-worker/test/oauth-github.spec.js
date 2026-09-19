import { describe, it, expect } from 'vitest';
import oauthService from '../src/service/oauth-service';

// N-01 GitHub OAuth 登录 —— 纯函数单测（githubUserToOauth 字段映射）
// 对齐架构 v1.1 §3.1/§5.6：oauth_user_id←github id, username←login, name←name, avatar←avatar_url
// 生产调用走 githubLogin() 网络链路（E2E 交给 QA）；此处只测不涉及 DB/网络的纯映射。

describe('githubUserToOauth — GitHub /user 响应 → oauth 表行映射', () => {
	it('标准 GitHub /user 响应：id/login/name/avatar_url 逐字段映射', () => {
		const githubUser = {
			id: 123456789,
			login: 'octocat',
			name: 'The Octocat',
			avatar_url: 'https://avatars.githubusercontent.com/u/123456789?v=4'
		};
		expect(oauthService.githubUserToOauth(githubUser)).toEqual({
			oauthUserId: '123456789',
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
			username: 'a',
			name: 'A',
			avatar: 'u'
		});
		expect(s).not.toHaveProperty('email');
		expect(s).not.toHaveProperty('node_id');
		expect(s).not.toHaveProperty('bio');
	});
});
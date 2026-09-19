import BizError from "../error/biz-error";
import orm from "../entity/orm";
import {oauth} from "../entity/oauth";
import { eq, and, inArray } from 'drizzle-orm';
import userService from "./user-service";
import loginService from "./login-service";
import cryptoUtils from "../utils/crypto-utils";
import jwtUtils from "../utils/jwt-utils";
import KvConst from "../const/kv-const";
import constant from "../const/constant";
import { t } from "../i18n/i18n";

const oauthService = {

	/**
	 * 未登录·注册绑定（v1.3 语义修正）
	 * 为未绑定的 oauth 行注册一个全新站内邮箱并绑定。
	 * 门禁与普通注册一致：register=CLOSE 拒绝；regKey OPEN 必填 code 校验；
	 * 已存在邮箱 → 拒绝（防账号接管，维持安全语义）。
	 */
	async bindUser(c, params) {

		const { email, oauthUserId, provider, code } = params;

		const oauthRow = await this.getById(c, oauthUserId, provider);

		if (!oauthRow) {
			throw new BizError(t('oauthBindRowNotFound') || 'OAuth record not found')
		}

		let userRow = await userService.selectByIdIncludeDel(c, oauthRow.userId);

		if (userRow) {
			throw new BizError('用户已绑定有邮箱')
		}

		// 门禁修正：oauth 不再强制 register=OPEN / registerVerify=CLOSE（login-service 已去掉强开分支）
		await loginService.register(c, { email, password: cryptoUtils.genRandomPwd(), code }, true);

		userRow = await userService.selectByEmail(c, email);

		orm(c).update(oauth).set({ userId: userRow.userId }).where(and(eq(oauth.oauthUserId, oauthUserId), eq(oauth.provider, provider))).run();
		const jwtToken = await loginService.login(c, { email, password: null }, true);

		return { userInfo: oauthRow, token: jwtToken}
	},

	/**
	 * 登录态绑定（v1.3 新增，大网站模式）
	 * 已登录用户把当前 GitHub/Google/linux.do 授权行绑到自己的站内账号。
	 * 鉴权：/oauth 前缀被 security exclude，本方法内手动校验 JWT（同 security.js 逻辑）。
	 */
	async bind(c, params) {

		const { oauthUserId, provider } = params;

		// 手动鉴权（/oauth 在 exclude 中，中间件不校验）
		const jwt = c.req.header(constant.TOKEN_HEADER);
		const result = await jwtUtils.verifyToken(c, jwt);

		if (!result) {
			throw new BizError(t('authExpired'), 401);
		}

		const { userId, token } = result;
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });

		if (!authInfo) {
			throw new BizError(t('authExpired'), 401);
		}

		if (!authInfo.tokens.includes(token)) {
			throw new BizError(t('authExpired'), 401);
		}

		const oauthRow = await this.getById(c, oauthUserId, provider);

		if (!oauthRow) {
			throw new BizError(t('oauthBindRowNotFound') || 'OAuth record not found')
		}

		// 未绑定 → 绑到当前 userId；已绑当前 userId → 幂等成功；已绑其它 userId → 拒绝
		if (oauthRow.userId === 0 || oauthRow.userId === userId) {
			await orm(c).update(oauth).set({ userId }).where(and(eq(oauth.oauthUserId, oauthUserId), eq(oauth.provider, provider))).run();
			return { userInfo: oauthRow, token: jwt }
		}

		throw new BizError(t('oauthBoundOther') || 'This OAuth account is bound to another user')
	},

	async linuxDoLogin(c, params) {

		const { code } = params;

		let token = '';
		let userInfo = {}

		const reqParams = new URLSearchParams()
		reqParams.append('client_id', c.env.linuxdo_client_id)
		reqParams.append('client_secret', c.env.linuxdo_client_secret)
		reqParams.append('code', code)
		reqParams.append('redirect_uri', c.env.linuxdo_callback_url)
		reqParams.append('grant_type', 'authorization_code')

		const tokenRes = await fetch("https://connect.linux.do/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: reqParams.toString()
		})

		if (!tokenRes.ok) {
			throw new BizError(tokenRes.status === 400 ? t('oauthBadCode') : t('oauthTokenFailed'))
		}

		token = await tokenRes.json()

		const userRes = await fetch('https://connect.linux.do/api/user', {
			headers: {
				Authorization: 'Bearer ' + token.access_token
			}
		});

		if (!userRes.ok) {
			throw new BizError(t('oauthUserFailed'))
		}

		userInfo = await userRes.json();

		userInfo.oauthUserId = String(userInfo.id);
		userInfo.provider = 'linuxdo';
		userInfo.active = userInfo.active ? 0 : 1;
		userInfo.silenced = userInfo.silenced ? 0 : 1;
		userInfo.trustLevel = userInfo.trust_level;
		userInfo.avatar = userInfo.avatar_url;

		const  oauthRow = await this.saveUser(c, userInfo);
				const userRow = await userService.selectByIdIncludeDel(c, oauthRow.userId);
				// 会话守卫（登录态绑定 state=bind）：仅当用户从个人设置明确发起绑定（state=bind）时，
				// 才不自动登录、交由前端 oauthBind() 定归属；干净登录（首页点 OAuth，state!=bind）即使已登录也要正常登录。
				const isBind = params.state === 'bind';
				const sessionUserId = isBind ? await this.getLoggedInUserId(c) : null;

				if (sessionUserId) {
					return { userInfo: oauthRow, token: null }
				}


				if (!userRow) {
					return { userInfo: oauthRow, token: null }
				}

				const JwtToken = await loginService.login(c, { email: userRow.email, password: null }, true);
				return { userInfo: oauthRow, token: JwtToken }
			},

			async githubLogin(c, params) {

		const { code } = params;

		const reqParams = new URLSearchParams()
		reqParams.append('client_id', c.env.github_client_id)
		reqParams.append('client_secret', c.env.github_client_secret)
		reqParams.append('code', code)
		reqParams.append('redirect_uri', c.env.github_callback_url)

		const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json"
			},
			body: reqParams.toString()
		})

		if (!tokenRes.ok) {
			throw new BizError(t('oauthTokenFailed'))
		}

		const token = await tokenRes.json()

		if (!token.access_token) {
			// GitHub 返回 { error: "bad_verification_code", error_description: ... } 而非 4xx
			throw new BizError(t('oauthBadCode'))
		}

		const userRes = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: 'Bearer ' + token.access_token,
				'User-Agent': 'otsmail-worker'	// GitHub API 必填，否则 403
			}
		});

		if (!userRes.ok) {
			throw new BizError(t('oauthUserFailed'))
		}

		const githubUser = await userRes.json();

		// N-01 字段映射（架构 §3.1）：id/username/name/avatar_url + provider='github'
				const oauthRow = await this.saveUser(c, this.githubUserToOauth(githubUser));
				const userRow = await userService.selectByIdIncludeDel(c, oauthRow.userId);
				// 会话守卫（state=bind 才启用）：干净登录（首页点 OAuth）即使已登录也正常登录；
				// 仅登录态绑定（个人设置发起 state=bind）不在此自动登录，交由前端 oauthBind() 定归属。
				const isBind = params.state === 'bind';
				const sessionUserId = isBind ? await this.getLoggedInUserId(c) : null;

				if (sessionUserId) {
					return { userInfo: oauthRow, token: null }
				}


				if (!userRow) {
					return { userInfo: oauthRow, token: null }
				}

				const JwtToken = await loginService.login(c, { email: userRow.email, password: null }, true);
				return { userInfo: oauthRow, token: JwtToken }
			},

	/**
	 * N-01 Google OAuth 登录（v1.4 新增，OIDC）
	 * 流程：code → oauth2.googleapis.com/token 换 access_token/id_token → userinfo 取 email/email_verified
	 * → 落 oauth 表（provider='google'）。
	 * Google 特例：email_verified=true 且 email 已是站内用户 → 直接绑定返回 token（免注册，比 GitHub 顺）；
	 * 未注册 → token:null 引导注册绑定（必过注册码门禁，同 v1.3）。
	 */
	async googleLogin(c, params) {

		const { code } = params;

		const reqParams = new URLSearchParams()
		reqParams.append('client_id', c.env.google_client_id)
		reqParams.append('client_secret', c.env.google_client_secret)
		reqParams.append('code', code)
		reqParams.append('redirect_uri', c.env.google_callback_url)
		reqParams.append('grant_type', 'authorization_code')

		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: reqParams.toString()
		})

		if (!tokenRes.ok) {
			throw new BizError(t('oauthTokenFailed'))
		}

		const token = await tokenRes.json()

		if (!token.access_token) {
			// Google 返回 { error: "invalid_grant", error_description: ... } 而非 4xx
			throw new BizError(t('oauthBadCode'))
		}

		// OIDC userinfo（比解析 id_token JWT 简单且同样返回 email/email_verified）
		const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
			headers: {
				Authorization: 'Bearer ' + token.access_token
			}
		});

		if (!userRes.ok) {
			throw new BizError(t('oauthUserFailed'))
		}

		const googleUser = await userRes.json();

		// N-01 字段映射（架构 §3.1）：sub/email/name/picture + provider='google'
		const oauthRow = await this.saveUser(c, this.googleUserToOauth(googleUser));

		// 会话判断：仅登录态绑定（state=bind 已登录用户发起）时不在此自动登录，
				// 该 oauth 行归属交由前端 oauthBind() 决定（未绑→绑当前、已绑当前→幂等、已绑他人→oauthBoundOther 拒绝）。
				// 干净登录（首页点 Google，state!=bind）即使已登录也正常登录，杜绝"绑返回 token:null 误弹注册邮箱"。
				// 绝不按 bound-user 或 email 自动登录，杜绝"当前用户 A 绑定却被登进他人 B"的会话劫持。
				const isBind = params.state === 'bind';
				const sessionUserId = isBind ? await this.getLoggedInUserId(c) : null;

		if (sessionUserId) {
			return { userInfo: oauthRow, token: null }
		}

		// 纯登录（无会话）：email_verified=true 且 email 已是站内用户 → 直接绑定登录（标准 OIDC 免注册）
		if (googleUser.email_verified === true && googleUser.email) {
			const matchedUser = await userService.selectByEmailIncludeDel(c, googleUser.email);
			if (matchedUser && matchedUser.isDel !== 1) {
				await orm(c).update(oauth).set({ userId: matchedUser.userId }).where(and(eq(oauth.oauthUserId, String(googleUser.sub)), eq(oauth.provider, 'google'))).run();
				const JwtToken = await loginService.login(c, { email: googleUser.email, password: null }, true);
				return { userInfo: oauthRow, token: JwtToken }
			}
		}

		const userRow = await userService.selectByIdIncludeDel(c, oauthRow.userId);

		if (!userRow) {
			return { userInfo: oauthRow, token: null }
		}

		const JwtToken = await loginService.login(c, { email: userRow.email, password: null }, true);
		return { userInfo: oauthRow, token: JwtToken }
	},

	/**
	 * 读取当前会话 userId（/oauth 前缀被 security exclude，需手动校验 JWT）。
	 * 无有效会话返回 null（不抛错），供 googleLogin 判断是否纯登录场景。
	 */
	async getLoggedInUserId(c) {
		const jwt = c.req.header(constant.TOKEN_HEADER);
		if (!jwt) return null;
		const result = await jwtUtils.verifyToken(c, jwt);
		if (!result) return null;
		const { userId, token } = result;
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		if (!authInfo) return null;
		if (!authInfo.tokens.includes(token)) return null;
		return userId;
	},


	// N-01 纯函数：GitHub /user 响应 → oauth 表行（可单测）
	githubUserToOauth(u) {
		return {
			oauthUserId: String(u.id),
			provider: 'github',
			username: u.login,
			name: u.name,
			avatar: u.avatar_url
		};
	},

	// N-01 纯函数：Google userinfo 响应 → oauth 表行（可单测）
	googleUserToOauth(u) {
		return {
			oauthUserId: String(u.sub),
			provider: 'google',
			username: u.email,
			name: u.name,
			avatar: u.picture
		};
	},

	async saveUser(c, userInfo) {

		// 按 (provider, oauth_user_id) 定位，防跨平台撞号（v1.4 唯一索引）
		const userInfoRow = await this.getById(c, userInfo.oauthUserId, userInfo.provider);

		if (!userInfoRow) {
			return await orm(c).insert(oauth).values(userInfo).returning().get();
		} else {
			return await orm(c).update(oauth).set(userInfo).where(and(eq(oauth.oauthUserId, userInfo.oauthUserId), eq(oauth.provider, userInfo.provider))).returning().get();
		}
	},

	async getById(c, oauthUserId, provider) {
		// 兼容旧调用：未传 provider 时回退 linuxdo（存量行），避免存量 linuxdo 登录回归
		const p = provider || 'linuxdo';
		return await orm(c).select().from(oauth).where(and(eq(oauth.oauthUserId, oauthUserId), eq(oauth.provider, p))).get();
	},

	async deleteByUserId(c, userId) {
		await this.deleteByUserIds(c, [userId]);
	},

	async deleteByUserIds(c, userIds) {
		await orm(c).delete(oauth).where(inArray(oauth.userId, userIds)).run();
	},

	//定时任务凌晨清除未绑定邮箱的oauth用户
	async clearNoBindOathUser(c) {
		await orm(c).delete(oauth).where(eq(oauth.userId, 0)).run();
	},

}

export default  oauthService

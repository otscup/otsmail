import BizError from '../error/biz-error';
import userService from './user-service';
import emailUtils from '../utils/email-utils';
import { isDel, settingConst, userConst } from '../const/entity-const';
import JwtUtils from '../utils/jwt-utils';
import { v4 as uuidv4 } from 'uuid';
import KvConst from '../const/kv-const';
import constant from '../const/constant';
import userContext from '../security/user-context';
import verifyUtils from '../utils/verify-utils';
import accountService from './account-service';
import settingService from './setting-service';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import turnstileService from './turnstile-service';
import roleService from './role-service';
import regKeyService from './reg-key-service';
import dayjs from 'dayjs';
import { toUtc } from '../utils/date-uitil';
import { t } from '../i18n/i18n.js';
import verifyRecordService from './verify-record-service';
import totpUtils from '../utils/totp-utils';
import loginGuard from './login-guard';
import reqUtils from '../utils/req-utils';

// 会话上限：同一设备只留一条，所以 20 条足够覆盖多设备，又不会把 App 的 token 挤掉。
const MAX_SESSIONS = 20;

const loginService = {

	async register(c, params, oauth = false) {

		const { email, password, token, code } = params;

		let { regKey, register, registerVerify, regVerifyCount, minEmailPrefix, emailPrefixFilter } = await settingService.query(c)

		if (register === settingConst.register.CLOSE) {
			throw new BizError(t('regDisabled'));
		}

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		if (emailUtils.getName(email).length < minEmailPrefix) {
			throw new BizError(t('minEmailPrefix', { msg: minEmailPrefix } ));
		}

		if (emailPrefixFilter.some(content => emailUtils.getName(email).includes(content)))  {
			throw new BizError(t('banEmailPrefix'));
		}

		if (emailUtils.getName(email).length > 64) {
			throw new BizError(t('emailLengthLimit'));
		}

		if (password.length > 30) {
			throw new BizError(t('pwdLengthLimit'));
		}

		if (password.length < 6) {
			throw new BizError(t('pwdMinLength'));
		}

		if (!c.env.domain.includes(emailUtils.getDomain(email))) {
			throw new BizError(t('notEmailDomain'));
		}

		let type = null;
		let regKeyId = 0

		if (regKey === settingConst.regKey.OPEN) {
			const result = await this.handleOpenRegKey(c, regKey, code)
			type = result?.type
			regKeyId = result?.regKeyId
		}

		if (regKey === settingConst.regKey.OPTIONAL) {
			const result = await this.handleOpenOptional(c, regKey, code)
			type = result?.type
			regKeyId = result?.regKeyId
		}

		const accountRow = await accountService.selectByEmailIncludeDel(c, email);

		// 软删账号保留原数据；陌生注册者不能靠重新注册触发物理销毁。
		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		let defType = null

		if (!type) {
			const roleRow = await roleService.selectDefaultRole(c);
			defType = roleRow.roleId
		}


		const roleRow = await roleService.selectById(c, type || defType);

		if(!roleService.hasAvailDomainPerm(roleRow.availDomain, email)) {

			if (type) {
				throw new BizError(t('noDomainPermRegKey'),403)
			}

			if (defType) {
				throw new BizError(t('noDomainPermReg'),403)
			}

		}

		let regVerifyOpen = false

		if (registerVerify === settingConst.registerVerify.OPEN) {
			regVerifyOpen = true
			await turnstileService.verify(c,token)
		}

		if (registerVerify === settingConst.registerVerify.COUNT) {
			regVerifyOpen = await verifyRecordService.isOpenRegVerify(c, regVerifyCount);
			if (regVerifyOpen) {
				await turnstileService.verify(c,token)
			}
		}

		const { salt, hash } = await saltHashUtils.hashPassword(password, c);

		const userId = await userService.insert(c, { email, regKeyId,password: hash, salt, type: type || defType });

		await accountService.insert(c, { userId: userId, email, name: emailUtils.getName(email) });

		await userService.updateUserInfo(c, userId, true);

		if (regKey !== settingConst.regKey.CLOSE && type) {
			await regKeyService.reduceCount(c, code, 1);
		}

		if (registerVerify === settingConst.registerVerify.COUNT && !regVerifyOpen) {
			const row = await verifyRecordService.increaseRegCount(c);
			return {regVerifyOpen: row.count >= regVerifyCount}
		}

		return {regVerifyOpen}

	},

	async registerVerify() {

	},

	async handleOpenRegKey(c, regKey, code) {

		if (!code) {
			throw new BizError(t('emptyRegKey'));
		}

		const regKeyRow = await regKeyService.selectByCode(c, code);

		if (!regKeyRow) {
			throw new BizError(t('notExistRegKey'));
		}

		if (regKeyRow.count <= 0) {
			throw new BizError(t('noRegKeyCount'));
		}

		const today = toUtc().tz('Asia/Shanghai').startOf('day')
		const expireTime = toUtc(regKeyRow.expireTime).tz('Asia/Shanghai').startOf('day');

		if (expireTime.isBefore(today)) {
			throw new BizError(t('regKeyExpire'));
		}

		return { type: regKeyRow.roleId, regKeyId: regKeyRow.regKeyId };
	},

	async handleOpenOptional(c, regKey, code) {

		if (!code) {
			return null
		}

		const regKeyRow = await regKeyService.selectByCode(c, code);

		if (!regKeyRow) {
			return null
		}

		const today = toUtc().tz('Asia/Shanghai').startOf('day')
		const expireTime = toUtc(regKeyRow.expireTime).tz('Asia/Shanghai').startOf('day');

		if (regKeyRow.count <= 0 || expireTime.isBefore(today)) {
			return null
		}

		return { type: regKeyRow.roleId, regKeyId: regKeyRow.regKeyId };
	},

	async login(c, params, noVerifyPwd = false) {

		const { email, password, twoFactorCode } = params;

		if ((!email || !password) && !noVerifyPwd) {
			throw new BizError(t('emailAndPwdEmpty'));
		}

		if (!noVerifyPwd && await loginGuard.lockRemaining(c, email)) {
			throw new BizError(t('loginLocked'), 429);
		}

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (!userRow) {
			throw new BizError(t('notExistUser'));
		}

		if(userRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelUser'));
		}

		if(userRow.status === userConst.status.BAN) {
			throw new BizError(t('isBanUser'));
		}

		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password) && !noVerifyPwd) {
			if (await loginGuard.recordFailure(c, email)) {
				throw new BizError(t('loginLocked'), 429);
			}
			throw new BizError(t('IncorrectPwd'));
		}

		// 口令哈希平滑升级：旧库里的单轮 SHA-256 在本次登录成功后就地换成
		// PBKDF2，用户无感。失败不影响登录（下次登录再试）。
		if (!noVerifyPwd && password && cryptoUtils.isLegacyHash(userRow.password)) {
			try {
				const { salt, hash } = await cryptoUtils.hashPassword(password, c);
				await userService.updatePwd(c, userRow.userId, hash, salt);
			} catch (e) {
				console.warn('password rehash failed (non-fatal):', e.message);
			}
		}

		// 两步验证：密码通过后还要一次性验证码；twoFactorRequired 让密码登录强制走验证码。
		// 缺码/错码都回 428，前端据此弹输入框重提；OAuth 登录（noVerifyPwd）不走这里。
		if (!noVerifyPwd && (userRow.twoFactorSwitch === 1 || userRow.twoFactorRequired === 1)) {
			if (!twoFactorCode) {
				throw new BizError(t('needTwoFactorCode'), 428);
			}
			if (!await totpUtils.verify(userRow.twoFactorSecret, twoFactorCode)) {
				if (await loginGuard.recordFailure(c, email)) {
					throw new BizError(t('loginLocked'), 429);
				}
				throw new BizError(t('twoFactorCodeInvalid'), 428);
			}
		}

		if (!noVerifyPwd) await loginGuard.clear(c, email);

		// 配置的管理员落一个系统管理员角色会话，权限中间件不再按邮箱放行
		if (userRow.email === c.env.admin) userRow.type = 0;

		const uuid = uuidv4();
		const jwt = await JwtUtils.generateToken(c, { userId: userRow.userId, token: uuid }, constant.TOKEN_EXPIRE);

		let authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userRow.userId, { type: 'json' });

		const ua = reqUtils.getUserAgent(c);
		const sessionMeta = {
			ip: reqUtils.getIp(c),
			browser: ua.browser,
			os: ua.os,
			device: ua.device,
			time: dayjs().toISOString()
		};
		// 同一台机器重复登录只保留最新一条，否则会话列表会被同一设备刷满。
		const fingerprint = [sessionMeta.ip, sessionMeta.browser, sessionMeta.os, sessionMeta.device].join('|');

		if (authInfo && (authInfo.user.email === userRow.email)) {

			if (userRow.email === c.env.admin) authInfo.user.type = 0;

			if (!authInfo.sessions) authInfo.sessions = {};
			for (const [oldToken, meta] of Object.entries(authInfo.sessions)) {
				const oldFingerprint = [meta.ip, meta.browser, meta.os, meta.device].join('|');
				if (oldFingerprint !== fingerprint) continue;
				const oldIndex = authInfo.tokens.indexOf(oldToken);
				if (oldIndex !== -1) authInfo.tokens.splice(oldIndex, 1);
				delete authInfo.sessions[oldToken];
			}

			if (authInfo.tokens.length >= MAX_SESSIONS) {
				const dropped = authInfo.tokens.shift();
				if (authInfo.sessions) delete authInfo.sessions[dropped];
			}

			authInfo.tokens.push(uuid);

		} else {

			authInfo = {
				tokens: [],
				user: userRow,
				refreshTime: dayjs().toISOString()
			};

			authInfo.tokens.push(uuid);

		}

		// 会话元数据与 tokens 平行保存；旧 KV 没有 sessions 时按需补建。
		if (!authInfo.sessions) authInfo.sessions = {};
		authInfo.sessions[uuid] = sessionMeta;

		await userService.updateUserInfo(c, userRow.userId);

		await c.env.kv.put(KvConst.AUTH_INFO + userRow.userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
		return jwt;
	},

	async logout(c, userId) {
		const token = await userContext.getToken(c);
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		if (!authInfo?.tokens) return;
		const index = authInfo.tokens.findIndex(item => item === token);
		if (index === -1) return;
		authInfo.tokens.splice(index, 1);
		if (authInfo.sessions) delete authInfo.sessions[token];
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
	},

	async sessions(c, userId) {
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		const current = await userContext.getToken(c);
		const tokens = authInfo?.tokens || [];
		const meta = authInfo?.sessions || {};
		return tokens.map(token => ({
			id: token,
			current: token === current,
			ip: meta[token]?.ip || '',
			browser: meta[token]?.browser || '',
			os: meta[token]?.os || '',
			device: meta[token]?.device || '',
			time: meta[token]?.time || ''
		}));
	},

	async kickSession(c, userId, sessionId) {
		const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		if (!authInfo?.tokens) return;
		const index = authInfo.tokens.findIndex(item => item === sessionId);
		if (index === -1) throw new BizError(t('deviceNotFound'), 404);
		authInfo.tokens.splice(index, 1);
		if (authInfo.sessions) delete authInfo.sessions[sessionId];
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
	},

	// 扫码登录：网页拿 id 轮询，App 登录后确认，网页凭 id 换一次 token。
	async createQr(c) {
		await this.qrRateLimit(c, 'create', 20);
		const id = uuidv4().replace(/-/g, '');
		const ua = reqUtils.getUserAgent(c);
		// 发起方信息随二维码一起存，App 确认框才能显示「Chrome on Windows / IP」。
		const origin = {
			ip: reqUtils.getIp(c),
			browser: ua.browser,
			os: ua.os,
			device: ua.device
		};
		await c.env.kv.put(KvConst.QR_LOGIN + id, JSON.stringify({ status: 'pending', origin }), { expirationTtl: 120 });
		return { id, expiresIn: 120 };
	},

	async confirmQr(c, userId, id) {
		if (!id) throw new BizError(t('qrInvalid'), 400);
		const raw = await c.env.kv.get(KvConst.QR_LOGIN + id);
		if (!raw) throw new BizError(t('qrExpired'), 410);
		const data = JSON.parse(raw);
		// 幂等：同一用户重复确认（客户端重试）直接成功，不报错。
		if (data.status === 'confirmed') {
			if (data.userId === userId) return data.origin || {};
			throw new BizError(t('qrInvalid'), 400);
		}
		await c.env.kv.put(KvConst.QR_LOGIN + id, JSON.stringify({ status: 'confirmed', userId, origin: data.origin }), { expirationTtl: 120 });
		return data.origin || {};
	},

	async pollQr(c, id) {
		if (!id) throw new BizError(t('qrInvalid'), 400);
		await this.qrRateLimit(c, 'poll', 60);
		const raw = await c.env.kv.get(KvConst.QR_LOGIN + id);
		if (!raw) return { status: 'expired' };
		const data = JSON.parse(raw);
		if (data.status !== 'confirmed') return { status: 'pending' };
		// 一次性：先删再发 token，避免同一个二维码被重复兑换。
		await c.env.kv.delete(KvConst.QR_LOGIN + id);
		const userRow = await userService.selectById(c, data.userId);
		if (!userRow || userRow.isDel === isDel.DELETE) throw new BizError(t('notExistUser'));
		if (userRow.status === userConst.status.BAN) throw new BizError(t('isBanUser'));
		const token = await this.login(c, { email: userRow.email }, true);
		return { status: 'confirmed', token };
	},

	// 未登录接口按 IP 限流，避免有人刷 KV。KV 计数非原子，只做粗粒度防刷。
	async qrRateLimit(c, action, limit) {
		if (!c.env?.kv) return;
		const ip = reqUtils.getIp(c) || 'unknown';
		const minute = Math.floor(Date.now() / 60000);
		const key = `qr-rl:${action}:${ip}:${minute}`;
		const used = Number(await c.env.kv.get(key)) || 0;
		if (used >= limit) throw new BizError(t('qrTooMany'), 429);
		await c.env.kv.put(key, String(used + 1), { expirationTtl: 120 });
	}

};

export default loginService;

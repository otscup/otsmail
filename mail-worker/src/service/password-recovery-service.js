import orm from '../entity/orm';
import { user } from '../entity/user';
import { eq } from 'drizzle-orm';
import settingService from './setting-service';
import emailService from './email-service';
import cryptoUtils from '../utils/crypto-utils';
import BizError from '../error/biz-error';
import constant from '../const/constant';
import KvConst from '../const/kv-const';
import authCache from './auth-cache';

const CODE_EXPIRE_SECONDS = 10 * 60; // 验证码 10 分钟有效
const IP_WINDOW_SECONDS = 60 * 60; // IP 1 小时窗口
const USER_WINDOW_SECONDS = 24 * 60 * 60; // 账号 24 小时窗口
const CODE_MAX_ATTEMPTS = 5; // 验证码最多允许输错的次数
// 账号不存在 / 未绑定有效辅助邮箱时，返回与真实发送完全一致的响应，避免被用来枚举账号
const NEUTRAL_MASK = '***';

function clientIp(c) {
	return c.req?.header('CF-Connecting-IP') || c.req?.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function sha256Hex(str) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
	return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function maskEmail(email) {
	if (!email || !email.includes('@')) return '***';
	const [name, domain] = email.split('@');
	if (name.length <= 2) {
		return `${name[0]}***@${domain}`;
	}
	return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

/**
 * 6 位验证码：crypto.getRandomValues + 拒绝采样。
 * Math.random() 不是密码学安全随机源（内部状态可从少量输出反推），
 * 直接取模又会有分布偏置，所以这里对 900000 个取值做整区间拒绝采样。
 */
function secureResetCode() {
	const range = 900000; // 100000 ~ 999999
	const limit = Math.floor(0x100000000 / range) * range;
	const buf = new Uint32Array(1);
	let value;
	do {
		crypto.getRandomValues(buf);
		value = buf[0];
	} while (value >= limit);
	return String(100000 + (value % range));
}

/**
 * 先占位、失败回滚的限额占位。
 * KV 没有原子自增，原先「先读 → 发信 → 再写」在并发下会被同时放行多次；
 * 这里改成先写入独立占位键，再按前缀统计当前窗口内的占位数，超限立刻删掉自己的占位并拒绝。
 */
async function reserveQuota(kv, prefix, hash, limit, ttlSeconds, errorMessage) {
	const slotKey = `${prefix}:${hash}:${crypto.randomUUID()}`;
	await kv.put(slotKey, '1', { expirationTtl: ttlSeconds });
	const listed = await kv.list({ prefix: `${prefix}:${hash}:` });
	if ((listed?.keys?.length || 0) > limit) {
		await kv.delete(slotKey);
		throw new BizError(errorMessage, 429);
	}
	return slotKey;
}

const passwordRecoveryService = {

	maskEmail,

	/**
	 * 发送密码重置验证码
	 */
	async sendResetCode(c, params) {
		const targetEmail = String(params?.email || '').trim().toLowerCase();
		if (!targetEmail) {
			throw new BizError('请输入需要找回密码的邮箱账号', 400);
		}

		const settings = await settingService.query(c);
		if (settings.passwordResetSwitch === 0) {
			throw new BizError('系统已关闭找回密码功能，请联系管理员', 403);
		}

		const kv = c.env?.kv;
		if (!kv) {
			// 之前 KV 缺失时会照常发信，但验证码和限额都不落库，用户拿到的码永远无效，属于静默降级
			console.error('[passwordRecovery] KV 未绑定，无法发送重置验证码');
			throw new BizError('系统存储不可用，请联系系统管理员', 500);
		}

		const ip = clientIp(c);
		const ipHash = await sha256Hex(ip);
		const userHash = await sha256Hex(targetEmail);

		const codeKey = `pwd_reset_code:${userHash}`;

		const ipLimit = Number(settings.passwordResetIpLimit || 3);
		const userLimit = Number(settings.passwordResetUserLimit || 3);

		// 先占位，再做任何可能有副作用的事情
		const ipSlot = await reserveQuota(
			kv, 'pwd_reset_ip', ipHash, ipLimit, IP_WINDOW_SECONDS,
			`当前 IP 请求频繁，已超出每小时限制 (${ipLimit} 次)，请稍后再试`
		);

		let userSlot;
		try {
			userSlot = await reserveQuota(
				kv, 'pwd_reset_user', userHash, userLimit, USER_WINDOW_SECONDS,
				`该账号今日找回次数已达上限 (${userLimit} 次)，请明日再试或联系管理员`
			);
		} catch (e) {
			await kv.delete(ipSlot);
			throw e;
		}

		let codeKeyWritten = false;
		try {
			const userRow = await orm(c).select().from(user)
				.where(eq(user.email, targetEmail)).get();

			const recoveryEmail = String(userRow?.recoveryEmail || '').trim();
			// 账号不存在 / 已删除 / 未绑定有效辅助邮箱：统一返回与真实发送相同的响应
			if (!userRow || userRow.isDel === 1 || !recoveryEmail || !recoveryEmail.includes('@')) {
				console.warn('[passwordRecovery] 请求未命中可发送账号，已返回通用响应');
				return { maskedRecoveryEmail: NEUTRAL_MASK };
			}

			// 获取 Resend 发信 Token 与发信人地址
			const resendTokens = settings.resendTokens || {};
			let senderEmail = String(settings.systemSenderEmail || '').trim();
			let token = '';

			if (senderEmail && senderEmail.includes('@')) {
				const senderDomain = senderEmail.split('@')[1];
				token = resendTokens[senderDomain] || Object.values(resendTokens)[0];
			} else {
				const firstDomain = Object.keys(resendTokens)[0];
				token = resendTokens[firstDomain];
				senderEmail = firstDomain ? `noreply@${firstDomain}` : (settings.admin || 'noreply@example.com');
			}

			if (!token) {
				console.error('[passwordRecovery] 未配置 Resend Token，无法发送重置邮件');
				throw new BizError('发信服务未配置，请联系系统管理员', 500);
			}

			const code = secureResetCode();

			// 先落库再发信：KV 写失败时用户不会收到一封永远无效的验证码
			await kv.put(codeKey, JSON.stringify({
				code,
				recoveryEmail,
				failAttempts: 0,
				// 记录首次下发时间，后续输错重写时按剩余有效期续写，不能无限续期
				expiresAt: Date.now() + CODE_EXPIRE_SECONDS * 1000
			}), { expirationTtl: CODE_EXPIRE_SECONDS });
			codeKeyWritten = true;

			const siteTitle = settings.title || 'OTSMail';
			const subject = `【${siteTitle}】重置密码验证码`;
			const html = `
				<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
					<h2 style="color: #1e293b; margin-top: 0;">重置您的 ${siteTitle} 密码</h2>
					<p style="color: #475569; font-size: 15px; line-height: 1.6;">
						您好！系统收到了账号 <strong>${targetEmail}</strong> 的找回密码请求。
					</p>
					<p style="color: #475569; font-size: 15px; line-height: 1.6;">
						您的密码重置验证码为：
					</p>
					<div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
						<span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #2563eb;">${code}</span>
					</div>
					<p style="color: #64748b; font-size: 13px; line-height: 1.5;">
						该验证码有效期为 <strong>10 分钟</strong>。若非您本人操作，请忽略此邮件，您的账号安全不受影响。
					</p>
					<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
					<p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">此邮件由系统自动发出，请勿直接回复。</p>
				</div>
			`;

			// 调 Resend 发送
			await emailService.sendByResend(token, {
				name: siteTitle,
				accountEmail: senderEmail,
				receiveEmail: [recoveryEmail],
				subject,
				text: `您的重置密码验证码为 ${code}，10 分钟内有效。`,
				html
			});

			return {
				maskedRecoveryEmail: maskEmail(recoveryEmail)
			};
		} catch (e) {
			// 发信/配置失败：回滚本次占位与验证码，避免把限额白白占掉
			if (codeKeyWritten) {
				await kv.delete(codeKey);
			}
			await kv.delete(ipSlot);
			await kv.delete(userSlot);
			throw e;
		}
	},

	/**
	 * 验证验证码并重置密码
	 */
	async confirmReset(c, params) {
		const targetEmail = String(params?.email || '').trim().toLowerCase();
		const code = String(params?.code || '').trim();
		const newPassword = String(params?.newPassword || '');

		if (!targetEmail || !code || !newPassword) {
			throw new BizError('请完整输入邮箱账号、验证码及新密码', 400);
		}

		if (newPassword.length < 6) {
			throw new BizError('密码长度不能少于 6 位', 400);
		}
		if (newPassword.length > 30) {
			throw new BizError('密码长度不能超过 30 位', 400);
		}

		const userHash = await sha256Hex(targetEmail);
		const codeKey = `pwd_reset_code:${userHash}`;

		if (!c.env?.kv) {
			throw new BizError('系统存储不可用', 500);
		}

		const stored = await c.env.kv.get(codeKey, { type: 'json' });
		if (!stored) {
			throw new BizError('验证码已过期或不存在，请重新获取', 400);
		}

		// 以首次下发时间为准判断过期，避免 KV TTL 粒度或旧数据导致窗口被延长
		const expiresAt = Number(stored.expiresAt) || 0;
		const remainingSeconds = expiresAt ? Math.ceil((expiresAt - Date.now()) / 1000) : 0;
		if (expiresAt && remainingSeconds <= 0) {
			await c.env.kv.delete(codeKey);
			throw new BizError('验证码已过期，请重新获取', 400);
		}

		if (!cryptoUtils.timingSafeEqual(String(stored.code || ''), code)) {
			stored.failAttempts = (stored.failAttempts || 0) + 1;
			if (stored.failAttempts >= CODE_MAX_ATTEMPTS) {
				await c.env.kv.delete(codeKey);
				throw new BizError('验证码连续错误次数过多，已作废，请重新获取', 400);
			}
			// 续写只按首次下发时间计算剩余有效期，错误尝试不能把 10 分钟窗口一直往后推。
			// KV 的 expirationTtl 最低 60 秒，不足时按 60 兜底——过期判定仍以 expiresAt 为准，
			// 所以多留几十秒的 KV 记录不会让已过期的验证码重新可用。
			const rewriteTtl = expiresAt ? Math.max(60, remainingSeconds) : CODE_EXPIRE_SECONDS;
			await c.env.kv.put(codeKey, JSON.stringify(stored), {
				expirationTtl: rewriteTtl
			});
			throw new BizError(`验证码不正确（剩余尝试次数：${CODE_MAX_ATTEMPTS - stored.failAttempts}）`, 400);
		}

		const userRow = await orm(c).select().from(user)
			.where(eq(user.email, targetEmail)).get();

		if (!userRow || userRow.isDel === 1) {
			throw new BizError('账号异常，重置失败', 400);
		}

		// 使用最新 PBKDF2 哈希并更新密码
		const { salt, hash } = await cryptoUtils.hashPassword(newPassword, c);
		await orm(c).update(user).set({
			password: hash,
			salt
		}).where(eq(user.userId, userRow.userId)).run();

		// 清除历史会话 / tokens，强制下线
		await c.env.kv.delete(KvConst.AUTH_INFO + userRow.userId);
		authCache.clear(userRow.userId);

		// 删除验证码
		await c.env.kv.delete(codeKey);

		return true;
	}
};

export default passwordRecoveryService;

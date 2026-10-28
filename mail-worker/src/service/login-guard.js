import telegramService from './telegram-service';

const FAIL_LIMIT = 5;
const FAIL_WINDOW = 15 * 60;
const LOCK_SECONDS = 15 * 60;

function clientIp(c) {
	return c.req?.header('CF-Connecting-IP') || c.req?.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function key(c, email) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${email.toLowerCase()}:${clientIp(c)}`));
	return 'login_fail:' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function read(c, email) {
	if (!c.env?.kv) return null;
	return c.env.kv.get(await key(c, email), { type: 'json' });
}

async function alert(c, email, left) {
	const text = `otsmail 登录告警\n账号：${email}\nIP：${clientIp(c)}\n连续失败：${FAIL_LIMIT} 次\n已锁定：${left} 分钟\n时间：${new Date().toISOString()}`;
	const p = telegramService.sendAlert(c, text).catch(() => {});
	if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(p);
	else void p;
}

const loginGuard = {

	async lockRemaining(c, email) {
		const rec = await read(c, email);
		return rec?.lockedUntil > Date.now() ? Math.ceil((rec.lockedUntil - Date.now()) / 60000) : 0;
	},

	async recordFailure(c, email) {
		if (!c.env?.kv) return false;
		const k = await key(c, email);
		const rec = await c.env.kv.get(k, { type: 'json' }) || { count: 0 };
		rec.count = (rec.count || 0) + 1;
		rec.lockedUntil = rec.count >= FAIL_LIMIT ? Date.now() + LOCK_SECONDS * 1000 : 0;
		const ttl = rec.lockedUntil ? LOCK_SECONDS : FAIL_WINDOW;
		await c.env.kv.put(k, JSON.stringify(rec), { expirationTtl: ttl });
		if (rec.lockedUntil) await alert(c, email, LOCK_SECONDS / 60);
		return Boolean(rec.lockedUntil);
	},

	async clear(c, email) {
		if (c.env?.kv) await c.env.kv.delete(await key(c, email));
	}
};

export default loginGuard;

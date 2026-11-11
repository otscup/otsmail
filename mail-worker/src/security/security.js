import BizError from '../error/biz-error';
import constant from '../const/constant';
import jwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import dayjs from 'dayjs';
import userService from '../service/user-service';
import permService from '../service/perm-service';
import { t } from '../i18n/i18n'
import mcpService from '../service/mcp-service';
import app from '../hono/hono';

// Match by path segment: /email/send must not match /email/sendxxx, or sibling routes borrow each other's permission.
export function pathMatches(path, prefix) {
	if (path === prefix) return true;
	if (!path.startsWith(prefix)) return false;
	return path.charAt(prefix.length) === '/';
}

const exclude = [
	'/login',
	'/register',
	'/password/reset',
	'/oss',
	'/setting/websiteConfig',
	'/webhooks',
	'/init',
	'/email/wsock',
	'/public/genToken',
	'/telegram',
	'/test',
	'/oauth',
	'/push/key',
	'/version',
	'/proxy/image',
	'/proxy/css',
	'/.well-known'
];

const requirePerms = [
	'/email/send',
	'/email/schedule',
	'/email/retry',
	'/email/delete',
	'/email/clearDeleted',
	'/account/list',
	'/account/delete',
	'/account/add',
	'/my/delete',
	'/analysis/echarts',
	'/analysis/usage',
	'/analysis/cloudflare',
	'/update/check',
	'/role/add',
	'/role/list',
	'/role/delete',
	'/role/tree',
	'/role/set',
	'/role/setDefault',
	'/allEmail/list',
	'/allEmail/delete',
	'/allEmail/batchDelete',
	'/allEmail/latest',
	'/setting/setBackground',
	'/setting/deleteBackground',
	'/setting/set',
	'/setting/query',
	'/setting/setBlacklist',
	'/setting/webhookTest',
	'/setting/tgWebhook',
	'/setting/aiModels',
	'/user/delete',
	'/user/setPwd',
	'/user/setStatus',
	'/user/setType',
	'/user/list',
	'/user/restore',
	'/user/resetSendCount',
	'/user/add',
	'/user/deleteAccount',
	'/user/allAccount',
	'/user/permList',
	'/user/permSet',
	'/regKey/add',
	'/regKey/list',
	'/regKey/delete',
	'/regKey/clearNotUse',
	'/regKey/history',
	'/ai'
];

const premKey = {
	'email:delete': ['/email/delete', '/email/clearDeleted'],
	'email:send': ['/email/send', '/email/schedule', '/email/retry'],
	'account:add': ['/account/add'],
	'account:query': ['/account/list'],
	'account:delete': ['/account/delete'],
	'my:delete': ['/my/delete'],
	'role:add': ['/role/add'],
	'role:set': ['/role/set','/role/setDefault'],
	'role:query': ['/role/list', '/role/tree'],
	'role:delete': ['/role/delete'],
	'user:query': ['/user/list','/user/allAccount','/user/permList'],
	'user:add': ['/user/add'],
	'user:reset-send': ['/user/resetSendCount'],
	'user:set-pwd': ['/user/setPwd'],
	'user:set-status': ['/user/setStatus', '/user/restore'],
	'user:set-type': ['/user/setType','/user/permSet'],
	'user:delete': ['/user/delete','/user/deleteAccount'],
	'all-email:query': ['/allEmail/list','/allEmail/latest'],
	'all-email:delete': ['/allEmail/delete','/allEmail/batchDelete'],
	'setting:query': ['/setting/query'],
	'setting:set': ['/setting/set', '/setting/setBackground','/setting/deleteBackground','/setting/setBlacklist','/setting/webhookTest','/setting/tgWebhook','/setting/aiModels'],
	'analysis:query': ['/analysis/echarts', '/analysis/usage', '/analysis/cloudflare'],
	'reg-key:add': ['/regKey/add'],
	'reg-key:query': ['/regKey/list','/regKey/history'],
	'reg-key:delete': ['/regKey/delete','/regKey/clearNotUse'],
	'ai:use': ['/ai/reply', '/ai/summary', '/ai/polish', '/ai/classify', '/ai/command'],
};

app.use('*', async (c, next) => {

	const path = c.req.path;

	// Streamable HTTP 鏃犵姸鎬佹ā寮忎笉鎻愪緵 GET SSE / DELETE 浼氳瘽锛涘厛浜庨壌鏉冭繑鍥?405銆?
	if (path === '/mcp' && (c.req.method === 'GET' || c.req.method === 'DELETE')) {
		return c.text('', 405, { Allow: 'POST' });
	}

	const index = exclude.findIndex(item => {
		return pathMatches(path, item);
	});

	if (index > -1) {
		return await next();
	}

	if (pathMatches(path, '/public')) {

		const userPublicToken = await c.env.kv.get(KvConst.PUBLIC_KEY);
		const publicToken = c.req.header(constant.TOKEN_HEADER);
		if (!constantTimeEqual(publicToken || '', userPublicToken || '')) {
			throw new BizError(t('publicTokenFail'), 401);
		}
		return await next();
	}


	// Token 鍙粠 Authorization 澶磋鍙栵紝閬垮厤鍑虹幇鍦?URL銆佷唬鐞嗗拰璁块棶鏃ュ織涓?
	const jwt = c.req.header(constant.TOKEN_HEADER);

	// MCP 璁块棶浠ょ墝锛坢cp_ 鍓嶇紑锛夛細涓?JWT 鍏辩敤鍚屼竴濂楃敤鎴蜂笂涓嬫枃涓庢潈闄愭牎楠岋紝鍙槸涓嶆煡 KV 浼氳瘽琛?
	const mcpAuth = await mcpService.verifyBearer(c, jwt);

	if (mcpAuth) {
		const mcpOn = c.env.mcp_switch === true || String(c.env.mcp_switch).toLowerCase() === 'true';
		if (!mcpOn) throw new BizError('MCP is disabled', 401);
		if (!pathMatches(path, '/mcp')) throw new BizError('MCP token only valid for /mcp', 403);
	}

	const result = mcpAuth ? { userId: mcpAuth.userId, token: null, viaMcp: true } : await jwtUtils.verifyToken(c, jwt);

	if (!result) {
		throw new BizError(t('authExpired'), 401);
	}

	const { userId, token } = result;
	const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });

	if (!authInfo) {
		throw new BizError(t('authExpired'), 401);
	}

	if (!result.viaMcp && !authInfo.tokens.includes(token)) {
		throw new BizError(t('authExpired'), 401);
	}

	// 绯荤粺绠＄悊鍛樻潈闄愪笉鑳藉彧淇?KV 蹇収锛氶檷绾у悗鏃у揩鐓ф渶澶氳繕鑳芥椿鍒拌法澶┿€?
	if (!result.viaMcp && Number(authInfo.user.type) === 0) {
		const liveUser = await userService.selectById(c, userId);
		if (!liveUser || Number(liveUser.type) !== 0) {
			throw new BizError(t('authExpired'), 401);
		}
	}

	const permIndex = requirePerms.findIndex(item => {
		return pathMatches(path, item);
	});

	if (permIndex > -1) {

		const permKeys = await permService.userPermKeys(c, authInfo.user.userId);

		const userPaths = permKeyToPaths(permKeys);

		const userPermIndex = userPaths.findIndex(item => {
			return pathMatches(path, item);
		});

		// 0 鏄郴缁熺鐞嗗憳瑙掕壊锛涗笉鍐嶆寜閭瀛楃涓叉斁琛?
		if (userPermIndex === -1 && Number(authInfo.user.type) !== 0) {
			throw new BizError(t('unauthorized'), 403);
		}

	}

	const now = dayjs();
	const refreshTime = dayjs(authInfo.refreshTime).startOf('day');
	const nowTime = now.startOf('day');
	let dirty = false;

	if (!nowTime.isSame(refreshTime)) {
		authInfo.refreshTime = now.toISOString();
		await userService.updateUserInfo(c, authInfo.user.userId);
		dirty = true;
	}

	// 设备列表的「最近活跃」此前只在 login() 里写一次，长期保持登录就永远停在首次登录那天。
	// 这里按 5 分钟节流回写当前会话的活跃时间：KV 同一个 key 每秒只能写一次，不能每个请求都写。
	if (!result.viaMcp && token && authInfo.sessions?.[token]) {
		const lastActive = dayjs(authInfo.sessions[token].time);
		if (!lastActive.isValid() || now.diff(lastActive, 'minute') >= 5) {
			authInfo.sessions[token].time = now.toISOString();
			dirty = true;
		}
	}

	if (dirty) {
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
	}

	c.set('user',authInfo.user)

	return await next();
});

function constantTimeEqual(a, b) {
	const left = new TextEncoder().encode(String(a));
	const right = new TextEncoder().encode(String(b));
	if (left.length !== right.length) return false;
	let diff = 0;
	for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
	return diff === 0;
}

function permKeyToPaths(permKeys) {

	const paths = [];

	for (const key of permKeys) {
		const routeList = premKey[key];
		if (routeList && Array.isArray(routeList)) {
			paths.push(...routeList);
		}
	}
	return paths;
}

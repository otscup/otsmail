import KvConst from '../const/kv-const';

/**
 * 鉴权快照（kv 里的 auth-uid:<userId>）的 isolate 级内存缓存。
 *
 * 为什么只按 userId 做键：
 *   KV 里存的本来就是「一个用户的整份会话」，tokens / sessions / user 全在同一个 value 里。
 *   按 token 做键会把同一份数据复制多份，且任何一处会话变更都得扫全表失效；
 *   按 userId 缓存，取出来的 tokens 仍然要逐请求校验当前 token，不可能串号。
 *
 * 每次命中都重新 JSON.parse，返回全新对象：中间件会改 refreshTime / sessions[token].time，
 * 共享同一个对象会让并发请求互相污染。
 *
 * 一致性边界：本实例内写操作立即 clear；其它实例最多滞后 TTL（30 秒）。
 * KV 本身跨边缘节点就有传播延迟，30 秒缓存不改变最终一致语义。
 * 回滚：把环境变量 auth_cache_switch 设为 0 / false，enabled() 返回 false，
 *       get() 退化为每次直接读 KV，与改动前完全一致。
 */
const TTL_MS = 30 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map();

function enabled(c) {
	const value = c.env?.auth_cache_switch;
	if (value === undefined || value === null || value === '') return true;
	if (value === false || value === 0) return false;
	const text = String(value).toLowerCase();
	return text !== '0' && text !== 'false';
}

const authCache = {
	enabled,

	async get(c, userId) {
		if (!enabled(c)) {
			return await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
		}

		const key = String(userId);
		const hit = cache.get(key);
		if (hit && hit.expireAt > Date.now()) {
			if (!hit.json) return null;
			try {
				return JSON.parse(hit.json);
			} catch (e) {
				cache.delete(key);
				return null;
			}
		}

		const json = await c.env.kv.get(KvConst.AUTH_INFO + userId);

		if (cache.size >= MAX_ENTRIES) {
			const now = Date.now();
			for (const [k, item] of cache) {
				if (item.expireAt <= now) cache.delete(k);
			}
			if (cache.size >= MAX_ENTRIES) cache.clear();
		}
		cache.set(key, { json, expireAt: Date.now() + TTL_MS });

		if (!json) return null;
		try {
			return JSON.parse(json);
		} catch (e) {
			cache.delete(key);
			return null;
		}
	},

	// 中间件/登录回写 KV 后同步缓存，避免同一实例紧接着再读一次 KV
	put(c, userId, authInfo) {
		if (!enabled(c)) return;
		cache.set(String(userId), { json: JSON.stringify(authInfo), expireAt: Date.now() + TTL_MS });
	},

	// 所有会改变会话/账号状态的写操作都必须调用；不依赖 TTL 过期
	clear(userId) {
		cache.delete(String(userId));
	}
};

export default authCache;

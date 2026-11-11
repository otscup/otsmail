import { describe, expect, it, vi } from 'vitest';
import authCache from '../src/service/auth-cache';

// 构造一个最小 ctx：只提供 auth-cache 用到的 env.kv.get 并统计调用次数
function fakeC(switchValue, initial = {}) {
	const store = { ...initial };
	const state = { reads: 0 };
	return {
		env: {
			auth_cache_switch: switchValue,
			kv: {
				async get(key) {
					state.reads++;
					return store[key] === undefined ? null : store[key];
				}
			}
		},
		store,
		state
	};
}

describe('auth isolate cache', () => {
	it('同一实例连续 5 次请求只读 1 次 KV，且每次返回独立对象', async () => {
		const c = fakeC(undefined, { 'auth-uid:101': JSON.stringify({ tokens: ['t1'], user: { userId: 101 } }) });

		const first = await authCache.get(c, 101);
		const second = await authCache.get(c, 101);
		await authCache.get(c, 101);
		await authCache.get(c, 101);
		await authCache.get(c, 101);

		expect(c.state.reads).toBe(1);
		expect(second).toEqual(first);
		// 中间件会改 refreshTime / sessions.time，不能共享引用
		expect(second).not.toBe(first);
	});

	it('不同 userId 互不共享', async () => {
		const c = fakeC(undefined, {
			'auth-uid:201': JSON.stringify({ tokens: ['a'], user: { userId: 201 } }),
			'auth-uid:202': JSON.stringify({ tokens: ['b'], user: { userId: 202 } })
		});

		expect((await authCache.get(c, 201)).user.userId).toBe(201);
		expect((await authCache.get(c, 202)).user.userId).toBe(202);
		expect(c.state.reads).toBe(2);
	});

	it('30 秒 TTL 到期后重新读 KV', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-12T00:00:00Z'));
		const c = fakeC(undefined, { 'auth-uid:301': JSON.stringify({ tokens: ['t'] }) });

		await authCache.get(c, 301);
		vi.advanceTimersByTime(29 * 1000);
		await authCache.get(c, 301);
		expect(c.state.reads).toBe(1);

		vi.advanceTimersByTime(2 * 1000);
		await authCache.get(c, 301);
		expect(c.state.reads).toBe(2);
		vi.useRealTimers();
	});

	it('clear 后立即失效，put 后不再读 KV', async () => {
		const c = fakeC(undefined, { 'auth-uid:401': JSON.stringify({ tokens: ['t'] }) });

		await authCache.get(c, 401);
		authCache.clear(401);
		await authCache.get(c, 401);
		expect(c.state.reads).toBe(2);

		authCache.put(c, 401, { tokens: ['t', 't2'] });
		const after = await authCache.get(c, 401);
		expect(c.state.reads).toBe(2);
		expect(after.tokens).toEqual(['t', 't2']);
	});

	it('空值也缓存，避免无效 token 反复读 KV', async () => {
		const c = fakeC(undefined);
		expect(await authCache.get(c, 501)).toBeNull();
		expect(await authCache.get(c, 501)).toBeNull();
		expect(c.state.reads).toBe(1);
	});

	it('开关关闭时退回每次直读 KV（回滚路径）', async () => {
		const c = fakeC(0, { 'auth-uid:601': JSON.stringify({ tokens: ['t'] }) });
		expect(authCache.enabled(c)).toBe(false);

		await authCache.get(c, 601);
		await authCache.get(c, 601);
		await authCache.get(c, 601);

		expect(c.state.reads).toBe(3);
	});
});

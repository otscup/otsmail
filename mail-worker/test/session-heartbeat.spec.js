import { describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';

vi.mock('../src/security/user-context', () => ({
	default: {
		getToken: vi.fn(async () => 'cur'),
		getUserId: vi.fn(() => 1)
	}
}));

vi.mock('../src/service/user-service', () => ({
	default: {
		updateUserInfo: vi.fn(async () => {})
	}
}));

import sessionHeartbeat from '../src/service/session-heartbeat';
import loginService from '../src/service/login-service';
import userService from '../src/service/user-service';

function fakeC(switchValue, authInfo) {
	const state = { kvWrites: 0, updates: 0, upserts: 0, deletes: 0, activeTime: null };

	const db = {
		prepare(sql) {
			const text = sql.replace(/\s+/g, ' ').trim();
			return {
				bind(...args) {
					return {
						async run() {
							if (text.startsWith('UPDATE')) {
								state.updates++;
								state.activeTime = args[0];
							} else if (text.startsWith('INSERT')) {
								state.upserts++;
							} else if (text.startsWith('DELETE')) {
								state.deletes++;
							}
							return { success: true };
						},
						async all() {
							return { results: [] };
						}
					};
				}
			};
		}
	};

	const c = {
		env: {
			heartbeat_write_kv_switch: switchValue,
			kv: {
				async get() {
					return authInfo;
				},
				async put() {
					state.kvWrites++;
				}
			},
			db
		}
	};
	return { c, state };
}

function baseAuth(now, overrides = {}) {
	return {
		tokens: ['cur'],
		user: { userId: 1 },
		refreshTime: now.toISOString(),
		sessions: {
			cur: { ip: '1.1.1.1', browser: 'Chrome', os: 'Windows10', device: 'Desktop', time: now.subtract(10, 'minute').toISOString() }
		},
		...overrides
	};
}

const NOW = dayjs('2026-11-12T10:00:00');

describe('心跳写路径', () => {
	it('默认心跳不写 KV，只更新 D1 active_time', async () => {
		const authInfo = baseAuth(NOW);
		const { c, state } = fakeC(undefined, authInfo);

		const plan = await sessionHeartbeat.apply(c, authInfo, 101, 'cur', NOW);

		expect(state.kvWrites).toBe(0);
		expect(state.updates).toBe(1);
		expect(state.activeTime).toBe(NOW.toISOString());
		// KV 快照里的活跃时间保持原样，不再为心跳改写
		expect(authInfo.sessions.cur.time).toBe(NOW.subtract(10, 'minute').toISOString());
		expect(plan.kvDirty).toBe(false);
		expect(plan.d1Touch).toBe(true);
	});

	it('同一 token 5 分钟内只写一次 D1', async () => {
		const authInfo = baseAuth(NOW);
		const { c, state } = fakeC(undefined, authInfo);

		await sessionHeartbeat.apply(c, authInfo, 102, 'cur', NOW);
		await sessionHeartbeat.apply(c, authInfo, 102, 'cur', NOW.add(1, 'minute'));
		expect(state.updates).toBe(1);

		await sessionHeartbeat.apply(c, authInfo, 102, 'cur', NOW.add(6, 'minute'));
		expect(state.updates).toBe(2);
	});

	it('跨天时 KV 仍写一次，refreshTime 与用户级活跃信息都更新', async () => {
		const authInfo = baseAuth(NOW, { refreshTime: NOW.subtract(1, 'day').toISOString() });
		const { c, state } = fakeC(undefined, authInfo);
		userService.updateUserInfo.mockClear();

		const plan = await sessionHeartbeat.apply(c, authInfo, 103, 'cur', NOW);

		expect(plan.refreshDue).toBe(true);
		expect(state.kvWrites).toBe(1);
		expect(userService.updateUserInfo).toHaveBeenCalledTimes(1);
		expect(authInfo.refreshTime).toBe(NOW.toISOString());
		// 跨天写 KV 顺带带上 D1 活跃时间，但不改 sessions.time
		expect(authInfo.sessions.cur.time).toBe(NOW.subtract(10, 'minute').toISOString());
		expect(state.updates).toBe(1);
	});

	it('开关打开时退回老行为：活跃时间写 KV 且 D1 补建行', async () => {
		const authInfo = baseAuth(NOW);
		const { c, state } = fakeC(1, authInfo);

		const plan = await sessionHeartbeat.apply(c, authInfo, 104, 'cur', NOW);

		expect(plan.kvDirty).toBe(true);
		expect(plan.kvTouch).toBe(true);
		expect(state.kvWrites).toBe(1);
		expect(authInfo.sessions.cur.time).toBe(NOW.toISOString());
		expect(state.upserts).toBe(1);
		expect(state.updates).toBe(0);
	});

	it('登出仍写 KV', async () => {
		const authInfo = baseAuth(NOW);
		const { c, state } = fakeC(undefined, authInfo);

		await loginService.logout(c, 105);

		expect(state.kvWrites).toBe(1);
		expect(state.deletes).toBe(1);
	});

	it('踢设备仍写 KV', async () => {
		const authInfo = baseAuth(NOW);
		const { c, state } = fakeC(undefined, authInfo);

		await loginService.kickSession(c, 106, 'cur');

		expect(state.kvWrites).toBe(1);
		expect(state.deletes).toBe(1);
	});
});

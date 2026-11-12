import { describe, expect, it, vi, beforeEach } from 'vitest';

// sessions() 依赖当前请求的 token；这里只关心读源选择，直接固定成 cur
vi.mock('../src/security/user-context', () => ({
	default: {
		getToken: vi.fn(async () => 'cur'),
		getUserId: vi.fn(() => 1)
	}
}));

import loginService from '../src/service/login-service';

function fakeC({ tokens = [], sessions = {}, rows = [], dbError = false, readSwitch } = {}) {
	const state = { selects: 0, inserts: 0, kvPuts: 0 };
	const table = new Map(rows.map(row => [`${row.user_id}|${row.token}`, { ...row }]));

	const db = {
		prepare(sql) {
			const text = sql.replace(/\s+/g, ' ').trim();
			return {
				bind(...args) {
					return {
						async all() {
							if (dbError) throw new Error('D1 down');
							state.selects++;
							return { results: [...table.values()].filter(row => row.user_id === args[0]) };
						},
						async run() {
							if (dbError) throw new Error('D1 down');
							if (text.startsWith('INSERT')) {
								state.inserts++;
								const [user_id, token, ip, browser, os, device, time, active_time] = args;
								const key = `${user_id}|${token}`;
								if (!table.has(key)) {
									table.set(key, { user_id, token, ip, browser, os, device, time, active_time });
								}
							}
							return { success: true };
						}
					};
				}
			};
		}
	};

	const c = {
		env: {
			session_read_switch: readSwitch,
			kv: {
				async get(key, opts) {
					const value = JSON.stringify({ tokens, sessions });
					return opts?.type === 'json' ? JSON.parse(value) : value;
				},
				async put() {
					state.kvPuts++;
				}
			},
			db
		}
	};

	return { c, state, table };
}

function row(token, extra = {}) {
	return {
		user_id: 1,
		token,
		ip: '1.1.1.1',
		browser: 'Chrome',
		os: 'Windows10',
		device: 'Desktop',
		time: '2026-11-01T00:00:00.000Z',
		active_time: '2026-11-02T00:00:00.000Z',
		...extra
	};
}

describe('会话读路径 D1 优先', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('D1 命中时用 D1 设备信息，字段结构保持不变', async () => {
		const { c, state } = fakeC({
			tokens: ['cur', 'other'],
			sessions: {
				cur: { ip: 'kv-cur', browser: 'Chrome', os: 'Windows10', device: 'Laptop', time: '2026-11-01T00:00:00.000Z' },
				other: { ip: 'kv-other', browser: 'Safari', os: 'iOS', device: 'iPhone', time: '2026-11-01T00:00:00.000Z' }
			},
			rows: [row('cur', { ip: 'd1-cur', device: 'Pixel 8' }), row('other', { ip: 'd1-other', device: 'iPhone' })]
		});

		const list = await loginService.sessions(c, 1);

		expect(list.map(item => item.ip)).toEqual(['d1-cur', 'd1-other']);
		expect(Object.keys(list[0]).sort()).toEqual(['browser', 'current', 'device', 'id', 'ip', 'os', 'time']);
		expect(list[0].current).toBe(true);
		expect(list[0].time).toBe('2026-11-02T00:00:00.000Z');
		expect(state.inserts).toBe(0);
	});

	it('D1 缺行时用 KV 原值回填，且只回填一次', async () => {
		const kvMeta = { ip: 'kv-ip', browser: 'Chrome', os: 'Windows10', device: 'Desktop', time: '2026-11-01T00:00:00.000Z' };
		const { c, state, table } = fakeC({ tokens: ['cur'], sessions: { cur: kvMeta } });

		const first = await loginService.sessions(c, 1);
		expect(first[0].ip).toBe('kv-ip');
		expect(state.inserts).toBe(1);
		expect(table.get('1|cur').ip).toBe('kv-ip');

		const second = await loginService.sessions(c, 1);
		expect(second[0].ip).toBe('kv-ip');
		// 第二次已命中 D1，不再回填
		expect(state.inserts).toBe(1);
	});

	it('D1 抛错时整条链路退回 KV，不报错、不回填', async () => {
		const kvMeta = { ip: 'kv-ip', browser: 'Chrome', os: 'Windows10', device: 'Desktop', time: '2026-11-01T00:00:00.000Z' };
		const { c, state } = fakeC({ tokens: ['cur'], sessions: { cur: kvMeta }, dbError: true });

		const list = await loginService.sessions(c, 1);

		expect(list).toHaveLength(1);
		expect(list[0].ip).toBe('kv-ip');
		expect(state.inserts).toBe(0);
		expect(state.kvPuts).toBe(0);
	});

	it('开关关闭时完全不读 D1（回滚路径）', async () => {
		const kvMeta = { ip: 'kv-ip', browser: 'Chrome', os: 'Windows10', device: 'Desktop', time: '2026-11-01T00:00:00.000Z' };
		const { c, state } = fakeC({ tokens: ['cur'], sessions: { cur: kvMeta }, readSwitch: 0 });

		const list = await loginService.sessions(c, 1);

		expect(list[0].ip).toBe('kv-ip');
		expect(state.selects).toBe(0);
		expect(state.inserts).toBe(0);
	});

	it('历史无元数据 token 保持空字段展示，不参与去重（不踢人）、也不重复回填', async () => {
		const { c, state } = fakeC({
			tokens: ['cur', 'ghost1', 'ghost2'],
			sessions: { cur: { ip: 'ip', browser: 'Chrome', os: 'Windows10', device: 'Desktop', time: '2026-11-01T00:00:00.000Z' } },
			rows: [
				row('cur'),
				row('ghost1', { ip: '', browser: '', os: '', device: '', time: '', active_time: '' }),
				row('ghost2', { ip: '', browser: '', os: '', device: '', time: '', active_time: '' })
			]
		});

		const list = await loginService.sessions(c, 1);

		expect(list.map(item => item.id).sort()).toEqual(['cur', 'ghost1', 'ghost2']);
		const ghost = list.find(item => item.id === 'ghost1');
		expect([ghost.ip, ghost.browser, ghost.os, ghost.device, ghost.time]).toEqual(['', '', '', '', '']);
		// 空行指纹相同，若参与去重会把 ghost2 从 tokens 删掉等于踢下线
		expect(state.kvPuts).toBe(0);
		expect(state.inserts).toBe(0);
	});
});

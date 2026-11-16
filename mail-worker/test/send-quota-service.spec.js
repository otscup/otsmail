import { beforeEach, describe, expect, it, vi } from 'vitest';

const statements = [];

vi.mock('../src/entity/orm', () => ({}));

// 极简 D1 替身：按 SQL 关键字返回预置结果
const db = {
	prepare: vi.fn(sql => {
		const record = { sql, binds: [] };
		statements.push(record);
		return {
			bind: (...args) => {
				record.binds = args;
				return {
					run: async () => ({ meta: { changes: 1 } }),
					first: async () => record.firstResult ?? null,
					all: async () => record.allResult ?? { results: [] }
				};
			},
			run: async () => ({ meta: { changes: 1 } }),
			first: async () => record.firstResult ?? null,
			all: async () => record.allResult ?? { results: [] }
		};
	})
};

function context() {
	return { env: { db } };
}

import sendQuotaService from '../src/service/send-quota-service';

describe('sendQuotaService', () => {
	beforeEach(() => {
		statements.length = 0;
		db.prepare.mockClear();
	});

	it('日/月额度都成功时返回已占用的周期', async () => {
		db.prepare.mockImplementation(sql => {
			const record = { sql, binds: [] };
			statements.push(record);
			const api = {
				bind: (...args) => { record.binds = args; return api; },
				run: async () => ({ meta: { changes: 1 } }),
				first: async () => record.sql.includes('UPDATE send_quota') ? { used: 1 } : null,
				all: async () => ({ results: [] })
			};
			return api;
		});

		const result = await sendQuotaService.reserve(context(), 'resend', { dailyLimit: 100, monthlyLimit: 3000 }, 1);

		expect(result.ok).toBe(true);
		expect(result.reserved).toHaveLength(2);
		expect(result.reserved.map(item => item.period)).toEqual([
			sendQuotaService.dayPeriod(),
			sendQuotaService.monthPeriod()
		]);
	});

	it('月额度不足时回滚已占的日额度', async () => {
		let updateCount = 0;
		db.prepare.mockImplementation(sql => {
			const record = { sql, binds: [] };
			statements.push(record);
			const api = {
				bind: (...args) => { record.binds = args; return api; },
				run: async () => ({ meta: { changes: 1 } }),
				first: async () => {
					if (!record.sql.includes('UPDATE send_quota')) return null;
					updateCount += 1;
					// 第一次（日额度）成功，第二次（月额度）没拿到行
					return updateCount === 1 ? { used: 1 } : null;
				},
				all: async () => ({ results: [] })
			};
			return api;
		});

		const result = await sendQuotaService.reserve(context(), 'brevo', { dailyLimit: 300, monthlyLimit: 9000 }, 1);

		expect(result.ok).toBe(false);
		const releaseSql = statements.filter(item => item.sql.includes('MAX(0, used - ?)'));
		expect(releaseSql).toHaveLength(1);
		expect(releaseSql[0].binds[0]).toBe(1);
	});

	it('限额为 0 视为不限制，不写任何周期', async () => {
		const result = await sendQuotaService.reserve(context(), 'resend', { dailyLimit: 0, monthlyLimit: 0 }, 3);
		expect(result.ok).toBe(true);
		expect(result.reserved).toHaveLength(0);
	});

	it('usage 分别读取今日与本月', async () => {
		db.prepare.mockImplementation(sql => {
			const record = { sql, binds: [] };
			statements.push(record);
			const api = {
				bind: (...args) => { record.binds = args; return api; },
				run: async () => ({ meta: { changes: 0 } }),
				first: async () => null,
				all: async () => ({
					results: [
						{ period: sendQuotaService.dayPeriod(), used: 7 },
						{ period: sendQuotaService.monthPeriod(), used: 70 }
					]
				})
			};
			return api;
		});

		expect(await sendQuotaService.usage(context(), 'resend')).toEqual({ day: 7, month: 70 });
	});

	it('日额度占额是带 used + ? <= ? 条件的单条 UPDATE，并发下由 SQLite 串行裁决', async () => {
		db.prepare.mockImplementation(sql => {
			const record = { sql, binds: [] };
			statements.push(record);
			const api = {
				bind: (...args) => { record.binds = args; return api; },
				run: async () => ({ meta: { changes: 1 } }),
				first: async () => record.sql.includes('UPDATE send_quota') ? { used: 1 } : null,
				all: async () => ({ results: [] })
			};
			return api;
		});

		await sendQuotaService.reserve(context(), 'resend', { dailyLimit: 100, monthlyLimit: 0 }, 1);

		const update = statements.find(item => item.sql.includes('UPDATE send_quota SET used = used + ?'));
		expect(update.sql).toContain('used + ? <= ?');
		expect(update.sql).toContain('RETURNING used');
		expect(update.binds).toEqual([1, 'resend', sendQuotaService.dayPeriod(), 1, 100]);
	});
});

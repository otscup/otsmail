import { beforeEach, describe, expect, it } from 'vitest';
import backupCodeService from '../src/service/backup-code-service';
import backupCodeUtils from '../src/utils/backup-code-utils';

// 最小内存 D1：只实现服务实际用到的 5 条 SQL，避免为单测引入 workerd 运行时
function fakeDb() {
	let rows = [];
	let nextId = 1;

	const prepare = sql => {
		const statement = {
			sql,
			params: [],
			bind(...args) {
				this.params = args;
				return this;
			},
			async all() {
				if (sql.startsWith('SELECT id')) {
					return { results: rows.filter(row => row.user_id === this.params[0]) };
				}
				return {
					results: rows.filter(row => row.user_id === this.params[0]).map(row => ({ ...row }))
				};
			},
			async first() {
				const [userId, hash] = this.params;
				return rows.find(row => row.user_id === userId && row.code_hash === hash && row.used === 0) || null;
			},
			async run() {
				if (sql.startsWith('UPDATE')) {
					const [usedAt, usedIp, usedUa, id] = this.params;
					const row = rows.find(item => item.id === id && item.used === 0);
					if (!row) return { success: true, meta: { changes: 0 } };
					row.used = 1;
					row.used_at = usedAt;
					row.used_ip = usedIp;
					row.used_ua = usedUa;
					return { success: true, meta: { changes: 1 } };
				}
				if (sql.startsWith('DELETE')) {
					const before = rows.length;
					rows = rows.filter(row => row.user_id !== this.params[0]);
					return { success: true, meta: { changes: before - rows.length } };
				}
				if (sql.startsWith('INSERT')) {
					const [userId, hash, batchId, createdAt] = this.params;
					rows.push({
						id: nextId++,
						user_id: userId,
						code_hash: hash,
						batch_id: batchId,
						used: 0,
						created_at: createdAt,
						used_at: null
					});
					return { success: true, meta: { changes: 1 } };
				}
				return { success: true, meta: { changes: 0 } };
			}
		};
		return statement;
	};

	return {
		prepare,
		async batch(statements) {
			for (const statement of statements) await statement.run();
			return [];
		},
		rows: () => rows
	};
}

function context() {
	const db = fakeDb();
	return {
		db,
		c: { env: { db }, req: { header: () => '' } }
	};
}

describe('backupCodeService', () => {
	let db;
	let c;

	beforeEach(() => {
		({ db, c } = context());
	});

	it('生成 10 个码，库里只有哈希且不落明文', async () => {
		const codes = await backupCodeService.generate(c, 7);
		expect(codes).toHaveLength(10);
		expect(db.rows()).toHaveLength(10);

		const meta = await backupCodeService.meta(c, 7);
		expect(meta.total).toBe(10);
		expect(meta.remaining).toBe(10);

		for (const row of db.rows()) {
			expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
			expect(codes).not.toContain(row.code_hash);
		}
	});

	it('备用码一次性：首次成功，第二次失败', async () => {
		const [code] = await backupCodeService.generate(c, 7);
		expect(await backupCodeService.verifyAndConsume(c, 7, code)).toBe(true);
		expect(await backupCodeService.verifyAndConsume(c, 7, code)).toBe(false);

		const meta = await backupCodeService.meta(c, 7);
		expect(meta.remaining).toBe(9);
		expect(meta.lastUsedAt).toBeTruthy();
	});

	it('输入带空格/连字符/小写也能命中', async () => {
		const [code] = await backupCodeService.generate(c, 7);
		const typed = ` ${code.slice(0, 5).toLowerCase()}-${code.slice(5).toLowerCase()} `;
		expect(await backupCodeService.verifyAndConsume(c, 7, typed)).toBe(true);
	});

	it('重新生成会让旧码整批失效', async () => {
		const oldCodes = await backupCodeService.generate(c, 7);
		const newCodes = await backupCodeService.generate(c, 7);

		expect(db.rows()).toHaveLength(10);
		expect(await backupCodeService.verifyAndConsume(c, 7, oldCodes[0])).toBe(false);
		expect(await backupCodeService.verifyAndConsume(c, 7, newCodes[0])).toBe(true);
	});

	it('并发消费同一个码只有一次成功', async () => {
		const [code] = await backupCodeService.generate(c, 7);
		const results = await Promise.all([
			backupCodeService.verifyAndConsume(c, 7, code),
			backupCodeService.verifyAndConsume(c, 7, code)
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
	});

	it('其他用户的码不能用于当前用户', async () => {
		const [code] = await backupCodeService.generate(c, 7);
		expect(await backupCodeService.verifyAndConsume(c, 8, code)).toBe(false);
	});

	it('格式不对（长度/字符集）直接拒绝', async () => {
		const [code] = await backupCodeService.generate(c, 7);
		expect(await backupCodeService.verifyAndConsume(c, 7, code.slice(0, 9))).toBe(false);
		expect(await backupCodeService.verifyAndConsume(c, 7, 'IIIIIIIIII')).toBe(false);
	});

	it('removeAll 清空该用户全部备用码', async () => {
		await backupCodeService.generate(c, 7);
		await backupCodeService.generate(c, 8);
		await backupCodeService.removeAll(c, 7);
		expect(db.rows()).toHaveLength(10);
		expect((await backupCodeService.meta(c, 7)).total).toBe(0);
		expect((await backupCodeService.meta(c, 8)).total).toBe(10);
	});
});

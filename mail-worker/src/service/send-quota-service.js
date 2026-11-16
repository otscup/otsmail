import dayjs from 'dayjs';

/**
 * 发信额度：D1 原子占额，KV 只用于展示缓存。
 * period：日额度用 YYYY-MM-DD，月额度用 YYYY-MM，与现有 send_day_count 一样按 UTC 切日。
 *
 * 占额分两步（INSERT OR IGNORE 建行 + 条件 UPDATE），条件 UPDATE 本身是原子的：
 * 并发请求里只有一个能把 used 推到 limit 以内，超出的那条拿不到 RETURNING 行。
 */
const sendQuotaService = {

	dayPeriod(now = dayjs()) {
		return now.format('YYYY-MM-DD');
	},

	monthPeriod(now = dayjs()) {
		return now.format('YYYY-MM');
	},

	async reserve(c, provider, limits, units) {
		const amount = Math.max(1, Number(units) || 1);
		const periods = [
			{ period: this.dayPeriod(), limit: Number(limits?.dailyLimit) || 0 },
			{ period: this.monthPeriod(), limit: Number(limits?.monthlyLimit) || 0 }
		];

		const reserved = [];
		for (const item of periods) {
			// 限额 <= 0 视为不限制
			if (item.limit <= 0) continue;

			await c.env.db.prepare(
				`INSERT OR IGNORE INTO send_quota (provider, period, used) VALUES (?, ?, 0)`
			).bind(provider, item.period).run();

			const row = await c.env.db.prepare(
				`UPDATE send_quota SET used = used + ?, updated_at = CURRENT_TIMESTAMP
				 WHERE provider = ? AND period = ? AND used + ? <= ?
				 RETURNING used`
			).bind(amount, provider, item.period, amount, item.limit).first();

			if (!row) {
				await this.release(c, provider, reserved);
				return { ok: false, period: item.period, limit: item.limit };
			}

			reserved.push({ period: item.period, amount });
		}

		return { ok: true, reserved, amount };
	},

	async release(c, provider, reserved = []) {
		for (const item of reserved) {
			await c.env.db.prepare(
				`UPDATE send_quota SET used = MAX(0, used - ?) WHERE provider = ? AND period = ?`
			).bind(item.amount, provider, item.period).run();
		}
	},

	async usage(c, provider) {
		const rows = await c.env.db.prepare(
			`SELECT period, used FROM send_quota WHERE provider = ? AND period IN (?, ?)`
		).bind(provider, this.dayPeriod(), this.monthPeriod()).all();

		const map = {};
		for (const row of rows?.results || []) map[row.period] = Number(row.used) || 0;

		return {
			day: map[this.dayPeriod()] || 0,
			month: map[this.monthPeriod()] || 0
		};
	},

	/** 一次 SQL 取回多个渠道的当日/当月用量：管理端概览从 5 次 D1 读降到 1 次 */
	async usageAll(c, providers = []) {
		const result = {};
		if (!providers.length) return result;

		const day = this.dayPeriod();
		const month = this.monthPeriod();
		for (const provider of providers) result[provider] = { day: 0, month: 0 };

		const placeholders = providers.map(() => '?').join(', ');
		const rows = await c.env.db.prepare(
			`SELECT provider, period, used FROM send_quota
			 WHERE period IN (?, ?) AND provider IN (${placeholders})`
		).bind(day, month, ...providers).all();

		for (const row of rows?.results || []) {
			const item = result[row.provider];
			if (!item) continue;
			const used = Number(row.used) || 0;
			if (row.period === day) item.day = used;
			else item.month = used;
		}
		return result;
	}
};

export default sendQuotaService;

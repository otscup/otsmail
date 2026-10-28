import analysisDao from '../dao/analysis-dao';
import orm from '../entity/orm';
import email from '../entity/email';
import { desc, count, eq, and, ne, isNotNull } from 'drizzle-orm';
import { emailConst } from '../const/entity-const';
import kvConst from '../const/kv-const';
import dayjs from 'dayjs';
import { toUtc } from '../utils/date-uitil';
const analysisService = {

	async echarts(c, params) {
		if (!this.analysisCacheEnabled(c)) {
			return await this.queryEcharts(c, params);
		}

		const cacheKey = this.echartsCacheKey(params);
		const cache = await c.env.kv.get(cacheKey, { type: 'json' });

		if (cache) {
			return cache;
		}

		return await this.refreshEchartsCacheByKey(c, cacheKey);
	},

	async refreshEchartsCacheByKey(c, cacheKey) {
		const params = this.echartsParamsByCacheKey(cacheKey);
		const data = await this.queryEcharts(c, params);
		await c.env.kv.put(cacheKey, JSON.stringify(data));
		return data;
	},

	async refreshEchartsCache(c) {
		if (!this.analysisCacheEnabled(c)) {
			return;
		}

		const { keys } = await c.env.kv.list({ prefix: kvConst.ANALYSIS_ECHARTS });

		await Promise.all(keys.map(key => this.refreshEchartsCacheByKey(c, key.name)));
	},

	async queryEcharts(c, params) {

		const { timeZone } = params;

		let utcDate = toUtc().startOf('day');

		let localDate = utcDate.tz(timeZone);

		utcDate = dayjs(utcDate.format('YYYY-MM-DD HH:mm:ss'))

		localDate = dayjs(localDate.format('YYYY-MM-DD HH:mm:ss'))

		//获取时差
		const diffHours = localDate.diff(utcDate, 'hour',true);


		const [
			numberCount,
			nameRatio,
			userDayCountRaw,
			receiveDayCountRaw,
			sendDayCountRaw,
			daySendTotalRaw
		] = await Promise.all([
			analysisDao.numberCount(c),

			orm(c)
				.select({ name: email.name, total: count() })
				.from(email)
				.where(and(eq(email.type, emailConst.type.RECEIVE), isNotNull(email.name),ne(email.name,'noreply'), ne(email.name,'')))
				.groupBy(email.name)
				.orderBy(desc(count()))
				.limit(6),


			analysisDao.userDayCount(c, diffHours),
			analysisDao.receiveDayCount(c, diffHours),
			analysisDao.sendDayCount(c, diffHours),

			c.env.kv.get(kvConst.SEND_DAY_COUNT + dayjs().format('YYYY-MM-DD')),
		]);


		const userDayCount = this.filterEmptyDay(userDayCountRaw, timeZone);
		const receiveDayCount = this.filterEmptyDay(receiveDayCountRaw, timeZone);
		const sendDayCount = this.filterEmptyDay(sendDayCountRaw, timeZone);

		const daySendTotal = daySendTotalRaw || 0;

		return {
			numberCount,
			userDayCount,
			receiveRatio: {
				nameRatio
			},
			emailDayCount: {
				receiveDayCount,
				sendDayCount
			},
			daySendTotal: Number(daySendTotal)
		};
	},

	async insight(c, params) {
		const range = params.range === '24h' ? 1 : params.range === '30d' ? 30 : 7;
		const timeZone = params.timeZone || 'UTC';
		const diffHours = Number(dayjs().tz(timeZone).utcOffset() / 60);
		const categoryRows = await c.env.db.prepare(`
			SELECT
				CASE WHEN spam = 1 THEN 'spam' ELSE COALESCE(category, 'primary') END AS category,
				COUNT(*) AS total
			FROM email
			WHERE type = 0 AND is_del = 0 AND create_time >= datetime('now', ?)
			GROUP BY 1
		`).bind(`-${range} days`).all();

		const heatRows = await c.env.db.prepare(`
			SELECT
				CAST(strftime('%w', create_time, '+${diffHours} hours') AS INTEGER) AS dow,
				CAST(strftime('%H', create_time, '+${diffHours} hours') AS INTEGER) AS hour,
				COUNT(*) AS total
			FROM email
			WHERE type = 0 AND is_del = 0 AND create_time >= datetime('now', ?)
			GROUP BY dow, hour
		`).bind(`-${range} days`).all();

		const categories = { primary: 0, social: 0, promotion: 0, updates: 0, ads: 0, spam: 0 };
		(categoryRows.results || []).forEach(row => {
			if (row.category in categories) categories[row.category] = Number(row.total) || 0;
		});
		return { range, categories, heatmap: heatRows.results || [] };
	},

	filterEmptyDay(data, timeZone) {
		const today = toUtc().tz(timeZone).subtract(1, 'day');
		const previousDays = Array.from({ length: 15 }, (_, i) => {
			return today.subtract(i, 'day').format('YYYY-MM-DD');
		}).reverse();

		return  previousDays.map(day => {
			const index = data.findIndex(item => item.date === day)
			const total = index > - 1 ? data[index].total : 0
			return {date: day,total}
		})

	},

	echartsCacheKey(params = {}) {
		return kvConst.ANALYSIS_ECHARTS + encodeURIComponent(params.timeZone || 'UTC');
	},

	echartsParamsByCacheKey(cacheKey) {
		return {
			timeZone: decodeURIComponent(cacheKey.replace(kvConst.ANALYSIS_ECHARTS, ''))
		};
	},

	analysisCacheEnabled(c) {
		return c.env.analysis_cache === true || c.env.analysis_cache === 'true';
	}
}

export default  analysisService

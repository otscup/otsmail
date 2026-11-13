import orm from '../entity/orm';
import verifyRecord from '../entity/verify-record';
import { eq, sql, and } from 'drizzle-orm';
import dayjs from 'dayjs';
import reqUtils from '../utils/req-utils';
import { verifyRecordType } from '../const/entity-const';

const verifyRecordService = {

	async selectListByIP(c) {
		const ip = reqUtils.getIp(c)
		return orm(c).select().from(verifyRecord).where(eq(verifyRecord.ip, ip)).all();
	},

	async clearRecord(c) {
		// 调用方（index.js 的定时任务）已限定每天 UTC 16:00 执行一次；
		// 这里不能再要求 getUTCHours()===0，否则与调度时间永远对不上，记录永远不会清。
		await orm(c).delete(verifyRecord).run();
	},

	async isOpenRegVerify(c, regVerifyCount) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.REG))).get();

		if (row) {
			if (row.count >= regVerifyCount){
				return true
			}

		}

		return false

	},

	async isOpenAddVerify(c, addVerifyCount) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.ADD))).get();

		if (row) {

			if (row.count >= addVerifyCount){
				return true
			}

		}

		return false

	},

	async increaseRegCount(c) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.REG))).get();
		const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

		if (row) {
			return  orm(c).update(verifyRecord).set({
				count: sql`${verifyRecord.count}
		+ 1`, updateTime: now
			}).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.REG))).returning().get();
		} else {
			return  orm(c).insert(verifyRecord).values({ip, type: verifyRecordType.REG}).returning().run();
		}
	},

	async increaseAddCount(c) {

		const ip = reqUtils.getIp(c)

		const row = await orm(c).select().from(verifyRecord).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.ADD))).get();
		const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

		if (row) {
			return orm(c).update(verifyRecord).set({
				count: sql`${verifyRecord.count}
		+ 1`, updateTime: now
			}).where(and(eq(verifyRecord.ip, ip),eq(verifyRecord.type,verifyRecordType.ADD))).returning().get();
		} else {
			return orm(c).insert(verifyRecord).values({ip, type: verifyRecordType.ADD}).returning().get();
		}
	}

};

export default verifyRecordService;

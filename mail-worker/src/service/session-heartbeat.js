import dayjs from 'dayjs';
import KvConst from '../const/kv-const';
import constant from '../const/constant';
import userService from './user-service';
import authCache from './auth-cache';
import sessionService from './session-service';

// 与改造前一致：同一会话 5 分钟内只记一次活跃时间
const HEARTBEAT_THROTTLE_MINUTES = 5;

/**
 * 心跳的 KV 写开关。默认关闭：活跃时间只写 D1。
 * 设为 1 / true 后退回老行为（活跃时间照旧回写整份 auth-uid:<userId>）。
 */
function kvWriteEnabled(c) {
	const value = c.env?.heartbeat_write_kv_switch;
	if (value === undefined || value === null || value === '') return false;
	if (value === true || value === 1) return true;
	const text = String(value).toLowerCase();
	return text === '1' || text === 'true';
}

const sessionHeartbeat = {
	kvWriteEnabled,

	/**
	 * 计算一次已鉴权请求要落哪些写：
	 * - refreshDue: 跨天，需要刷新 refreshTime 与用户级活跃信息（KV 必须写一次）
	 * - kvDirty:    是否需要回写 auth-uid:<userId>
	 * - kvTouch:    是否顺带刷新 sessions[token].time（仅老开关）
	 * - d1Touch:    新行为，只更新 D1 active_time
	 * - d1Upsert:   老行为，D1 行不存在时补建（仅老开关）
	 */
	plan(c, authInfo, token, now = dayjs()) {
		const refreshDue = !now.startOf('day').isSame(dayjs(authInfo.refreshTime).startOf('day'));
		const hasSession = !!token && !!authInfo.sessions?.[token];
		const kvMode = kvWriteEnabled(c);

		let kvDirty = refreshDue;
		let kvTouch = false;
		let d1Touch = false;
		let d1Upsert = false;

		if (hasSession) {
			if (kvMode) {
				const lastActive = dayjs(authInfo.sessions[token].time);
				if (!lastActive.isValid() || now.diff(lastActive, 'minute') >= HEARTBEAT_THROTTLE_MINUTES) {
					kvDirty = true;
					kvTouch = true;
					d1Upsert = true;
				}
			} else {
				d1Touch = true;
			}
		}

		return { refreshDue, kvDirty, kvTouch, d1Touch, d1Upsert };
	},

	/**
	 * 执行心跳写。返回本次决策，便于单测断言与线上排查。
	 */
	async apply(c, authInfo, userId, token, now = dayjs()) {
		const plan = this.plan(c, authInfo, token, now);

		// 跨天：用户级活跃时间（日活统计）仍要记，KV 每天写一次
		if (plan.refreshDue) {
			authInfo.refreshTime = now.toISOString();
			await userService.updateUserInfo(c, authInfo.user.userId);
		}

		if (plan.kvTouch) {
			authInfo.sessions[token].time = now.toISOString();
		}

		if (plan.kvDirty) {
			await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
			authCache.put(c, userId, authInfo);
		}

		if (plan.d1Upsert) {
			await sessionService.upsert(c, userId, token, authInfo.sessions[token]);
		} else if (plan.d1Touch) {
			await sessionService.touch(c, userId, token, now.toISOString(), now.valueOf());
		}

		return plan;
	}
};

export default sessionHeartbeat;

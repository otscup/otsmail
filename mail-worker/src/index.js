import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import r2Service from './service/r2-service';
import attService from './service/att-service';
import webAssetService from './service/web-asset-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
import telegramService from './service/telegram-service';
export { EmailHub } from './durable/email-hub';
export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		// MCP HTTP endpoint: path kept as-is (no /api prefix strip), routes into app
		if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
			return app.fetch(req, env, ctx);
		}

		// /oss 也走 Hono，由 r2-api 统一做 MIME 强制下载；否则会落到 SPA index.html。
		if (url.pathname.startsWith('/oss/')) {
			return app.fetch(req, env, ctx);
		}

		// MCP OAuth 元数据发现（RFC 8414 / 9728），必须挂在站点根上
		if (url.pathname.startsWith('/.well-known/')) {
			return app.fetch(req, env, ctx);
		}

		 if (url.pathname.startsWith('/static/')) {
			 return await r2Service.publicObjResp({ env }, url.pathname.substring(1));
		 }

		 if (url.pathname.startsWith('/attachments/')) {
			 const key = decodeURIComponent(url.pathname.substring('/attachments/'.length));
			 const ok = await attService.verifyKey(env, key, url.searchParams.get('uid'), url.searchParams.get('exp'), url.searchParams.get('sig'));
			 if (!ok) return new Response('Forbidden', { status: 403 });
			 return await r2Service.publicObjResp({ env }, `attachments/${key}`);
		 }

		return webAssetService.fetch(req, env);
	},
	email: email,
	async scheduled(c, env, ctx) {
		const now = new Date(c.scheduledTime || Date.now());
		const minute = now.getUTCMinutes();

		// cron 可能被配成每分钟触发；缓存刷新只在整点/半点，日任务只在 UTC 16:00
		if (minute === 0 || minute === 30) {
			await analysisService.refreshEchartsCache({ env });
		}
		// 每天 UTC 00:00（北京时间 08:00）推送 Telegram 日报
		if (now.getUTCHours() === 0 && minute === 0) {
			await telegramService.sendDailyDigest({ env, scheduledTime: c.scheduledTime });
		}
		await emailService.sendScheduled({ env });
		if (now.getUTCHours() !== 16 || minute > 5) {
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await emailService.autoClean({ env })
		await oauthService.clearNoBindOathUser({ env })
	},
};

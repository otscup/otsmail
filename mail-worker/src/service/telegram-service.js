import orm from '../entity/orm';
import email from '../entity/email';
import attService from './att-service';
import settingService from './setting-service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import { eq } from 'drizzle-orm';
import jwtUtils from '../utils/jwt-utils';
import emailMsgTemplate from '../template/email-msg';
import emailTextTemplate from '../template/email-text';
import emailHtmlTemplate from '../template/email-html';
import verifyUtils from '../utils/verify-utils';
import domainUtils from "../utils/domain-uitls";

// sendPhoto：每封邮件最多发的内嵌图数（避免多图刷屏）
const MAX_PHOTOS_PER_EMAIL = 5;
const PHOTO_CAPTION_LIMIT = 900;

const telegramService = {

	async getEmailContent(c, params) {

		const { token } = params

		const result = await jwtUtils.verifyToken(c, token);

		if (!result) {
			return emailTextTemplate('Access denied')
		}

		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, result.emailId)).get();

		if (emailRow) {

			if (emailRow.content) {
				const { r2Domain } = await settingService.query(c);
				return emailHtmlTemplate(emailRow.content || '', r2Domain)
			} else {
				return emailTextTemplate(emailRow.text || '')
			}

		} else {
			return emailTextTemplate('The email does not exist')
		}

	},

	async sendEmailToBot(c, email) {

		const { tgBotToken, tgChatId, customDomain, tgMsgTo, tgMsgFrom, tgMsgText, r2Domain } = await settingService.query(c);

		const tgChatIds = tgChatId.split(',');

		const jwtToken = await jwtUtils.generateToken(c, { emailId: email.emailId })

		const webAppUrl = customDomain ? `${domainUtils.toOssDomain(customDomain)}/api/telegram/getEmail/${jwtToken}` : 'https://www.cloudflare.com/404'
		const inlineKeyboard = [
			[
				{
					text: 'View',
					web_app: { url: webAppUrl }
				}
			]
		];

		if (email.code) {
			inlineKeyboard.push([
				{
					text: email.code,
					copy_text: { text: email.code }
				}
			]);
		}

		await Promise.all(tgChatIds.map(async chatId => {
			try {
				const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						chat_id: chatId,
						parse_mode: 'HTML',
						text: emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText),
						reply_markup: {
							inline_keyboard: inlineKeyboard
						}
					})
				});
				if (!res.ok) {
					console.error(`转发 Telegram 失败 status: ${res.status} response: ${await res.text()}`);
				}
			} catch (e) {
				console.error(`转发 Telegram 失败:`, e.message);
			}
		}));

		// sendPhoto（方案 A）：邮件内嵌图逐张发到聊天（单图一列），caption=摘要 + View 兜底
		await this.sendPhotosToBot(c, { email, tgBotToken, tgChatIds, webAppUrl, r2Domain });
	},

	/**
	 * sendPhoto（架构 TG sendPhoto 方案 A 定案）：邮件内嵌图（CID 附件，已存 R2 公开 URL）
	 * 逐张用 sendPhoto 发到聊天，单图一列；每张 caption = 主题/发件人/序号（短摘要），
	 * 保留 View 按钮兜底看完整 HTML。多图最多 MAX_PHOTOS_PER_EMAIL 张，避免刷屏。
	 */
	async sendPhotosToBot(c, { email, tgBotToken, tgChatIds, webAppUrl, r2Domain }) {

		if (!email || !email.emailId || !tgBotToken || !r2Domain) {
			return;
		}

		let attList = [];
		try {
			attList = await attService.selectByEmailIds(c, [email.emailId]);
		} catch (e) {
			console.error(`sendPhotosToBot 查询附件失败:`, e.message);
			return;
		}

		// 只取内嵌图：image mime + 有 contentId（CID 附件）
		const inlineImages = attList.filter(att =>
			att &&
			att.mimeType &&
			String(att.mimeType).toLowerCase().startsWith('image/') &&
			att.contentId
		).slice(0, MAX_PHOTOS_PER_EMAIL);

		if (inlineImages.length === 0) {
			return;
		}

		const baseUrl = domainUtils.toOssDomain(r2Domain);
		const subject = (email.subject || '').slice(0, 80);
		const from = (email.name || email.sendEmail || '').slice(0, 80);

		const captionPrefix = `<b>${subject.replace(/</g, '&lt;')}</b>\n${from.replace(/</g, '&lt;')}`;

		await Promise.all(tgChatIds.map(async chatId => {
			for (let i = 0; i < inlineImages.length; i++) {
				const att = inlineImages[i];
				const photoUrl = `${baseUrl}/${att.key}`;
				const caption = `${captionPrefix}\n📷 ${i + 1}/${inlineImages.length}`.slice(0, PHOTO_CAPTION_LIMIT);
				try {
					const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendPhoto`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							chat_id: chatId,
							photo: photoUrl,
							caption,
							parse_mode: 'HTML',
							reply_markup: {
								inline_keyboard: [[{ text: 'View', web_app: { url: webAppUrl } }]]
							}
						})
					});
					if (!res.ok) {
						console.error(`sendPhoto 失败 status: ${res.status} response: ${await res.text()}`);
					}
				} catch (e) {
					console.error(`sendPhoto 失败:`, e.message);
				}
			}
		}));
	}

}

export default telegramService

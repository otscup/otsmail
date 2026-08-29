// Webhook 通知服务：收到邮件后向配置的 URL 推送 JSON（移植自 maillab/cloud-mail v3.2.0）
import { emailConst } from '../const/entity-const';

const webhookService = {

	// 收信后调用：把邮件摘要 POST 到 webhookUrl
	async sendEmail({ env }, email, webhookUrl, webhookRetry = 0, webhookSecret = '') {
		if (!webhookUrl) return;

		const payload = {
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			sendName: email.sendName,
			toEmail: email.toEmail,
			toName: email.toName,
			subject: email.subject,
			text: email.text,
			content: email.content,
			code: email.code,
			createTime: email.createTime
		};

		const headers = { 'Content-Type': 'application/json' };
		if (webhookSecret) {
			headers['Authorization'] = `Bearer ${webhookSecret}`;
		}

		let attempt = 0;
		const maxAttempt = Number(webhookRetry) || 0;
		while (true) {
			try {
				const res = await fetch(webhookUrl, {
					method: 'POST',
					headers,
					body: JSON.stringify(payload)
				});
				if (!res.ok) {
					throw new Error(`webhook 返回 ${res.status}`);
				}
				return;
			} catch (e) {
				attempt++;
				if (attempt > maxAttempt) {
					console.error(`转发 Webhook 失败（已重试 ${maxAttempt} 次）：`, e.message);
					return;
				}
				// 简单退避后重试
				await new Promise(r => setTimeout(r, 500 * attempt));
			}
		}
	}

};

export default webhookService;

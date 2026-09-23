import emailUtils from '../utils/email-utils';

// 正文摘要：只发前 SUMMARY_LIMIT 字符（而非整封正文截断到 3500）——治"长串"痛点
const SUMMARY_LIMIT = 400;
// 单行过长（长 URL / base64 / 长域名串）折叠阈值，避免一行顶破 TG 排版
const LONG_LINE_LIMIT = 80;
const LONG_LINE_KEEP = 60;
const TRUNCATED_SUFFIX = '...';

function escapeHtml(text = '') {
	return text
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * 把可能的超长纯文本（HTML 邮件整体剥出的正文）整理成 TG 用的**摘要**：
 * 1. 折叠超长行（URL/base64/长域名）到 LONG_LINE_KEEP 字符 + '…'，避免行内长串顶破排版
 * 2. 从首个非空段落起，累计取前 SUMMARY_LIMIT 字符作为正文摘要
 * 3. 仍超限则加省略号；全文靠 View 按钮在 web_app 里看
 */
function buildSummary(text) {
	if (!text) return '';

	const folded = String(text)
		.split('\n')
		.map(line => {
			const trimmed = line.trim();
			if (trimmed.length > LONG_LINE_LIMIT) {
				return trimmed.slice(0, LONG_LINE_KEEP) + '…';
			}
			return trimmed;
		})
		.filter(Boolean)
		.join('\n');

	if (folded.length <= SUMMARY_LIMIT) {
		return escapeHtml(folded);
	}

	return escapeHtml(folded.slice(0, SUMMARY_LIMIT - TRUNCATED_SUFFIX.length) + TRUNCATED_SUFFIX);
}

export default function emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText) {

	let template = `<b>${escapeHtml(email.subject || '')}</b>`

		if (tgMsgFrom === 'only-name') {
			template += `

From：${escapeHtml(email.name || '')}`
		}

		if (tgMsgFrom === 'show') {
			template += `

From：${escapeHtml(email.name || '')}  &lt;${escapeHtml(email.sendEmail || '')}&gt;`
		}

		if(tgMsgTo === 'show' && tgMsgFrom === 'hide') {
			template += `

To：${escapeHtml(email.toEmail || '')}`

		} else if(tgMsgTo === 'show') {
			template += `
To：${escapeHtml(email.toEmail || '')}`
	}

	if(tgMsgText === 'show') {
		// 正文摘要（折叠长行 + 截前 400 字符），全文靠 View 按钮看
		template += `

${buildSummary(emailUtils.formatText(email.text) || emailUtils.htmlToText(email.content))}`
	}

	return template;

}
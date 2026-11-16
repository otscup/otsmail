import { parseHTML } from 'linkedom';

/**
 * 邮件正文消毒（Worker 侧）
 *
 * 用于任何要把邮件 HTML 送进浏览器渲染的地方（目前是 Telegram 推送里的
 * "查看邮件" 页面）。上游只做了 `document.querySelectorAll('script').remove()`，
 * 这远远不够 —— 以下都能绕过：
 *   <img src=x onerror=...>          事件属性
 *   <iframe src=javascript:...>      内联协议
 *   <svg><script>...                 命名空间内的脚本
 *   <a href="javascript:...">        链接协议
 *   <form action=...>                钓鱼表单
 *
 * 这里用 linkedom 解析成 DOM 后按白名单/黑名单清理，不用正则去啃 HTML。
 */

// 直接删除（连内容一起）的标签
// style 必须整体删除：其中的 @import / url() 会发起外部请求，:host 规则还能改掉宿主样式、
// 甚至用 position:fixed 覆盖整个页面；邮件正文的样式只保留内联 style 属性。
const FORBIDDEN_TAGS = [
	'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
	'textarea', 'select', 'option', 'base', 'link', 'meta', 'template',
	'noscript', 'frame', 'frameset', 'applet', 'audio', 'video', 'source',
	'title'
];

// 允许的 URL 协议（其余一律剔除属性）
const SAFE_URL_SCHEME = /^(?:https?:|mailto:|tel:|cid:|data:image\/(?:png|jpe?g|gif|webp|bmp);base64,|[/#?])/i;

// 带 URL 的属性
const URL_ATTRS = ['href', 'src', 'srcset', 'action', 'formaction', 'background', 'poster', 'data'];

// 无论如何都要删掉的属性
const FORBIDDEN_ATTRS = ['srcdoc', 'ping', 'formaction', 'http-equiv'];

function cleanStyleAttr(value) {
	if (!value) return '';
	// 挡掉 CSS 里能发起请求 / 执行代码 / 覆盖页面的写法
	return value
		.replace(/expression\s*\(/gi, 'none(')
		.replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(about:blank')
		.replace(/behavior\s*:/gi, 'x-behavior:')
		.replace(/-moz-binding\s*:/gi, 'x-binding:')
		.replace(/(?:^|;)\s*position\s*:\s*(?:fixed|sticky)\b[^;]*/gi, '');
}

// 邮件为了兼容窄屏客户端会把版面写死成 600px：<table width="600">、style="width:600px"，
// 或者 <div style="max-width:600px;margin:0 auto">。上面的 <style> 整体删除后，邮件原本用来
// 覆盖 align="center" 的规则（例如 td.layout{text-align:left}）也一并没了，版面级居中重新生效：
// 阅读区比版面宽时整块正文右移 (阅读区宽 - 版面宽) / 2，而表头 logo 是整宽左对齐，看起来就错开。
// 这里只去掉版面级居中，版面宽度和按钮、图标这类小尺寸居中都不动。
const FIXED_WIDTH_MIN = 360;

function declaredWidth(el) {
	const attr = parseInt(el.getAttribute('width'), 10);
	if (Number.isFinite(attr)) return attr;
	const match = (el.getAttribute('style') || '').match(/(?:^|;)\s*(?:max-)?width\s*:\s*(\d{2,4})\s*px/i);
	return match ? Number(match[1]) : 0;
}

function normalizeLayoutCentering(el) {
	const wide = declaredWidth(el) >= FIXED_WIDTH_MIN;

	// 宽度自适应的居中包装（margin:0 auto）同样会把整块正文推到右边
	if (wide) {
		const style = el.getAttribute('style');
		if (style && /\bauto\b/i.test(style)) {
			el.setAttribute('style', style.replace(/(?:^|;)\s*margin(?:-(?:left|right))?\s*:[^;]*\bauto\b[^;]*/gi, ''));
		}
	}

	const align = el.getAttribute('align');
	if (!align || !/^center$/i.test(align)) return;

	if (el.tagName === 'TD' || el.tagName === 'TH') {
		// 承载宽版面的单元格：align="center" 只是把整版居中，去掉后版面贴左
		const hasWideTable = Array.from(el.children || [])
			.some(child => child.tagName === 'TABLE' && declaredWidth(child) >= FIXED_WIDTH_MIN);
		if (hasWideTable) el.removeAttribute('align');
	} else if (el.tagName === 'TABLE' && wide) {
		el.removeAttribute('align');
	}
}

/**
 * @param {string} html 不可信的邮件 HTML
 * @returns {string} 消毒后的 HTML 片段
 */
export function sanitizeEmailHtml(html) {
	if (!html) return '';

	let document;
	try {
		({ document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`));
	} catch (e) {
		console.error('sanitizeEmailHtml parse failed:', e);
		return '';
	}

	// 1. 删除危险标签
	document.querySelectorAll(FORBIDDEN_TAGS.join(',')).forEach(el => el.remove());

	// 2. 逐元素清理属性
	document.querySelectorAll('*').forEach(el => {
		// linkedom 的 attributes 在遍历中删除会错位，先拷一份名字
		const names = Array.from(el.attributes || []).map(a => a.name);

		for (const name of names) {
			const lower = name.toLowerCase();
			const value = el.getAttribute(name);

			// on* 事件属性
			if (lower.startsWith('on')) {
				el.removeAttribute(name);
				continue;
			}

			if (FORBIDDEN_ATTRS.includes(lower)) {
				el.removeAttribute(name);
				continue;
			}

			if (lower === 'style') {
				el.setAttribute(name, cleanStyleAttr(value));
				continue;
			}

			if (URL_ATTRS.includes(lower)) {
				const v = (value || '').trim().replace(/[\u0000-\u001F\u007F]/g, '');
				if (!SAFE_URL_SCHEME.test(v)) {
					el.removeAttribute(name);
				}
			}
		}

		// 外链一律新窗口打开且断开 opener
		if (el.tagName === 'A' && el.getAttribute('href')) {
			el.setAttribute('target', '_blank');
			el.setAttribute('rel', 'noopener noreferrer');
		}

		// 去掉版面级居中（只处理 >=360px 的版面，见 normalizeLayoutCentering）
		normalizeLayoutCentering(el);
	});

	return document.body.innerHTML;
}

export default sanitizeEmailHtml;

import {describe, expect, it} from 'vitest';
import PostalMime from 'postal-mime';
import {sanitizeEmailHtml} from '../src/utils/html-sanitize';
import emailHtmlTemplate from '../src/template/email-html';
import {sanitizeHeaderValue} from '../src/utils/header-utils';

describe('邮件正文 CSS / 脚本消毒', () => {

	it('删除 <style>，@import 与 :host 规则无法进入渲染结果', () => {
		const input = '<style>@import url(https://evil.example/x.css); :host{position:fixed;inset:0;z-index:99999}</style><p>hello</p>';
		const out = sanitizeEmailHtml(input);
		expect(out).not.toContain('<style');
		expect(out).not.toContain('@import');
		expect(out).not.toContain(':host');
		expect(out).toContain('<p>hello</p>');
	});

	it('内联 style 里的 position:fixed/sticky 被剔除', () => {
		const out = sanitizeEmailHtml('<div style="position:fixed;inset:0;z-index:9999;color:red">x</div>');
		expect(out).not.toMatch(/position\s*:/i);
		expect(out).toContain('color:red');
	});

	it('expression() 被中和，javascript: 链接被移除', () => {
		const out = sanitizeEmailHtml('<div style="width:expression(alert(1))">x</div><a href="javascript:alert(1)">go</a>');
		expect(out).not.toContain('expression(');
		expect(out).not.toContain('javascript:');
	});

	it('script / onerror / iframe 均被删除', () => {
		const out = sanitizeEmailHtml('<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://evil"></iframe>');
		expect(out).not.toContain('<script');
		expect(out).not.toContain('onerror');
		expect(out).not.toContain('<iframe');
	});

	it('SVG / MathML 命名空间里的 style 与 script 同样被删除', () => {
		const out = sanitizeEmailHtml('<svg><style>@import url(https://evil/x.css)</style><script>alert(1)</script></svg><math><mtext><style>*{position:fixed}</style></mtext></math><p>ok</p>');
		expect(out).not.toContain('<style');
		expect(out).not.toContain('@import');
		expect(out).not.toContain('<script');
		expect(out).toContain('<p>ok</p>');
	});

	it('body style 注入无法闭合模板里的 CSS 规则', () => {
		const html = '<body style="} body{display:none} .x{position:fixed">hi</body>';
		const page = emailHtmlTemplate(html, 'example.com');
		// payload 只能以 JSON 转义后的字符串进入脚本，不会成为真实的 <body> 标签
		expect(page).toContain('\\u003Cbody');
		expect(page).not.toContain('<body style=');
		// 运行时拼进 <style> 之前会剔除 CSS 结构字符、fixed 定位与 external url
		expect(page).toContain('.replace(/[<>{}@;]/g');
		expect(page).toContain('position\\s*');
		expect(page).toContain('url\\s*');
		// 模拟该清洗，确认无法闭合选择器注入新规则
		const bodyStyle = html.match(/<body[^>]*style="([^"]*)"[^>]*>/i)[1]
			.replace(/[<>{}@;]/g, ' ')
			.replace(/(?:^|\s)position\s*:\s*(?:fixed|sticky)\b[^;]*/gi, '')
			.replace(/url\s*\(/gi, 'none(');
		expect(bodyStyle).not.toMatch(/[{};]/);
		expect(bodyStyle).not.toMatch(/position\s*:/i);
	});

});

describe('回复头 CRLF', () => {

	it('sanitizeHeaderValue 去掉 CR/LF，注入内容只能留在同一行', () => {
		const value = sanitizeHeaderValue('<abc@example.com>\r\nBcc: attacker@evil.example');
		expect(value).not.toMatch(/[\r\n]/);
		expect(value.startsWith('<abc@example.com>')).toBe(true);
	});

	it('postal-mime 解析折叠 Message-ID 时不会产出裸 CRLF', async () => {
		const eml = [
			'From: a@example.com',
			'To: b@example.com',
			'Subject: hello',
			'Message-ID: <abc@example.com>',
			'X-Injected: 1',
			'Content-Type: text/plain; charset=utf-8',
			'',
			'body'
		].join('\r\n');
		const parsed = await new PostalMime().parse(eml);
		expect(parsed.messageId).toBe('<abc@example.com>');
		expect(parsed.messageId).not.toMatch(/[\r\n]/);
		// 注入字段只会成为独立头，不会混进 messageId
		expect(parsed.headers.some(h => h.key === 'x-injected')).toBe(true);
	});

});

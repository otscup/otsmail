// 内置分类规则的人工核对脚本。
// 零依赖：只用 Node 内置模块，不进入生产包，不读数据库、不联网。
// 运行：node mail-worker/scripts/check-builtin-rules.mjs
//
// 说明：用例是构造数据，只验证"规则是否按预期触发"，不代表真实邮件的准确率。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, '..', 'src', 'utils', 'builtin-rules.js');
const source = fs.readFileSync(sourcePath, 'utf8');

// builtin-rules.js 不含相对导入，用 data: URL 载入可绕开 package.json 的模块类型差异
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { explainBuiltinRules } = mod;

const header = (key, value) => ({ key, value });
const mail = ({ from, name = '', subject = '', text = '', headers = [], inReplyTo = '', references = '' }) => ({
	from: { address: from, name },
	subject,
	text,
	headers,
	inReplyTo,
	references
});

const cases = [
	{
		name: '社交：Facebook 通知',
		expect: 'social',
		email: mail({
			from: 'notification@facebookmail.com',
			name: 'Facebook',
			subject: 'You have a new follower',
			text: 'Someone started following you.'
		})
	},
	{
		name: '社交：LinkedIn 消息',
		expect: 'social',
		email: mail({ from: 'messages-noreply@linkedin.com', subject: 'New message from a recruiter' })
	},
	{
		name: '社交：Slack 提醒',
		expect: 'social',
		email: mail({ from: 'feedback@slack.com', subject: 'You have a new message' })
	},
	{
		name: '社交：微博通知',
		expect: 'social',
		email: mail({ from: 'noreply@weibo.com', subject: '你有新的粉丝' })
	},
	{
		name: '社交：弱信号叠加（非官方域名）',
		expect: 'social',
		email: mail({
			from: 'news@updates.example',
			subject: 'LinkedIn: new follower',
			text: 'You have a new follower on LinkedIn.'
		})
	},
	{
		name: '推广：一键退订 + 折扣',
		expect: 'promotion',
		email: mail({
			from: 'news@shop.example',
			subject: '50% off this week',
			text: 'Summer sale is live.',
			headers: [
				header('List-Unsubscribe', '<https://shop.example/unsub>'),
				header('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click')
			]
		})
	},
	{
		name: '推广：中文促销词',
		expect: 'promotion',
		email: mail({
			from: 'promo@shop.example',
			subject: '限时折扣 双11 专场',
			text: '全场优惠券可用。',
			headers: [header('List-Unsubscribe', '<https://shop.example/unsub>')]
		})
	},
	{
		name: '推广：ESP 域名 + 退订头',
		expect: 'promotion',
		email: mail({
			from: 'hello@mailchimp.com',
			subject: 'Our monthly sale',
			text: 'Deals inside.',
			headers: [header('List-Unsubscribe', '<https://mailchimp.com/unsub>')]
		})
	},
	{
		name: '推广：中文限时秒杀',
		expect: 'promotion',
		email: mail({
			from: 'promo@shop.example',
			subject: '限时秒杀 5折',
			text: '领券立减。',
			headers: [header('List-Unsubscribe', '<https://shop.example/unsub>')]
		})
	},
	{
		name: '动态：订单发货',
		expect: 'updates',
		email: mail({ from: 'noreply@shop.example', subject: 'Your order has shipped', text: 'Track your package.' })
	},
	{
		name: '动态：验证码',
		expect: 'updates',
		email: mail({ from: 'security@bank.example', subject: 'Your verification code', text: 'Code: 123456' })
	},
	{
		name: '动态：密码重置',
		expect: 'updates',
		email: mail({ from: 'no-reply@accounts.example', subject: 'Password reset requested' })
	},
	{
		name: '动态：Auto-Submitted 自动通知',
		expect: 'updates',
		email: mail({
			from: 'notifications@example.com',
			subject: 'Your account statement',
			headers: [header('Auto-Submitted', 'auto-generated')]
		})
	},
	{
		name: '边界：带 List-Unsubscribe 的订单通知',
		expect: 'updates',
		email: mail({
			from: 'noreply@shop.example',
			subject: 'Order confirmed',
			text: 'Invoice attached.',
			headers: [header('List-Unsubscribe', '<https://shop.example/unsub>')]
		})
	},
	{
		name: '边界：订单营销（应判推广）',
		expect: 'promotion',
		email: mail({
			from: 'news@shop.example',
			subject: '限时优惠：你的订单可享 8 折',
			text: '优惠券立减，速来。',
			headers: [header('List-Unsubscribe', '<https://shop.example/unsub>')]
		})
	},
	{
		name: '边界：回复他人邮件（压制推广词）',
		expect: 'primary',
		email: mail({
			from: 'alice@example.com',
			name: 'Alice',
			subject: 'Re: 50% off',
			text: 'Sounds good.',
			inReplyTo: '<msg-1@mail.example>'
		})
	},
	{
		name: '主要：普通个人邮件',
		expect: 'primary',
		email: mail({ from: 'bob@example.com', name: 'Bob', subject: 'Lunch tomorrow?', text: 'See you at 12.' })
	},
	{
		name: '垃圾：强词 + SPF/DMARC 双失败',
		expect: 'spam',
		email: mail({
			from: 'x@spam.example',
			subject: 'viagra casino lottery',
			text: 'claim your prize',
			headers: [header('Authentication-Results', 'spf=fail; dmarc=fail')]
		})
	},
	{
		name: '垃圾：仅强词（不放大现有垃圾判定）',
		expect: 'primary',
		email: mail({
			from: 'x@spam.example',
			subject: 'viagra casino lottery',
			text: 'claim your prize',
			headers: [header('Authentication-Results', 'spf=pass; dmarc=pass')]
		})
	},
	{
		name: '边界：ESP 域名 + noreply 的收据',
		expect: 'updates',
		email: mail({ from: 'noreply@mailchimp.com', subject: 'Your order receipt' })
	}
];

const pad = (value, width) => {
	const text = String(value);
	// 中文按双宽估算，保证输出大致对齐
	const length = [...text].reduce((sum, ch) => sum + (/[\u4e00-\u9fa5]/.test(ch) ? 2 : 1), 0);
	return text + ' '.repeat(Math.max(1, width - length));
};

let failed = 0;
console.log('内置分类规则核对（构造用例，不代表真实准确率）\n');
console.log(`${pad('#', 3)}${pad('场景', 40)}${pad('期望', 11)}${pad('判定', 11)}${pad('分数', 34)}命中规则`);
console.log('-'.repeat(140));

cases.forEach((item, index) => {
	const result = explainBuiltinRules(item.email);
	const actual = result.category || 'primary(回落)';
	const pass = item.expect === 'primary'
		? result.category === 'primary' || result.category === null
		: result.category === item.expect;
	if (!pass) failed += 1;

	const scores = Object.entries(result.scores)
		.filter(([, value]) => value !== 0)
		.map(([key, value]) => `${key}=${value}`)
		.join(' ');
	const rules = result.hits.map(hit => `${hit.rule}(${hit.weight > 0 ? '+' : ''}${hit.weight})`).join(', ') || '-';

	console.log(`${pad(index + 1, 3)}${pad(item.name, 40)}${pad(item.expect, 11)}${pad(actual, 11)}${pad(scores || '-', 34)}${rules}${pass ? '' : '  <-- 不符'}`);
});

console.log('-'.repeat(140));
console.log(`用例 ${cases.length} 个，不符 ${failed} 个。`);

if (cases.some(item => /(import|require)\s*\(/.test(source))) {
	console.log('警告：builtin-rules.js 出现了模块导入，纯函数约束被破坏。');
	failed += 1;
}

process.exit(failed === 0 ? 0 : 1);

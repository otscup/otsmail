import { describe, it, expect } from 'vitest';
import emailMsgTemplate from '../src/template/email-msg';

// TG 通知正文摘要（email-msg.js）——治"长串未截断"痛点（架构 §4.x / product-ui 定稿）
// 需求：正文不整封塞进 TG（HTML 剥出超长串/长 URL/base64 顶破排版），
// 改为摘要式：折叠超长行 + 截前 ~400 字符，全文靠 View 按钮。

describe('emailMsgTemplate — TG 正文摘要（折叠长行 + 截断）', () => {

  const base = { subject: 'Hi', name: 'Bob', sendEmail: 'bob@x.com', toEmail: 'me@otscup.com', code: '' };

  it('短正文原样保留（不截断、不折叠）', () => {
    const html = emailMsgTemplate({ ...base, text: 'hello world', content: '' }, 'show', 'show', 'show');
    expect(html).toContain('hello world');
  });

  it('长 URL 行折叠（>80 字符折到 60 + …），否则一整串顶破排版', () => {
    const longUrl = 'https://'.padEnd(160, 'x'); // 160 字符长 URL
    const out = emailMsgTemplate({ ...base, text: longUrl, content: '' }, 'show', 'show', 'show');
    // 折叠后不应保留完整 160 字符长串
    expect(out).toContain(longUrl.slice(0, 60) + '…');
    expect(out).not.toContain(longUrl.slice(61, 160));
  });

  it('超长正文（含引用链）截到 SUMMARY_LIMIT(~400)+省略号', () => {
    const bigText = new Array(200).fill('段落内容 abcdefghij').join('\n'); // 远超 400
    const out = emailMsgTemplate({ ...base, text: bigText, content: '' }, 'show', 'show', 'show');
    // 不应含完整长文
    const bodyPart = out.split('To：')[1] || '';
    expect(bodyPart.length).toBeLessThanOrEqual(400 + 40); // 摘要 400 + 省略/边界余量
    expect(out).toContain('...');
  });

  it('tgMsgText 非 show 时不带正文', () => {
    const out = emailMsgTemplate({ ...base, text: 'hello world', content: '' }, 'show', 'show', 'hide');
    expect(out).not.toContain('hello world');
  });

  it('空正文不报错、不追加多余内容', () => {
    const out = emailMsgTemplate({ ...base, text: '', content: '' }, 'show', 'show', 'show');
    expect(out).not.toContain('undefined');
  });

  it('附带邮件 ID，供 Telegram 引用回复识别原邮件', () => {
    const out = emailMsgTemplate({ ...base, emailId: 1025, text: 'hi', content: '' }, 'show', 'show', 'show');
    expect(out).toContain('#1025');
  });
});
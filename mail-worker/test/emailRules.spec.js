import { describe, it, expect } from 'vitest';
import emailRules from '../src/utils/emailRules';

// N-02 Google/Gmail 来源邮件分流 —— 单测（对齐架构 v1.2，email.js 生产路径）
// 生产调用：emailRules.isGoogleSourcedEmail(email, env)（email 为 PostalMime 对象，含 from/headers）

const envOn = { SKIP_FORWARD_GMAIL_FORWARDED: true };
const envOnStr = { SKIP_FORWARD_GMAIL_FORWARDED: 'true' }; // --var 注入的字符串形式（P0 bug 修复点）
const envOff = { SKIP_FORWARD_GMAIL_FORWARDED: false };

// —— 开关控制（零回归）——
describe('isGoogleSourcedEmail — 开关控制（零回归）', () => {
  const gmailEmail = { from: { address: 'noreply-accounts@google.com' }, headers: [] };
  it('开关关闭(false) → false，即使 Google 来源', () => {
    expect(emailRules.isGoogleSourcedEmail(gmailEmail, envOff)).toBe(false);
  });
  it('env 缺失 → false（防御）', () => {
    expect(emailRules.isGoogleSourcedEmail(gmailEmail, undefined)).toBe(false);
  });
  it('开关布尔 true → 参与判定', () => {
    expect(emailRules.isGoogleSourcedEmail(gmailEmail, envOn)).toBe(true);
  });
  it('开关字符串 "true" → 参与判定（P0 字符串容错修复）', () => {
    expect(emailRules.isGoogleSourcedEmail(gmailEmail, envOnStr)).toBe(true);
  });
});

// —— 主信号：GMAIL_ROUTING_INBOX 收件地址（架构 §4.11 v1.3）——
describe('主信号 — GMAIL_ROUTING_INBOX 收件地址命中（§4.11 v1.3）', () => {
  const envRouting = { SKIP_FORWARD_GMAIL_FORWARDED: true, GMAIL_ROUTING_INBOX: 'gmail@otscup.com' };
  it('toEmail 命中 gmail@otscup.com → true（即使 From 非 Google 域，419 代价样本）', () => {
    // 163 直发 gmail@otscup.com → 只进 TG（419 已知代价，豆豆已接受）
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'vincent_dam@163.com' }, headers: [] }, envRouting, 'gmail@otscup.com')).toBe(true);
  });
  it('toEmail 大小写不敏感命中 → true', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'x@g.com' }, headers: [] }, envRouting, 'GMAIL@otscup.com')).toBe(true);
  });
  it('未命中路由收件地址（默认 gmail@otscup.com）→ 不判主信号，走辅助判定', () => {
    // 非 google 来源 + 非路由地址 → false（不误判为 Google）
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'vincent_dam@163.com' }, headers: [] }, envRouting, 'other@otscup.com')).toBe(false);
  });
  it('toEmail 缺失 → 主信号跳过，不误判（向后兼容）', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'vincent_dam@163.com' }, headers: [] }, envRouting)).toBe(false);
  });
  it('env 未配 GMAIL_ROUTING_INBOX 时默认 gmail@otscup.com 生效', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'a@x.com' }, headers: [] }, envOn, 'gmail@otscup.com')).toBe(true);
  });
});
describe('A 类 — Google/Gmail 来源域', () => {
  it('@google.com 直接发（noreply-accounts@google.com）→ true', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'noreply-accounts@google.com' }, headers: [] }, envOn)).toBe(true);
  });
  it('@gmail.com → true', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'someone@gmail.com' }, headers: [] }, envOn)).toBe(true);
  });
  it('@googlemail.com → true', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'x@googlemail.com' }, headers: [] }, envOn)).toBe(true);
  });
  it('完整域匹配：notgmail.com / gmail.com.evil.cn 不误判', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'a@notgmail.com' }, headers: [] }, envOn)).toBe(false);
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'a@gmail.com.evil.cn' }, headers: [] }, envOn)).toBe(false);
  });
  it('from 缺失/空地址 → false', () => {
    expect(emailRules.isGoogleSourcedEmail({}, envOn)).toBe(false);
    expect(emailRules.isGoogleSourcedEmail({ from: { address: '' } }, envOn)).toBe(false);
  });
  it('普通来源域（outlook/github）→ false', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'short-deng@outlook.com' }, headers: [] }, envOn)).toBe(false);
  });
});

// —— 场景 A — 普通邮件（无 Google 来源、无签名头）→ false，走正常转发——
describe('场景 A — 普通邮件（走正常 forward）', () => {
  it('普通邮件无 Gmail 头 → false', () => {
    const email = { from: { address: 'github@notifications.github.com' }, headers: [{ key: 'from', value: 'x' }] };
    expect(emailRules.isGoogleSourcedEmail(email, envOn)).toBe(false);
  });
  it('空/缺失 headers → 来源域判定仍生效', () => {
    expect(emailRules.isGoogleSourcedEmail({ from: { address: 'a@gmail.com' }, headers: [] }, envOn)).toBe(true);
  });
});

// —— 场景 B — Gmail 转发邮件 ——
describe('B 类 — Gmail 转发（签名头）', () => {
  const gmailFromOther = { from: { address: 'friend@outlook.com' }, headers: [
    { key: 'x-google-smtp-source', value: 'AHRHTsbfHgvANTUv0iVMbPkGg42GkZon53WwWZ0qZHOfsXIBNQ' } ] };
  it('来源非 Google 但带可信 Gmail 转发头（朋友→你Gmail→转发）→ true', () => {
    expect(emailRules.isGoogleSourcedEmail(gmailFromOther, envOn)).toBe(true);
  });
  it('仅命中 X-Gm-Original-From 合法邮箱 → true', () => {
    const e = { from: { address: 'a@outlook.com' }, headers: [{ key: 'x-gm-original-from', value: 'friend@gmail.com' }] };
    expect(emailRules.isGoogleSourcedEmail(e, envOn)).toBe(true);
  });
});

// —— 防伪造 / 边界 ——
describe('防伪造 / 边界（普通邮件不能被误伤）', () => {
  it('Smtp-Source 值过短(<16)→ false', () => {
    const e = { from: { address: 'a@outlook.com' }, headers: [{ key: 'x-google-smtp-source', value: 'short' }] };
    expect(emailRules.isGoogleSourcedEmail(e, envOn)).toBe(false);
  });
  it('X-Gm-Original-From 非合法邮箱 → false', () => {
    const e = { from: { address: 'a@outlook.com' }, headers: [{ key: 'x-gm-original-from', value: 'not-an-email' }] };
    expect(emailRules.isGoogleSourcedEmail(e, envOn)).toBe(false);
  });
  it('普通邮件塞伪造 Google 头（值不合规）→ false', () => {
    const e = { from: { address: 'github@github.com' }, headers: [{ key: 'x-google-smtp-source', value: 'garbage' }] };
    expect(emailRules.isGoogleSourcedEmail(e, envOn)).toBe(false);
  });
});

// —— 配置扩展 ——
describe('GMAIL_FORWARD_HEADERS 配置', () => {
  it('自定义签名头清单生效', () => {
    const env = { SKIP_FORWARD_GMAIL_FORWARDED: true, GMAIL_FORWARD_HEADERS: 'X-My-Custom-Sig' };
    const e = { from: { address: 'a@outlook.com' }, headers: [{ key: 'x-my-custom-sig', value: 'anything' }] };
    expect(emailRules.isGoogleSourcedEmail(e, env)).toBe(true);
  });
});
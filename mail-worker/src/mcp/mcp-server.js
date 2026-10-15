/**
 * otsmail MCP Server
 *
 * 通过 Model Context Protocol 暴露邮箱能力：
 * - list_emails: 列出邮件
 * - read_email: 读取单封邮件详情
 * - send_email: 发送邮件（支持附件）
 * - delete_email: 删除邮件（移回收站，带速率限制）
 * - mark_read: 标记已读
 *
 * 鉴权：复用现有 JWT（Authorization: Bearer *** security 中间件校验，
 * 这里通过闭包拿到已鉴权的 (c, userId)。
 *
 * 安全（RBAC + 审计）：
 * - MCP 是单一 HTTP 端点，不能靠 security.js 的 requirePerms 做逐工具权限；
 *   因此在工具执行前用 permService 校验 email:send / email:delete 权限（admin 放行），
 *   避免"被剥夺角色权限的用户经 MCP 旁路发信/删信"。
 * - 每笔写操作打一条审计日志，标记 via MCP + accountId，便于区分 AI 客户端与本人网页操作。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import emailService from '../service/email-service.js';
import accountService from '../service/account-service.js';
import permService from '../service/perm-service.js';
import userService from '../service/user-service.js';
import userContext from '../security/user-context.js';
import { emailConst, isDel } from '../const/entity-const.js';
import KvConst from '../const/kv-const.js';
import { t } from '../i18n/i18n.js';

const MCP_DELETE_DAILY_LIMIT = 200;
const AUDIT_LOG_LIMIT = 100;

function err(msg) {
	return { content: [{ type: 'text', text: msg }], isError: true };
}

function ok(data) {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function createMcpServer(c) {
	const userId = userContext.getUserId(c);
	const server = new McpServer({ name: 'otsmail', version: '1.0.0' });

	// 当前账号范围：跟随该用户"主账号"（sort 最大且未删），明确可预期——
	// MCP 只暴露 JWT holder 单一主账号的邮件，不跨账号、不切换，避免 AI 客户端越权访问。
	async function mainAccountId() {
		const list = await accountService.list(c, { size: 30 }, userId);
		const rows = Array.isArray(list) ? list : [];
		if (rows.length === 0) return 0;
		rows.sort((a, b) => b.sort - a.sort || b.accountId - a.accountId);
		return rows[0].accountId;
	}

	// 逐工具 RBAC：校验 permKey 是否在用户权限内（admin 放行），否则拒绝。
	async function requirePerm(permKey) {
		const userRow = await userService.selectById(c, userId);
		if (userRow && userRow.email === c.env.admin) return true;
		const permKeys = await permService.userPermKeys(c, userId);
		return Array.isArray(permKeys) && permKeys.includes(permKey);
	}

	// 速率限制（KV 计数，按 用户+日期）：自动化入口无节流会一键删光，这里按日限额。
	async function allowAction(kind) {
		const dayKey = new Date().toISOString().slice(0, 10);
		const kvKey = KvConst.MCP_ACTION + kind + ':' + userId + ':' + dayKey;
		const cur = Number(await c.env.kv.get(kvKey, { type: 'text' }) || 0);
		if (cur >= MCP_DELETE_DAILY_LIMIT) return false;
		await c.env.kv.put(kvKey, String(cur + 1), { expirationTtl: 86400 });
		return true;
	}

	// 审计：写操作追加到 user_mcp_log（内存态截断），标记 via MCP + accountId
	async function audit(c, action, accountId, detail) {
		try {
			const userRow = await userService.selectById(c, userId);
			const logKey = KvConst.MCP_LOG + userId;
			const raw = await c.env.kv.get(logKey, { type: 'json' });
			const logs = Array.isArray(raw?.logs) ? raw.logs : [];
			logs.push({
				action,
				via: 'mcp',
				accountId,
				email: userRow?.email || '',
				detail: detail || '',
				at: new Date().toISOString()
			});
			await c.env.kv.put(logKey, JSON.stringify({ logs: logs.slice(-AUDIT_LOG_LIMIT) }), { expirationTtl: 60 * 60 * 24 * 30 });
		} catch (e) {
			console.error('mcp audit failed:', e.message);
		}
	}

	// folder / keyword 内存后过滤（emailService.list 不支持这两个维度）
	function filterEmails(list, folder, keyword) {
		let rows = Array.isArray(list) ? list : [];
		if (folder === 'sent') {
			rows = rows.filter(e => e.type === emailConst.type.SEND);
		} else if (folder === 'trash') {
			rows = rows.filter(e => e.isDel === isDel.DELETE);
		} else if (folder === 'inbox') {
			rows = rows.filter(e => e.type === emailConst.type.RECEIVE);
		} else if (folder === 'draft') {
			rows = rows.filter(e => e.status === emailConst.status.SAVING);
		}
		if (keyword) {
			const kw = String(keyword).toLowerCase();
			rows = rows.filter(e => (e.subject || '').toLowerCase().includes(kw) || (e.name || '').toLowerCase().includes(kw) || (e.sendEmail || '').toLowerCase().includes(kw));
		}
		return rows;
	}

	server.tool(
		'list_emails',
		'列出当前主账号的邮件，支持分页和文件夹/关键词筛选',
		{
			page: z.number().optional().default(1).describe('页码，从1开始'),
			pageSize: z.number().optional().default(20).describe('每页数量，最多 50'),
			folder: z.enum(['inbox', 'sent', 'trash', 'draft']).optional().describe('文件夹'),
			keyword: z.string().optional().describe('关键词搜索（主题/发件人/地址）')
		},
		async ({ page, pageSize, folder, keyword }) => {
			const size = Math.min(50, Math.max(1, pageSize));
			const offset = (page - 1) * size;
			const accountId = await mainAccountId();
			// allReceive=0 强制只取主账号邮件（不传会按账号 allReceive 属性跨账号，违反 MCP 单账号作用域）
			const list = await emailService.list(c, {
				size,
				emailId: 0,
				timeSort: 1,
				accountId,
				allReceive: 0
			}, userId);
			const rows = filterEmails(list, folder, keyword);
			return ok(rows.slice(offset, offset + size));
		}
	);

	server.tool(
		'read_email',
		'读取单封邮件的完整内容（正文、附件列表等）',
		{ id: z.string().describe('邮件ID') },
		async ({ id }) => {
			const data = await emailService.detail(c, { emailId: Number(id) }, userId);
			return ok(data);
		}
	);

	server.tool(
		'send_email',
		'发送一封新邮件（需要邮件发送权限；支持附件 base64）',
		{
			to: z.string().describe('收件人邮箱，多个用逗号分隔'),
			subject: z.string().describe('邮件主题'),
			content: z.string().describe('邮件正文（支持HTML）'),
			cc: z.string().optional().describe('抄送，多个用逗号分隔'),
			bcc: z.string().optional().describe('密送，多个用逗号分隔'),
			attachments: z.array(z.object({
				name: z.string().describe('附件文件名（含扩展名）'),
				content: z.string().describe('附件内容的 base64')
			})).optional().describe('附件列表')
		},
		async ({ to, subject, content, cc, bcc, attachments }) => {
			if (!(await requirePerm('email:send'))) {
				return err(t('unauthorized'));
			}
			const accountId = await mainAccountId();
			// service 层附件期望 { filename, content(base64) }；name→filename 转换
			const atts = (attachments || []).map(a => ({
				filename: a.name,
				content: a.content
			}));
			const params = {
				accountId,
				receiveEmail: String(to).split(',').map(s => s.trim()).filter(Boolean),
				subject,
				content,
				text: '',
				name: '',
				sendType: '',
				emailId: 0,
				attachments: atts
			};
			if (cc) params.cc = String(cc).split(',').map(s => s.trim()).filter(Boolean);
			if (bcc) params.bcc = String(bcc).split(',').map(s => s.trim()).filter(Boolean);
			const data = await emailService.send(c, params, userId);
			await audit(c, 'send_email', accountId, subject);
			return ok({ success: true, data });
		}
	);

	server.tool(
		'delete_email',
		'删除一封邮件（移到回收站；需要邮件删除权限，带每日速率限制）',
		{ id: z.string().describe('邮件ID') },
		async ({ id }) => {
			if (!(await requirePerm('email:delete'))) {
				return err(t('unauthorized'));
			}
			if (!(await allowAction('delete'))) {
				return err(t('mcpRateLimit'));
			}
			await emailService.delete(c, { emailIds: String(id) }, userId);
			const accountId = await mainAccountId();
			await audit(c, 'delete_email', accountId, String(id));
			return ok({ success: true });
		}
	);

	server.tool(
		'mark_read',
		'将邮件标记为已读',
		{ id: z.string().describe('邮件ID') },
		async ({ id }) => {
			await emailService.read(c, { emailIds: String(id) }, userId);
			const accountId = await mainAccountId();
			await audit(c, 'mark_read', accountId, String(id));
			return ok({ success: true });
		}
	);

	return server;
}

export default { createMcpServer };
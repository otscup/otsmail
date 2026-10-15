/**
 * otsmail MCP Server
 *
 * 通过 Model Context Protocol 暴露邮箱能力：
 * - list_emails: 列出邮件
 * - read_email: 读取单封邮件详情
 * - send_email: 发送邮件
 * - delete_email: 删除邮件
 * - mark_read: 标记已读
 *
 * 认证：复用现有 JWT（Authorization: Bearer <token>），由 Hono 中间件校验，
 * 这里通过闭包拿到已鉴权的 (c, userId)。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import emailService from '../service/email-service.js';
import userContext from '../security/user-context.js';

export function createMcpServer(c) {
  const userId = userContext.getUserId(c);
  const server = new McpServer({ name: 'otsmail', version: '1.0.0' });

  server.tool(
    'list_emails',
    '列出用户的邮件，支持分页和文件夹筛选',
    {
      page: z.number().optional().default(1).describe('页码，从1开始'),
      pageSize: z.number().optional().default(20).describe('每页数量'),
      folder: z.string().optional().describe('文件夹：inbox/sent/draft/trash'),
      keyword: z.string().optional().describe('关键词搜索（主题/发件人）'),
    },
    async ({ page, pageSize, folder, keyword }) => {
      const params = { page, pageSize };
      if (folder) params.folder = folder;
      if (keyword) params.keyword = keyword;
      const data = await emailService.list(c, params, userId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'read_email',
    '读取单封邮件的完整内容（正文、附件列表等）',
    { id: z.string().describe('邮件ID') },
    async ({ id }) => {
      const data = await emailService.detail(c, { id }, userId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'send_email',
    '发送一封新邮件',
    {
      to: z.string().describe('收件人邮箱，多个用逗号分隔'),
      subject: z.string().describe('邮件主题'),
      content: z.string().describe('邮件正文（支持HTML）'),
      cc: z.string().optional().describe('抄送，多个用逗号分隔'),
      bcc: z.string().optional().describe('密送，多个用逗号分隔'),
    },
    async ({ to, subject, content, cc, bcc }) => {
      const params = { to, subject, content };
      if (cc) params.cc = cc;
      if (bcc) params.bcc = bcc;
      const data = await emailService.send(c, params, userId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data }, null, 2) }] };
    }
  );

  server.tool(
    'delete_email',
    '删除一封邮件（移到回收站）',
    { id: z.string().describe('邮件ID') },
    async ({ id }) => {
      await emailService.delete(c, { id }, userId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'mark_read',
    '将邮件标记为已读',
    { id: z.string().describe('邮件ID') },
    async ({ id }) => {
      await emailService.read(c, { id }, userId);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
    }
  );

  return server;
}

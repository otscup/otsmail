import app from '../hono/hono';
import result from '../model/result';
import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import { publicCatalog } from '../utils/mail-providers';
import {
	list as listExtAccounts,
	bind as bindExtAccount,
	remove as removeExtAccount,
	credential as credentialOf,
} from '../service/ext-account-service';
import { archive as archiveMail, dropArchive, saveSyncError } from '../service/ext-mail-service';

// 自动探测规则表（服务端真源；客户端带一份同样的离线副本）
app.get('/ext/providers', c => c.json(result.ok(publicCatalog())));

// 已绑定的第三方邮箱（只返回元信息与拉取游标，永远不含凭据）
app.get('/ext/accounts', async c => {
	const userId = userContext.getUserId(c);
	return c.json(result.ok(await listExtAccounts(c, userId)));
});

// 绑定：必须带上客户端实测过的 IMAP / SMTP 结果
app.post('/ext/bind', async c => {
	const userId = userContext.getUserId(c);
	const body = await c.req.json().catch(() => ({}));
	return c.json(result.ok(await bindExtAccount(c, userId, body)));
});

/**
 * 拉取层取口令：客户端在设备上直连 IMAP，必须临时拿到明文授权码。
 * 只在 TLS 上单次下发，客户端用完即弃；服务端不落日志。
 */
app.post('/ext/accounts/credential', async c => {
	const userId = userContext.getUserId(c);
	const body = await c.req.json().catch(() => ({}));
	const extId = Number(body.extId);
	if (!extId) throw new BizError('缺少 extId', 400);
	return c.json(result.ok(await credentialOf(c, userId, extId)));
});

// 归档：客户端从 IMAP 拉一封、解析完就传一封（幂等，按 ext_id + Message-ID 去重）
app.post('/ext/mail/archive', async c => {
	const userId = userContext.getUserId(c);
	const body = await c.req.json().catch(() => ({}));
	return c.json(result.ok(await archiveMail(c, userId, body)));
});

// 拉取失败原因回写（只存分类文案，不存凭据）
app.post('/ext/mail/sync-error', async c => {
	const userId = userContext.getUserId(c);
	const body = await c.req.json().catch(() => ({}));
	const extId = Number(body.extId);
	if (!extId) throw new BizError('缺少 extId', 400);
	await saveSyncError(c, userId, extId, body.message, body.uidValidity);
	return c.json(result.ok());
});

app.post('/ext/accounts/delete', async c => {
	const userId = userContext.getUserId(c);
	const body = await c.req.json().catch(() => ({}));
	const extId = Number(body.extId);
	if (!extId) throw new BizError('缺少 extId', 400);
	// 先清归档与附件对象，再解绑，避免 R2 里留下无主文件
	await dropArchive(c, userId, extId);
	await removeExtAccount(c, userId, extId);
	return c.json(result.ok());
});

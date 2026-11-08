import r2Service from '../service/r2-service';
import app from '../hono/hono';

app.get('/oss/*', async (c) => {
	const key = c.req.path.split('/oss/')[1];
	// 附件只能走 /attachments 的短时签名；/oss 只公开头像/背景图，不能成为绕过签名的旁路。
	// ext/ 是第三方邮箱归档附件，同样属于私有数据，不能从这里读。
	if (key.startsWith('attachments/') || key.startsWith('ext/')) {
		return c.text('Forbidden', 403);
	}
	// /oss 与 /attachments 一样必须按扩展名/MIME 强制下载，不能把历史 HTML/SVG 原样回显。
	return r2Service.publicObjResp(c, key);
});



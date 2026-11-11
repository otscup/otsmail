import app from '../hono/hono';
import { PASSKEY_PACKAGE_NAME, certFingerprints, requestHostname } from '../lib/passkey-config';
import result from '../model/result';
import userContext from '../security/user-context';
import passkeyService from '../service/passkey-service';
import userService from '../service/user-service';

/**
 * Android 通行密钥（Credential Manager）的 RP ID 校验依赖本文件：
 * 缺失或指纹不匹配时，创建凭据会直接报 [50152] RP ID cannot be validated。
 * 必须是裸 JSON 数组（不能包 result.ok），Content-Type 必须是 application/json。
 * /.well-known 已在 security 的免鉴权白名单内，无需登录即可访问。
 *
 * 按 Google《Android 版 FIDO2 API》要求，迁移完成前 handle_all_urls 与
 * get_login_creds 必须并存，因此 android_app 与 web 两条语句都声明这两个 relation。
 */
app.get('/.well-known/assetlinks.json', (c) => {
	// 改动后最多 5 分钟生效，避免旧缓存长期滞留
	c.header('Cache-Control', 'public, max-age=300');
	const relation = [
		'delegate_permission/common.get_login_creds',
		'delegate_permission/common.handle_all_urls'
	];
	return c.json([
		{
			relation,
			target: {
				namespace: 'android_app',
				package_name: PASSKEY_PACKAGE_NAME,
				sha256_cert_fingerprints: certFingerprints(c.env)
			}
		},
		{
			relation,
			target: {
				namespace: 'web',
				site: `https://${requestHostname(c)}`
			}
		}
	]);
});

app.get('/my/passkey/list', async (c) => {
	const list = await passkeyService.list(c, userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.post('/my/passkey/register/options', async (c) => {
	const userId = userContext.getUserId(c);
	const user = await userService.selectById(c, userId);
	const options = await passkeyService.registerOptions(c, userId, user.email);
	return c.json(result.ok(options));
});

app.post('/my/passkey/register/verify', async (c) => {
	const userId = userContext.getUserId(c);
	await passkeyService.registerVerify(c, userId, await c.req.json());
	return c.json(result.ok());
});

app.delete('/my/passkey/:id', async (c) => {
	await passkeyService.delete(c, userContext.getUserId(c), c.req.param('id'));
	return c.json(result.ok());
});

// 免密登录（免鉴权放行）
app.post('/login/passkey/options', async (c) => {
	const options = await passkeyService.loginOptions(c);
	return c.json(result.ok(options));
});

app.post('/login/passkey/verify', async (c) => {
	const res = await passkeyService.loginVerify(c, await c.req.json());
	return c.json(result.ok(res));
});

import BizError from '../error/biz-error';

/**
 * 通行密钥（WebAuthn / Passkey）服务端配置。
 *
 * rpID 必须是 App / 网页实际访问的域名，而且该域名根目录要能给出
 * /.well-known/assetlinks.json 且包含 App 签名证书指纹；否则 Android
 * Credential Manager 在创建凭据时会直接报 [50152] RP ID cannot be validated。
 *
 * 支持一个 Worker 绑定多个域名：PASSKEY_RP_ID 用英文逗号分隔多个 rpID，
 * 每次请求按 Host 头解析出该请求所属的那个 rpID，注册与登录都用它校验。
 */

export const PASSKEY_PACKAGE_NAME = 'com.otscup.otsmail';

/**
 * App 签名证书 SHA-256 指纹（对应 assetlinks.json 的 sha256_cert_fingerprints）。
 * - release：keystore.properties 指向的发版证书
 * - debug：本机 Android Debug 证书（0.3.4-dev 测试包）
 *
 * 注意：CI（GitHub Actions）构建的 debug 包用的是 runner 上临时生成的 debug keystore，
 * 每次构建指纹都不同，因此 CI debug 包永远无法通过 RP ID 校验，
 * 测通行密钥必须使用固定签名的包（本机 debug 包或 release 包）。
 * 自建实例请用 PASSKEY_ANDROID_CERT_SHA256 环境变量覆盖成自己 APK 的指纹。
 */
export const PASSKEY_DEFAULT_CERT_SHA256 = [
	'57:4C:06:64:44:B6:D5:C9:07:8D:F5:D0:06:40:E8:1E:C2:83:F7:37:DC:9D:F6:B9:95:1E:F2:1C:D5:39:67:A2',
	'C7:1E:A3:9A:75:5E:8C:0D:C1:7E:33:F9:E6:09:92:72:A1:72:41:72:85:A3:CE:BE:D1:BC:A2:A8:94:0D:47:93'
];

/** 注册 / 登录挑战在 KV 里的前缀，以及 5 分钟有效期 */
export const PASSKEY_KV_REG = 'passkey_reg:';
export const PASSKEY_KV_LOGIN = 'passkey_login:';
export const PASSKEY_KV_TTL = 300;

const RP_ID_MISSING_MESSAGE =
	'通行密钥未启用：请在 Worker 上配置环境变量 PASSKEY_RP_ID（填站点实际域名；多个域名用英文逗号分隔，例如 mail.a.com,mail.b.com）';

/** 证书指纹列表：环境变量优先，逗号 / 分号 / 空白分隔 */
export function certFingerprints(env) {
	const raw = env?.PASSKEY_ANDROID_CERT_SHA256;
	if (!raw || !String(raw).trim()) return PASSKEY_DEFAULT_CERT_SHA256;
	return String(raw)
		.split(/[,;\s]+/)
		.map(item => item.trim())
		.filter(Boolean)
		.map(item => item.toUpperCase());
}

/**
 * 允许的 rpID 列表：PASSKEY_RP_ID 用英文逗号分隔，允许前后空格。
 * 未配置时直接报错，不做任何「从请求 host 猜一个」的隐式回退。
 */
export function allowedRpIDs(env) {
	const list = String(env?.PASSKEY_RP_ID || '')
		.split(',')
		.map(item => normalizeHostname(item))
		.filter(Boolean);
	if (!list.length) {
		throw new BizError(RP_ID_MISSING_MESSAGE, 500);
	}
	return list;
}

/** 去掉端口、统一小写、去掉结尾的点（FQDN 写法） */
function normalizeHostname(host) {
	return String(host || '')
		.trim()
		.toLowerCase()
		.replace(/:\d+$/, '')
		.replace(/\.$/, '');
}

/**
 * 按请求 hostname 解析本次请求应使用的 rpID：
 * - 与配置项精确相等，命中；
 * - 或者配置项是请求 host 的上级域（sub.x.com 命中 x.com），命中；
 * - 都不命中就明确拒绝，不猜测、不回退。
 */
export function resolveRpID(env, host) {
	const allowed = allowedRpIDs(env);
	const hostname = normalizeHostname(host);
	if (!hostname) {
		throw new BizError('无法识别请求域名，通行密钥不可用', 400);
	}

	const matched = allowed.find(rpID => hostname === rpID || hostname.endsWith('.' + rpID));
	if (!matched) {
		throw new BizError(
			`当前域名 ${hostname} 未启用通行密钥：请把该域名（或其上级域）加入 Worker 的 PASSKEY_RP_ID，多个域名用英文逗号分隔`,
			403
		);
	}
	return matched;
}

/** 从请求里取 hostname（优先 Host 头，去掉端口） */
export function requestHostname(c) {
	const host = c?.req?.header?.('host');
	if (host) return normalizeHostname(host);
	try {
		return normalizeHostname(new URL(c.req.url).hostname);
	} catch (e) {
		return '';
	}
}

/**
 * 允许的 origin：
 * - 网页端：https://<按请求解析出的 rpID>
 * - Android 端：android:apk-key-hash:<base64url(SHA-256)>
 * 额外域名可用 PASSKEY_EXTRA_ORIGINS 追加（逗号分隔）。
 */
export function expectedOrigins(env, rpID) {
	const extra = String(env?.PASSKEY_EXTRA_ORIGINS || '')
		.split(/[,;\s]+/)
		.map(item => item.trim())
		.filter(Boolean);
	return [
		`https://${rpID}`,
		...extra,
		...certFingerprints(env).map(apkKeyHashOrigin)
	];
}

/**
 * 把证书 SHA-256 转成 Android Credential Manager 使用的 origin：
 * android:apk-key-hash:<base64url(SHA-256 裸字节)>
 */
export function apkKeyHashOrigin(fingerprint) {
	const hex = String(fingerprint).replace(/[^0-9a-fA-F]/g, '');
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return 'android:apk-key-hash:' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

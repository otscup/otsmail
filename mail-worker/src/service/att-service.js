import orm from '../entity/orm';
import { att } from '../entity/att';
import { and, eq, isNull, inArray, desc } from 'drizzle-orm';
import r2Service from './r2-service';
import constant from '../const/constant';
import fileUtils from '../utils/file-utils';
import { attConst } from '../const/entity-const';
import { parseHTML } from 'linkedom';
import { v4 as uuidv4 } from 'uuid';
import domainUtils from '../utils/domain-uitls';
import settingService from "./setting-service";
import proxyService from './proxy-service';

function unsafeInline(filename, mime) {
	const ext = String(filename || '').split('.').pop().toLowerCase();
	return ['html', 'htm', 'xhtml', 'svg', 'svgz', 'xml'].includes(ext)
		|| /^(text\/html|application\/xhtml\+xml|image\/svg\+xml)/i.test(mime || '');
}

function disposition(filename, inline) {
	const name = String(filename || 'attachment').replace(/["\\\r\n]/g, '_');
	return `${inline ? 'inline' : 'attachment'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const encoder = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
	.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// D1 单条语句最多 100 个绑定参数；附件表列多，6 行一批留足余量。
const ATT_INSERT_CHUNK = 6;
const ATT_DELETE_CHUNK = 50;

async function insertAttRows(c, rows) {
	for (let i = 0; i < rows.length; i += ATT_INSERT_CHUNK) {
		await orm(c).insert(att).values(rows.slice(i, i + ATT_INSERT_CHUNK)).run();
	}
}

// 插入失败时只清理没有任何附件行引用的 R2 对象，避免误删其他邮件的同 key 附件。
async function cleanupOrphanObjects(c, keys) {
	const unique = [...new Set(keys.filter(Boolean))];
	if (!unique.length) return;
	const referenced = new Set();
	for (let i = 0; i < unique.length; i += ATT_DELETE_CHUNK) {
		const chunk = unique.slice(i, i + ATT_DELETE_CHUNK);
		const placeholders = chunk.map(() => '?').join(',');
		const { results } = await c.env.db
			.prepare(`SELECT key FROM attachments WHERE key IN (${placeholders})`)
			.bind(...chunk)
			.all();
		for (const row of results || []) referenced.add(row.key);
	}
	for (const key of unique) {
		if (referenced.has(key)) continue;
		try {
			await r2Service.delete(c, key);
		} catch (e) {
			console.error('清理孤儿附件失败:', key, e);
		}
	}
}

// 附件/正文图片用短时签名 URL，避免 /attachments 变成可枚举的公开桶。
async function signKey(c, key, userId) {
	const bare = String(key).replace(/^attachments\//, '');
	const exp = Math.floor(Date.now() / 1000) + 60 * 60;
	const data = `${bare}|${userId}|${exp}`;
	const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(c.env.jwt_secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = b64url(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)));
	return `/attachments/${bare}?uid=${userId}&exp=${exp}&sig=${sig}`;
}

async function verifyKey(c, key, userId, exp, sig) {
	if (!key || !userId || !exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
	const secret = c.env?.jwt_secret || c.jwt_secret;
	if (!secret) return false;
	const data = `${key}|${userId}|${exp}`;
	const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
	try {
		let encoded = sig.replace(/-/g, '+').replace(/_/g, '/');
		while (encoded.length % 4) encoded += '=';
		const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
		return await crypto.subtle.verify('HMAC', cryptoKey, bytes, encoder.encode(data));
	} catch {
		return false;
	}
}

const attService = {

	signKey,

	verifyKey,

	async signContent(c, content, userId) {
		// 全部邮件里可能有 userId=0 的无人收件；用当前登录者签名，代理限流也记在发起者头上。
		const signUserId = Number(userId) || Number(c.get('user')?.userId) || 0;
		if (!content || !signUserId) return content;
		let result = content;
		const matches = content.match(/\{\{domain\}\}attachments\/[^"'\s<>]+/g) || [];
		for (const match of matches) {
			const key = match.replace('{{domain}}', '');
			const signed = await this.signKey(c, key, signUserId);
			result = result.split(match).join(signed);
		}

		// 旧邮件正文里可能已经存了 R2 公开域名，读取时一并换成签名 URL。
		const { r2Domain } = await settingService.query(c);
		const base = domainUtils.toOssDomain(r2Domain);
		if (base) {
			const re = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/attachments/([^"'\\s<>]+)`, 'g');
			const keys = [...result.matchAll(re)].map(m => `attachments/${m[1]}`);
			for (const key of keys) {
				const signed = await this.signKey(c, key, signUserId);
				const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				result = result.replace(new RegExp(`${escaped}/${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), signed);
			}
		}
		// 远程图片改走签名代理，避免收件人 IP/UA 直接暴露给发件人。
		result = await proxyService.signRemoteImages(c, result, signUserId);
		return result;
	},

	async addAtt(c, attachments) {
		if (!attachments?.length) return;

		const written = [];
		try {
			for (let attachment of attachments) {

				const inline = Boolean(attachment.contentId) && !unsafeInline(attachment.filename, attachment.mimeType);
				let metadate = {
					contentType: unsafeInline(attachment.filename, attachment.mimeType) ? 'application/octet-stream' : attachment.mimeType,
					contentDisposition: disposition(attachment.filename, inline)
				}

				if (inline) {
					metadate.cacheControl = `max-age=259200`
				}

				await r2Service.putObj(c, attachment.key, attachment.content, metadate);
				written.push(attachment.key);
			}

			await insertAttRows(c, attachments);
		} catch (e) {
			// 行插入/对象写入失败时，已写入 R2 的附件不能留下孤儿对象；只删没人引用的 key。
			await cleanupOrphanObjects(c, written);
			throw e;
		}
	},

	list(c, params, userId) {
		const { emailId } = params;

		return orm(c).select().from(att).where(
			and(
				eq(att.emailId, emailId),
				eq(att.userId, userId),
				eq(att.type, attConst.type.ATT),
				isNull(att.contentId)
			)
		).all();
	},

	async toImageUrlHtml(c, content) {

		const { r2Domain } = await settingService.query(c);

		const { document } = parseHTML(content);

		const images = Array.from(document.querySelectorAll('img'));

		let imageDataList = [];

		for (const img of images) {

			//邮件正文base64图片转cid附件
			const src = img.getAttribute('src');
			if (src && src.startsWith('data:image')) {
				const file = fileUtils.base64ToFile(src);
				const buff = await file.arrayBuffer();
				const cid = uuidv4().replace(/-/g, '');
				const key = constant.ATTACHMENT_PREFIX + await fileUtils.getBuffHash(buff) + fileUtils.getExtFileName(file.name);

				img.setAttribute('src', 'cid:' + cid);

				const attData = {};
				attData.key = key;
				attData.filename = file.name;
				attData.mimeType = file.type;
				attData.size = file.size;
				attData.buff = buff;
				attData.content = fileUtils.base64ToDataStr(src);
				attData.contentId = cid;

				imageDataList.push(attData);
			}

			//邮件正文站内图片转cid附件
			//r2Domain 留空时图片用 Worker 自身域名（/attachments/…），原来只比对 r2Domain 前缀，
			//空前缀会匹配任何 URL 且 replace('/','') 把 key 弄坏 —— 统一按 /attachments/ 定位 key
			const ossBase = domainUtils.toOssDomain(r2Domain);
			let selfBase = '';
			try {
				selfBase = new URL(c.req.url).origin;
			} catch (e) {
				selfBase = '';
			}
			const attIdx = src ? src.indexOf('attachments/') : -1;
			const isOssImage = attIdx > -1 && (
				src.startsWith('attachments/') ||
				src.startsWith('/attachments/') ||
				(!!ossBase && src.startsWith(ossBase + '/')) ||
				(!ossBase && !!selfBase && src.startsWith(selfBase + '/')) ||
				(!!selfBase && src.startsWith(selfBase + '/attachments/'))
			);

			if (src && isOssImage) {

				const cid = uuidv4().replace(/-/g, '')
				img.setAttribute('src', 'cid:' + cid);

				const attData = {};

				attData.key = src.slice(attIdx).split('?')[0];

				attData.contentId = cid;
				attData.type = attConst.type.EMBED;
				imageDataList.push(attData);

			}

			const hasInlineWidth = img.hasAttribute('width');
			const style = img.getAttribute('style') || '';
			const hasStyleWidth = /(^|\s)width\s*:\s*[^;]+/.test(style);

			if (!hasInlineWidth && !hasStyleWidth) {
				const newStyle = (style ? style.trim().replace(/;$/, '') + '; ' : '') + 'max-width: 100%;';
				img.setAttribute('style', newStyle);
			}
		}

		//查询已有内嵌url图片信息
		const keys = [...new Set(imageDataList.filter(item => !item.content).map(item => item.key))];
		const dbImageList  = await this.selectOneByKeys(c, keys);

		//设置给当前附件
		await Promise.all(imageDataList.map(async image => {
			if (image.content) {
				return;
			}

			const dbImage = dbImageList.find(dbImage => image.key === dbImage.key);
			if (dbImage) {
				image.size = dbImage.size;
				image.filename = dbImage.filename;
				image.mimeType = dbImage.mimeType;
				image.contentType = dbImage.mimeType;
			}

			// 站内图片（/my/uploadImage 传进 R2 的那种）库里还没有附件行，但对象已经在了，
			// 直接按 key 取字节；取不到才算这张图无效
			const obj = await r2Service.getObj(c, image.key);
			if (!obj) {
				return;
			}

			image.content = obj instanceof ArrayBuffer ? obj : await obj.arrayBuffer();
			// 没有附件行时也要补元数据，否则 cid 图片会变成 application/octet-stream
			image.filename = image.filename || image.key.split('/').pop() || 'image';
			image.mimeType = image.mimeType || obj.httpMetadata?.contentType || obj.headers?.get?.('content-type') || 'application/octet-stream';
			image.contentType = image.mimeType;
			image.size = image.size || obj.size || image.content.byteLength;
		}))

		imageDataList = imageDataList.filter(image => image.content);

		return { imageDataList, html: document.toString() };
	},

	async saveSendAtt(c, attList, userId, accountId, emailId) {

		const attDataList = [];

		for (let att of attList) {
			att.buff = fileUtils.base64ToUint8Array(att.content);
			att.key = constant.ATTACHMENT_PREFIX + await fileUtils.getBuffHash(att.buff) + fileUtils.getExtFileName(att.filename);
			// 网页端传的字段名是 contentType，其它调用方传 type，两种都得认（否则 mimeType 落空、R2 也没有 Content-Type）
			att.mime = att.type || att.contentType || 'application/octet-stream';
			const attData = { userId, accountId, emailId };
			attData.key = att.key;
			attData.size = att.buff.length;
			attData.filename = att.filename;
			attData.mimeType = att.mime;
			attData.type = attConst.type.ATT;
			attDataList.push(attData);
		}

		await insertAttRows(c, attDataList);

		for (let att of attList) {
			await r2Service.putObj(c, att.key, att.buff, {
				contentType: unsafeInline(att.filename, att.mime) ? 'application/octet-stream' : att.mime,
				contentDisposition: disposition(att.filename, false)
			});
		}

	},

	async saveArticleAtt(c, attDataList, userId, accountId, emailId) {

		for (let attData of attDataList) {
			attData.userId = userId;
			attData.emailId = emailId;
			attData.accountId = accountId;
			attData.type = attConst.type.EMBED;
			// 站内图片（已经在 R2 里、只有 key 没有 buff）也要落一行附件，否则正文换成 cid: 后没有对应附件，图全挂
			if (!attData.key) {
				continue;
			}
			if (attData.buff) {
				const unsafe = unsafeInline(attData.filename, attData.mimeType);
				await r2Service.putObj(c, attData.key, attData.buff, {
					contentType: unsafe ? 'application/octet-stream' : attData.mimeType,
					cacheControl: `max-age=259200`,
					contentDisposition: disposition(attData.filename, !unsafe)
				});
				delete attData.buff;
			}
		}

		await insertAttRows(c, attDataList);

	},

	async removeByUserIds(c, userIds) {
		await this.removeAttByField(c, 'user_id', userIds);
	},

	async removeByEmailIds(c, emailIds) {
		await this.removeAttByField(c, 'email_id', emailIds);
	},

	selectByEmailIds(c, emailIds) {
		return orm(c).select().from(att).where(
			and(
				inArray(att.emailId, emailIds),
				eq(att.type, attConst.type.ATT)
			))
			.all();
	},

	async removeAttByField(c, fieldName, fieldValues) {

		if (!['user_id', 'email_id', 'account_id'].includes(fieldName)) {
			throw new Error(`unsupported attachment field: ${fieldName}`);
		}

		const values = [...new Set(fieldValues)];
		const delKeyList = [];

		for (let i = 0; i < values.length; i += ATT_DELETE_CHUNK) {
			const chunk = values.slice(i, i + ATT_DELETE_CHUNK);
			const placeholders = chunk.map(() => '?').join(',');
			// 共享 key 的附件不能删 R2 对象；GROUP BY 只对当前 50 个 id 聚合，避免逐 id 全表扫描。
			const selectSql = `SELECT a.key
				FROM attachments a
				JOIN (SELECT key FROM attachments GROUP BY key HAVING COUNT(*) = 1) t ON a.key = t.key
				WHERE a.${fieldName} IN (${placeholders})`;
			const deleteSql = `DELETE FROM attachments WHERE ${fieldName} IN (${placeholders})`;
			const [selected] = await c.env.db.batch([
				c.env.db.prepare(selectSql).bind(...chunk),
				c.env.db.prepare(deleteSql).bind(...chunk)
			]);
			delKeyList.push(...(selected?.results || []).map(row => row.key).filter(Boolean));
		}

		if (delKeyList.length > 0) {
			try {
				await this.batchDelete(c, delKeyList);
			} catch (e) {
				console.error('删除附件文件失败：', e);
			}
		}

	},

	async batchDelete(c, keys) {
		if (!keys.length) return;

		const BATCH_SIZE = 1000;

		for (let i = 0; i < keys.length; i += BATCH_SIZE) {
			const batch = keys.slice(i, i + BATCH_SIZE);
			await r2Service.delete(c, batch);
		}

	},

	async removeByAccountId(c, accountId) {
		await this.removeAttByField(c, "account_id", [accountId])
	},

	selectOneByKeys(c, keys) {
		if (!keys || keys.length === 0) {
			return []
		}
		return orm(c).select().from(att).where(inArray(att.key, keys)).orderBy(desc(att.attId)).groupBy(att.key).all();
	}
};

export default attService;

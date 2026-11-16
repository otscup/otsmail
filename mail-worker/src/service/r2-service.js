import s3Service from './s3-service';
import settingService from './setting-service';
import kvObjService from './kv-obj-service';

function unsafeInline(key, mime) {
	const ext = String(key || '').split('.').pop().toLowerCase();
	return ['html', 'htm', 'xhtml', 'svg', 'svgz', 'xml'].includes(ext)
		|| /^(text\/html|application\/xhtml\+xml|image\/svg\+xml)/i.test(mime || '');
}

// 允许浏览器内联展示的类型：上传时统一写的是 attachment，PDF 在 iframe 里会被 Chrome
// 当成下载而弹出"已被屏蔽"。只有前端明确带 preview=1 的预览请求才改成 inline。
const PREVIEW_INLINE_EXT = ['pdf', 'txt', 'text', 'json', 'log', 'xml', 'yml', 'yaml', 'ini', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

function canInlinePreview(key) {
	const ext = String(key || '').split('.').pop().toLowerCase();
	return PREVIEW_INLINE_EXT.includes(ext);
}

const r2Service = {

	async storageType(c) {

		const setting = await settingService.query(c);
		const { bucket, endpoint, s3AccessKey, s3SecretKey } = setting;

		if (!!(bucket && endpoint && s3AccessKey && s3SecretKey)) {
			return 'S3';
		}

		if (c.env.r2) {
			return 'R2';
		}

		return 'KV';
	},

	async putObj(c, key, content, metadata) {

		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			await kvObjService.putObj(c, key, content, metadata);
		}

		if (storageType === 'R2') {
			await c.env.r2.put(key, content, {
				httpMetadata: { ...metadata }
			});
		}

		if (storageType === 'S3') {
			await s3Service.putObj(c, key, content, metadata);
		}

	},

	async getObj(c, key) {
		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			return await kvObjService.getObj(c, key);
		}

		if (storageType === 'R2') {
			return await c.env.r2.get(key);
		}

		if (storageType === 'S3') {
			return await s3Service.getObj(c, key);
		}
	},

	// /attachments/** 的公开读取：旧对象可能仍是 text/html + inline，按扩展名强制下载
	safeResponse(obj, key, previewInline = false) {
		const headers = new Headers(obj.headers);
		const unsafe = unsafeInline(key, headers.get('Content-Type'));
		if (unsafe) {
			headers.set('Content-Type', 'application/octet-stream');
			headers.set('Content-Disposition', 'attachment');
		} else if (previewInline && canInlinePreview(key)) {
			const disposition = headers.get('Content-Disposition') || '';
			headers.set('Content-Disposition', disposition.replace(/^attachment/i, 'inline') || 'inline');
		}
		if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'public, max-age=2592000');
		return new Response(obj.body, { status: obj.status, headers });
	},

	async publicObjResp(c, key, options = {}) {
		const previewInline = options.previewInline === true;
		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			const obj = await kvObjService.getObj(c, key);
			return obj ? this.safeResponse(obj, key, previewInline) : new Response('Not Found', { status: 404 });
		}

		const obj = storageType === 'S3' ? await s3Service.getObj(c, key) : await c.env.r2.get(key);
		if (!obj) {
			return new Response('Not Found', { status: 404 });
		}

		if (obj instanceof Response) {
			return this.safeResponse(obj, key, previewInline);
		}

		const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
		const isUnsafe = unsafeInline(key, contentType);
		const attachmentDisposition = isUnsafe
			? 'attachment'
			: (obj.httpMetadata?.contentDisposition || 'inline');
		const headers = new Headers({
			'Content-Type': isUnsafe ? 'application/octet-stream' : contentType,
			'Content-Disposition': previewInline && canInlinePreview(key) && !isUnsafe
				? attachmentDisposition.replace(/^attachment/i, 'inline')
				: attachmentDisposition,
			'Cache-Control': 'public, max-age=2592000'
		});
		return new Response(obj.body || obj, { headers });
	},

	async delete(c, key) {

		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			await kvObjService.deleteObj(c, key);
		}

		if (storageType === 'R2') {
			await c.env.r2.delete(key);
		}

		if (storageType === 'S3'){
			await s3Service.deleteObj(c, key);
		}

	}

};
export default r2Service;

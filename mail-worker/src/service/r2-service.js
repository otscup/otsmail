import s3Service from './s3-service';
import settingService from './setting-service';
import kvObjService from './kv-obj-service';

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

	// /attachments/** 的公开读取：之前只查 KV，R2 / S3 存储下（含 r2Domain 留空、用本站域名）一律 500
	async publicObjResp(c, key) {
		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			return (await kvObjService.getObj(c, key)) || new Response('Not Found', { status: 404 });
		}

		const obj = storageType === 'S3' ? await s3Service.getObj(c, key) : await c.env.r2.get(key);
		if (!obj) {
			return new Response('Not Found', { status: 404 });
		}

		// KV/S3 的 getObj 已经返回 Response；直接透传，避免 S3 图片丢掉 Content-Type
		if (obj instanceof Response) {
			const headers = new Headers(obj.headers);
			if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'public, max-age=2592000');
			return new Response(obj.body, { status: obj.status, headers });
		}

		return new Response(obj.body || obj, {
			headers: {
				'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
				'Cache-Control': 'public, max-age=2592000'
			}
		});
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

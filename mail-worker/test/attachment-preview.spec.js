import { describe, it, expect, vi, afterEach } from 'vitest';
import r2Service from '../src/service/r2-service';

function fakeContext(object) {
	return { env: { r2: { get: async () => object } } };
}

const pdfObject = {
	httpMetadata: { contentType: 'application/pdf', contentDisposition: 'attachment; filename="a.pdf"' },
	body: 'pdf-bytes'
};

function stubStorage() {
	vi.spyOn(r2Service, 'storageType').mockResolvedValue('R2');
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('附件预览响应头', () => {
	it('普通下载保持 attachment', async () => {
		stubStorage();
		const res = await r2Service.publicObjResp(fakeContext(pdfObject), 'attachments/a.pdf');
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		expect(res.headers.get('Content-Disposition')).toMatch(/^attachment/);
	});

	it('preview=1 时 PDF 改为 inline，Content-Type 不变', async () => {
		stubStorage();
		const res = await r2Service.publicObjResp(fakeContext(pdfObject), 'attachments/a.pdf', { previewInline: true });
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		expect(res.headers.get('Content-Disposition')).toMatch(/^inline/);
	});

	it('preview=1 也不能把 html/svg 变成内联', async () => {
		stubStorage();
		const object = {
			httpMetadata: { contentType: 'text/html', contentDisposition: 'inline; filename="x.html"' },
			body: '<script>alert(1)</script>'
		};
		const res = await r2Service.publicObjResp(fakeContext(object), 'attachments/x.html', { previewInline: true });
		expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
		expect(res.headers.get('Content-Disposition')).toBe('attachment');
	});

	it('preview=1 对不在白名单里的类型不生效', async () => {
		stubStorage();
		const object = {
			httpMetadata: { contentType: 'application/zip', contentDisposition: 'attachment; filename="a.zip"' },
			body: 'zip'
		};
		const res = await r2Service.publicObjResp(fakeContext(object), 'attachments/a.zip', { previewInline: true });
		expect(res.headers.get('Content-Disposition')).toMatch(/^attachment/);
	});
});

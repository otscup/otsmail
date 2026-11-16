import fileUtils from '../../utils/file-utils';

/**
 * 统一把 sendParams.attachments 转成 base64 附件：
 * 调用方（att 行 / 内嵌图片）的附件结构保持不变，各渠道适配器按自己的字段名再映射。
 * 复用 email-service 原有 toAttachmentBase64 的思路：data URL 去前缀、字符串去空白、二进制转 base64。
 */
export async function toBase64Attachments(attachments = []) {
	const result = [];

	for (const attachment of attachments || []) {
		const content = await toBase64(attachment);
		if (!content) continue;

		result.push({
			filename: attachment.filename || attachment.name || 'attachment',
			content,
			contentType: attachment.contentType || attachment.mimeType || attachment.type || 'application/octet-stream',
			contentId: normalizeContentId(attachment.contentId)
		});
	}

	return result;
}

export function normalizeContentId(value) {
	return String(value || '').replace(/^<|>$/g, '');
}

async function toBase64(attachment) {
	let content = attachment?.content;

	if (!content) return null;

	if (typeof content === 'string') {
		if (content.startsWith('data:')) {
			content = content.split(',')[1] || content;
		}
		return content.replace(/\s+/g, '');
	}

	const arrayBuffer = await toArrayBuffer(content);
	if (!arrayBuffer) return null;

	const bytes = new Uint8Array(arrayBuffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

async function toArrayBuffer(content) {
	if (content instanceof ArrayBuffer) return content;
	if (content instanceof Uint8Array) {
		return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
	}
	if (typeof content === 'string') {
		if (content.startsWith('data:')) content = content.split(',')[1] || content;
		return fileUtils.base64ToUint8Array(content.replace(/\s+/g, '')).buffer;
	}
	return content;
}

export default { toBase64Attachments, normalizeContentId };

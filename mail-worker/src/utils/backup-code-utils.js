// 备用码纯函数：生成 / 归一化 / 哈希 / 展示格式
// 字母表刻意去掉 I/O/0/1，避免用户抄写与辨认歧义；32 个字符 × 10 位 ≈ 50 bit 熵。
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_COUNT = 10;
const DEFAULT_LENGTH = 10;
const encoder = new TextEncoder();

function randomString(length) {
	let output = '';
	// 拒绝采样：只接受 < limit 的字节，避免 % 取模带来的分布偏置
	const limit = 256 - (256 % ALPHABET.length);
	const buffer = new Uint8Array(Math.max(32, length * 2));
	while (output.length < length) {
		crypto.getRandomValues(buffer);
		for (const byte of buffer) {
			if (output.length >= length) break;
			if (byte < limit) output += ALPHABET[byte % ALPHABET.length];
		}
	}
	return output;
}

const backupCodeUtils = {
	ALPHABET,
	COUNT: DEFAULT_COUNT,
	LENGTH: DEFAULT_LENGTH,

	generate(count = DEFAULT_COUNT, length = DEFAULT_LENGTH) {
		const codes = new Set();
		while (codes.size < count) {
			codes.add(randomString(length));
		}
		return [...codes];
	},

	// 去空格/连字符并转大写；长度或字符集不对时由调用方判为无效
	normalize(code) {
		return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
	},

	async hash(userId, code) {
		const data = encoder.encode(`${userId}:${this.normalize(code)}`);
		const digest = await crypto.subtle.digest('SHA-256', data);
		return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
	},

	// 展示用：XXXXX-XXXXX（10 位）
	format(code) {
		const normalized = this.normalize(code);
		if (normalized.length !== DEFAULT_LENGTH) return normalized;
		return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
	}
};

export default backupCodeUtils;

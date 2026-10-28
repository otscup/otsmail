// TOTP（RFC 6238，HMAC-SHA1 / 6 位 / 30 秒）
// 手写而不是引依赖：整个实现只有一个 HMAC + 一个 base32 解码，WebCrypto 就够。
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD = 30;

function base32Encode(bytes) {
	let bits = 0;
	let value = 0;
	let output = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += BASE32[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) {
		output += BASE32[(value << (5 - bits)) & 31];
	}
	return output;
}

function base32Decode(str) {
	const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
	const bytes = new Uint8Array(Math.floor(clean.length * 5 / 8));
	let bits = 0;
	let value = 0;
	let index = 0;
	for (const char of clean) {
		value = (value << 5) | BASE32.indexOf(char);
		bits += 5;
		if (bits >= 8) {
			bytes[index++] = (value >>> (bits - 8)) & 0xff;
			bits -= 8;
		}
	}
	return bytes;
}

const totpUtils = {

	// 160bit 随机密钥，base32 展示（认证器 App 通用格式）
	randomSecret() {
		return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
	},

	async code(secret, counter) {
		const key = await crypto.subtle.importKey('raw', base32Decode(secret),
			{ name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
		const message = new Uint8Array(8);
		new DataView(message.buffer).setUint32(4, counter);
		const sign = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
		const offset = sign[sign.length - 1] & 0x0f;
		const bin = ((sign[offset] & 0x7f) << 24) | ((sign[offset + 1] & 0xff) << 16)
			| ((sign[offset + 2] & 0xff) << 8) | (sign[offset + 3] & 0xff);
		return String(bin % 1000000).padStart(6, '0');
	},

	// 容忍前后各一个时间窗（客户端时钟偏差 / 用户手慢）
	async verify(secret, code, window = 1) {
		if (!secret || !/^\d{6}$/.test(String(code || '').trim())) {
			return false;
		}
		const counter = Math.floor(Date.now() / 1000 / PERIOD);
		const input = String(code).trim();
		for (let i = -window; i <= window; i++) {
			if (await this.code(secret, counter + i) === input) {
				return true;
			}
		}
		return false;
	},

	otpauthUrl(secret, account) {
		const label = encodeURIComponent('otsmail:' + account);
		const params = new URLSearchParams({
			secret,
			issuer: 'otsmail',
			algorithm: 'SHA1',
			digits: '6',
			period: String(PERIOD)
		});
		return `otpauth://totp/${label}?${params.toString()}`;
	}
};

export default totpUtils;

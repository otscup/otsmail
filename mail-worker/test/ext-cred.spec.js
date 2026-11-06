import { describe, it, expect } from 'vitest';
import { sealSecret, openSecret } from '../src/service/ext-account-service';

const KEY = Buffer.from('x'.repeat(32)).toString('base64');

describe('ext 凭据加解密', () => {
	it('往返后拿到原文', async () => {
		const sealed = await sealSecret({ EXT_CRED_KEY: KEY }, 'p@ss-授权码', '1:2:gmail');
		expect(sealed.split('.')[0]).toBe('v1');
		await expect(openSecret({ EXT_CRED_KEY: KEY }, sealed, '1:2:gmail')).resolves.toBe('p@ss-授权码');
	});

	it('每条密文 IV 不同', async () => {
		const a = await sealSecret({ EXT_CRED_KEY: KEY }, 'same', '1:2:gmail');
		const b = await sealSecret({ EXT_CRED_KEY: KEY }, 'same', '1:2:gmail');
		expect(a).not.toBe(b);
	});

	it('AAD 不匹配时拒绝解密（防跨账号搬运）', async () => {
		const sealed = await sealSecret({ EXT_CRED_KEY: KEY }, 'secret', '1:2:gmail');
		await expect(openSecret({ EXT_CRED_KEY: KEY }, sealed, '1:3:gmail')).rejects.toThrow();
	});

	it('密钥缺失时拒绝写入而不是降级明文', async () => {
		await expect(sealSecret({}, 'secret', '1:2:gmail')).rejects.toMatchObject({ code: 503 });
	});

	it('密钥长度不对时拒绝', async () => {
		await expect(sealSecret({ EXT_CRED_KEY: 'c2hvcnQ=' }, 'secret', '1:2:gmail')).rejects.toMatchObject({ code: 503 });
	});
});

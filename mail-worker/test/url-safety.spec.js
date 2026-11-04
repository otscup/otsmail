import {describe, expect, it} from 'vitest';
import {isPrivateUrl} from '../src/utils/url-safety';

describe('url safety', () => {
	it('blocks obvious loopback and private addresses', () => {
		for (const url of ['http://localhost:8787', 'http://127.0.0.1', 'http://10.1.2.3', 'http://192.168.1.8', 'http://172.20.1.2', 'http://[::1]']) {
			expect(isPrivateUrl(url)).toBe(true);
		}
	});

	it('allows public https endpoints', () => {
		expect(isPrivateUrl('https://api.openai.com/v1')).toBe(false);
		expect(isPrivateUrl('https://hooks.example.com/mail')).toBe(false);
	});
});

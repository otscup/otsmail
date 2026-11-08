import {describe, expect, it} from 'vitest';
import {isPrivateUrl} from '../src/utils/url-safety';

describe('url safety', () => {
	it('blocks obvious loopback and private addresses', () => {
		for (const url of ['http://localhost:8787', 'http://127.0.0.1', 'http://10.1.2.3', 'http://192.168.1.8', 'http://172.20.1.2', 'http://[::1]']) {
			expect(isPrivateUrl(url)).toBe(true);
		}
	});

	it('blocks carrier-grade NAT, link-local, reserved and IPv4-mapped addresses', () => {
		for (const url of [
			'http://100.64.0.1',
			'http://169.254.169.254/latest/meta-data',
			'http://198.18.0.1',
			'http://224.0.0.1',
			'http://0.0.0.0',
			'http://[::ffff:127.0.0.1]',
			'http://[fd00::1]',
			'http://[fe80::1]',
			'http://metadata.google.internal'
		]) {
			expect(isPrivateUrl(url)).toBe(true);
		}
	});

	it('rejects non-http protocols', () => {
		expect(isPrivateUrl('file:///etc/passwd')).toBe(true);
		expect(isPrivateUrl('gopher://example.com')).toBe(true);
	});

	it('allows public https endpoints', () => {
		expect(isPrivateUrl('https://api.openai.com/v1')).toBe(false);
		expect(isPrivateUrl('https://hooks.example.com/mail')).toBe(false);
		expect(isPrivateUrl('https://100.example.com')).toBe(false);
	});
});

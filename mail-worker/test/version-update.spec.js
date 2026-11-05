import { describe, expect, it } from 'vitest';
import { compareVersion, isNewer } from '../src/service/version-service';

describe('version comparison', () => {
	it('orders patch, minor and major versions', () => {
		expect(compareVersion('0.1.94', '0.1.93')).toBe(1);
		expect(compareVersion('0.2.0', '0.1.99')).toBe(1);
		expect(compareVersion('1.0.0', '0.9.9')).toBe(1);
		expect(compareVersion('0.1.94', '0.1.94')).toBe(0);
	});

	it('treats stable as newer than prerelease', () => {
		expect(isNewer('0.1.94', '0.1.94-beta.1')).toBe(true);
		expect(isNewer('0.1.94-beta.2', '0.1.94-beta.1')).toBe(true);
	});

	it('strips web-v prefix and never reports invalid input as newer', () => {
		expect(isNewer('web-v0.1.94', '0.1.93')).toBe(true);
		expect(isNewer('not-a-version', '0.1.93')).toBe(false);
	});
});

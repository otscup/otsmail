import {describe, expect, it} from 'vitest';
import {pathMatches} from '../src/security/security';

describe('security path matching', () => {
	it('matches exact path and child segments', () => {
		expect(pathMatches('/email/send', '/email/send')).toBe(true);
		expect(pathMatches('/email/send/extra', '/email/send')).toBe(true);
		expect(pathMatches('/mcp', '/mcp')).toBe(true);
	});

	it('does not let a sibling route borrow a permission by prefix', () => {
		expect(pathMatches('/email/sendxxx', '/email/send')).toBe(false);
		expect(pathMatches('/email/deleteAll', '/email/delete')).toBe(false);
		expect(pathMatches('/mcpx', '/mcp')).toBe(false);
		expect(pathMatches('/publicity', '/public')).toBe(false);
	});

	it('does not match unrelated paths', () => {
		expect(pathMatches('/email/list', '/email/send')).toBe(false);
		expect(pathMatches('/', '/email')).toBe(false);
	});
});

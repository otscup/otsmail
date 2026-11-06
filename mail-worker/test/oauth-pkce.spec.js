import { describe, expect, it } from 'vitest';
import { appendCodeVerifier } from '../src/service/oauth-service';

describe('OAuth PKCE verifier forwarding', () => {
	it('forwards a client code_verifier unchanged', () => {
		const params = new URLSearchParams();
		appendCodeVerifier(params, 'client-verifier_123');
		expect(params.get('code_verifier')).toBe('client-verifier_123');
	});

	it('keeps old clients non-PKCE when verifier is absent', () => {
		const params = new URLSearchParams();
		appendCodeVerifier(params, undefined);
		expect(params.has('code_verifier')).toBe(false);
	});
});

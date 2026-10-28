// OIDC PKCE：部分 IdP 强制要求；verifier 只存当前标签页，回调后立即删除
const KEY = 'otsmail.pkce.'

function base64url(bytes) {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createPkce(state) {
	const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
	sessionStorage.setItem(KEY + state, verifier)
	return {verifier, challenge: base64url(new Uint8Array(digest))}
}

export function takePkce(state) {
	const verifier = sessionStorage.getItem(KEY + state) || ''
	sessionStorage.removeItem(KEY + state)
	return verifier
}

import http from '@/axios/index.js'

export function versionInfo() {
	return http.get('/version', { noMsg: true })
}

export function versionLatest() {
	return http.get('/version/latest', { noMsg: true })
}

export function versionCheck() {
	return http.get('/update/check', { noMsg: true })
}

import http from '@/axios/index.js';

export function mcpStatus() {
    return http.get('/mcp/status')
}

export function tokenList() {
    return http.get('/mcp/token/list')
}

export function tokenCreate(form) {
    return http.post('/mcp/token/create', form)
}

export function tokenRevoke(tokenId) {
    return http.post('/mcp/token/revoke', {tokenId})
}

export function clientList() {
    return http.get('/mcp/client/list')
}

export function clientCreate(form) {
    return http.post('/mcp/client/create', form)
}

export function clientRevoke(clientId) {
    return http.post('/mcp/client/revoke', {clientId})
}

import http from '@/axios/index.js';

export function settingSet(setting) {
    return http.put('/setting/set', setting)
}

export function settingQuery() {
    return http.get('/setting/query')
}

export function websiteConfig() {
    return http.get('/setting/websiteConfig')
}

export function setBackground(background, target = 'background') {
    return http.put('/setting/setBackground',{[target]: background, target})
}

export function deleteBackground(target = 'background') {
    return http.delete('/setting/deleteBackground', {params: {target}})
}

export function setBlackList(params) {
    return http.put('/setting/setBlacklist', params)
}

export function webhookTest(params) {
    return http.post('/setting/webhookTest', params)
}

export function aiModels(params) {
    return http.post('/setting/aiModels', params)
}

export function tgWebhook(params) {
    return http.post('/setting/tgWebhook', params)
}
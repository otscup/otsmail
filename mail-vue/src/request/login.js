import http from '@/axios/index.js';

export function login(email, password, twoFactorCode) {
    return http.post('/login', {email, password, twoFactorCode})
}

export function logout() {
    // noMsg: 退出流程已经做了本地清理，接口失败不该再弹错误打扰用户
    return http.delete('/logout', {noMsg: true})
}

export function register(form) {
    return http.post('/register', form)
}

export function qrCreate() {
    return http.post('/login/qr')
}

export function qrPoll(id) {
    return http.get(`/login/qr/${id}`, {noMsg: true})
}

export function qrConfirm(id) {
    return http.post('/my/qr/confirm', {id})
}

export function sendPasswordResetCode(email) {
    return http.post('/password/reset/send-code', { email })
}

export function confirmPasswordReset(email, code, newPassword) {
    return http.post('/password/reset/confirm', { email, code, newPassword })
}
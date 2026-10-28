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
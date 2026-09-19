import http from '@/axios/index.js';

export function oauthLinuxDoLogin(code, state) {
    return http.post('/oauth/linuxDo/login',{code, state})
}

export function oauthGithubLogin(code, state) {
    return http.post('/oauth/github/login',{code, state})
}

export function oauthGoogleLogin(code, state) {
    return http.post('/oauth/google/login',{code, state})
}

export function oauthBindUser(form) {
    return http.put('/oauth/bindUser', form)
}

// v1.3 登录态绑定（大网站模式）：已登录用户把当前 OAuth 授权绑到自己的站内账号
export function oauthBind(form) {
    return http.put('/oauth/bind', form)
}

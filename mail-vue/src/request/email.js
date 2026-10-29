import http from '@/axios/index.js';

export function emailList(accountId, allReceive, emailId, timeSort, size, type, search = {}, mailbox, category, page) {
    const {text, type: searchType, startDate, endDate} = search
    return http.get('/email/list', {
        params: {accountId, allReceive, emailId, timeSort, size, type, text, searchType, startDate, endDate, mailbox, category, page}
    })
}

export function emailDelete(emailIds) {
    return http.delete('/email/delete?emailIds=' + emailIds)
}

export function emailLatest(emailId, accountId, allReceive) {
    return http.get('/email/latest', {params: {emailId, accountId, allReceive}, noMsg: true, timeout: 35 * 1000})
}

export function emailRead(emailIds) {
    return http.put('/email/read', {emailIds})
}

export function emailUnread(emailIds) {
    return http.put('/email/unread', {emailIds})
}

export function emailMoveCategory(emailIds, category) {
    return http.put('/email/category', {emailIds, category})
}

export function emailCategoryCounts() {
    return http.get('/email/category-counts')
}

export function emailMenuCounts() {
    return http.get('/email/menu-counts')
}

// 菜单 + 分类一次请求，短缓存合并侧边栏和列表的同时刷新
let countsCache = null, countsAt = 0, countsTask = null;
export function emailCounts(force = false) {
    if (countsTask) return countsTask;
    if (!force && countsCache && Date.now() - countsAt < 5000) return Promise.resolve(countsCache);
    countsTask = http.get('/email/counts')
        .then(data => { countsCache = data; countsAt = Date.now(); return data; })
        .finally(() => { countsTask = null; });
    return countsTask;
}

// v1.0: GET /email/detail?emailId= —— 单封详情（含 attList），T-02 刷新兜底重取
export function emailDetail(emailId) {
    return http.get('/email/detail', {params: {emailId}})
}

// 垃圾邮件标记 / 取消（POST body：{emailId}）
export function emailSpam(emailId) {
    return http.post('/email/spam', {emailId})
}

export function emailSpamCancel(emailId) {
    return http.post('/email/spamCancel', {emailId})
}

// 从已删除恢复
export function emailRestore(emailId) {
    return http.post('/email/restore', {emailId})
}

// 回收站里彻底删除（syncDelete 关闭时 /email/delete 只会重新打删除标记）
export function emailPhysicsDelete(emailId) {
    return http.delete('/email/physicsDelete?emailId=' + emailId)
}

export function emailSend(form,progress) {
    return http.post('/email/send', form,{
        onUploadProgress: (e) => {
            progress(e)
        },
        noMsg: true
    })
}
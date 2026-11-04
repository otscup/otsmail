import http from '@/axios/index.js';

export function emailList(accountId, allReceive, emailId, timeSort, size, type, search = {}, mailbox, category, page, status) {
    const {text, type: searchType, startDate, endDate} = search
    return http.get('/email/list', {
        params: {accountId, allReceive, emailId, timeSort, size, type, text, searchType, startDate, endDate, mailbox, category, page, status}
    })
}

export function emailRetry(emailId) {
    return http.post('/email/retry', {emailId})
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
const countsCache = new Map();
const countsTask = new Map();
export function emailCounts(force = false, accountId = null, allReceive = true) {
    const key = `${accountId || 0}:${allReceive ? 1 : 0}`;
    if (countsTask.has(key)) return countsTask.get(key);
    const cached = countsCache.get(key);
    if (!force && cached && Date.now() - cached.at < 5000) return Promise.resolve(cached.data);
    const task = http.get('/email/counts', {params: {accountId, allReceive: allReceive ? 1 : 0}})
        .then(data => { countsCache.set(key, {data, at: Date.now()}); return data; })
        .finally(() => { countsTask.delete(key); });
    countsTask.set(key, task);
    return task;
}

// v1.0: GET /email/detail?emailId= —— 单封详情（含 attList），T-02 刷新兜底重取
export function emailDetail(emailId) {
    return http.get('/email/detail', {params: {emailId}})
}

export function unsubscribeList() {
    return http.get('/email/unsubscribeList')
}

export function emailLearn(emailId, category, keyword = '') {
    return http.post('/email/learn', {emailId, category, keyword})
}

export function emailSchedule(form, scheduledAt) {
    return http.post('/email/schedule', {...form, scheduledAt})
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
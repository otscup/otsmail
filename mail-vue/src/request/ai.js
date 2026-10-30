import http from "@/axios/index.js";

export function aiReply(emailId, tone) {
    return http.post('/ai/reply', {emailId, tone})
}

export function aiSummary(emailId, lang) {
    return http.post('/ai/summary', {emailId, lang})
}

export function aiPolish(text, lang) {
    return http.post('/ai/polish', {text, lang})
}

export function aiCommand(text, accountId, history = [], replyEmailId = 0) {
    return http.post('/ai/command', {text, accountId, history, replyEmailId})
}

export function aiClassify() {
    return http.post('/ai/classify', {})
}

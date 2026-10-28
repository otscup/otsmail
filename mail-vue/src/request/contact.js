import http from '@/axios/index.js';

export function contactList(q, group) {
    return http.get('/contact/list', {params: {q, group}})
}

export function contactAdd(form) {
    return http.post('/contact/add', form)
}

export function contactSet(form) {
    return http.post('/contact/set', form)
}

export function contactDelete(contactId) {
    return http.post('/contact/delete', {contactId})
}

import { defineStore } from 'pinia'
import { EmailUnreadEnum } from '@/enums/email-enum'

export const useEmailStore = defineStore('email', {
    state: () => ({
        deleteIds: 0,
        starScroll: null,
        emailScroll: null,
        cancelStarEmailId: 0,
        addStarEmailId: 0,
        contentData: {
            email: null,
            delType: null,
            showStar: true,
            showReply: true,
            showUnread: false
        },
        sendScroll: null,
        // 邮件列表搜索条件，email-search 组件直接读写
        searchParams: {
            text: '',
            type: 'all',
            startDate: '',
            endDate: '',
        },
    }),
    persist: {
        pick: ['contentData'],
    },
    getters: {
        // 有生效的搜索条件时，列表不再自动追加最新邮件
        hasSearch: (state) =>
            !!(state.searchParams.text || state.searchParams.startDate || state.searchParams.endDate),
    },
    actions: {
        setSearchParams(params) {
            this.searchParams = params
        },
        // 标记某封邮件在列表中为已读（修复：详情页标已读后，列表未读点不同步）
        markListRead(emailId) {
            const scroll = this.emailScroll
            const list = scroll?.emailList
            if (!list?.length) return
            const item = list.find(e => e.emailId === emailId)
            if (item) item.unread = EmailUnreadEnum.READ
        },
    },
})

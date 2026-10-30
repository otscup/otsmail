import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', {
    state: () => ({
        domainList: [],
        settings: {
            r2Domain: '',
            loginOpacity: 1.00,
        },
        lang: '',
        showAvatars: (typeof localStorage === 'undefined' || localStorage.getItem('ots_show_avatars') !== '0'),
    }),
    actions: {
        setShowAvatars(value) {
            this.showAvatars = !!value
            if (typeof localStorage !== 'undefined') localStorage.setItem('ots_show_avatars', value ? '1' : '0')
        },
    },
    persist: {
        pick: ['lang'],
    },
})

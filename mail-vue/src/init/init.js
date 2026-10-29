import {useUserStore} from "@/store/user.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import router from "@/router";
import {websiteConfig} from "@/request/setting.js";
import i18n from "@/i18n/index.js";
import {getToken} from "@/utils/token-store.js";

export async function init() {
    document.title = '\u200B'

    const settingStore = useSettingStore();
    const userStore = useUserStore();
    const accountStore = useAccountStore();

    const token = getToken();
    if (!settingStore.lang) {
        let lang = navigator.language.split('-')[0]
        lang = lang === 'zh' ? lang : 'en'
        settingStore.lang = lang
    }

    i18n.global.locale.value = settingStore.lang

    let setting = null;

    if (token) {
        const userPromise = loginUserInfo().catch(e => {
            console.error(e);
            return null;
        });

        const [s, user] = await Promise.all([loadSetting(), userPromise]);
        setting = s;

        if (user) {
            accountStore.currentAccountId = user.account.accountId;
            accountStore.currentAccount = user.account;
            userStore.user = user;

            const routers = permsToRouter(user.permKeys);
            routers.forEach(routerData => {
                router.addRoute('layout', routerData);
            });
        }

    } else {
        setting = await loadSetting();
    }
}

// 站点配置拉不到时不能让它把 init 抛穿 —— 那样 main.js 的 await init() 失败，整页白屏（只剩零宽标题）
function loadSetting() {
    return websiteConfig().catch(e => {
        console.error('站点配置加载失败', e);
        return null;
    }).then(setting => {
        if (setting) {
            const settingStore = useSettingStore();
            settingStore.settings = setting;
            settingStore.domainList = setting.domainList;
            document.title = setting.title;
        }
        return setting;
    });
}

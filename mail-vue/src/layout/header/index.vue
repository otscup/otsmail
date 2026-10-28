<template>
  <div class="header" :class="!hasPerm('email:send') ? 'not-send' : ''">
    <div class="header-btn">
      <hanburger @click="changeAside"></hanburger>
      <EmailSearch v-if="showMailSearch"
                   class="header-mail-search"
                   :store="emailStore"
                   :search-options="searchOptions"
                   @search="refreshMailList"
                   @reset="refreshMailList"/>
      <span v-else class="breadcrumb-item">{{ $t(route.meta.title) }}</span>
    </div>
    <div class="toolbar">
      <button v-perm="'email:send'" type="button" class="writer-box" @click="openSend">
        <Icon icon="material-symbols:edit-outline-sharp" width="18" height="18"/>
        <span class="writer-text">{{ $t('compose') }}</span>
      </button>
      <div v-if="uiStore.dark" class="sun-icon icon-item" @click="openDark($event)">
        <Icon icon="mingcute:sun-fill"/>
      </div>
      <div v-else class="dark-icon icon-item" @click="openDark($event)">
        <Icon icon="solar:moon-linear"/>
      </div>
      <div class="notice icon-item" @click="openNotice">
        <Icon icon="streamline-plump:announcement-megaphone"/>
      </div>
      <div v-perm="'ai:use'" class="header-ai">
        <aiAssistant ref="aiAssistantRef" inline/>
      </div>
      <el-dropdown ref="userinfoRef" @visible-change="e => userInfoShow = e" :teleported="false" popper-class="detail-dropdown">
        <div class="avatar" @click="userInfoHide" >
          <div class="avatar-text">
            <img v-if="userStore.user.avatar" :src="userStore.user.avatar" alt=""/>
            <div v-else>{{ formatName(userStore.user.email) }}</div>
          </div>
          <Icon class="setting-icon" icon="mingcute:down-small-fill" width="24" height="24"/>
        </div>
        <template #dropdown>
          <div class="user-details">
            <div class="details-avatar">
              <img v-if="userStore.user.avatar" :src="userStore.user.avatar" alt=""/>
              <template v-else>{{ formatName(userStore.user.email) }}</template>
            </div>
            <div class="user-name">
              {{ userStore.user.name }}
            </div>
            <div class="detail-email" @click="copyEmail(userStore.user.email)">
              {{ userStore.user.email }}
            </div>
            <div class="detail-user-type">
              <el-tag>{{ userStore.user.role.name }}</el-tag>
            </div>

            <div class="action-info">
              <div>
                <span style="margin-right: 10px">{{ $t('sendCount') }}</span>
                <span style="margin-right: 10px">{{ $t('accountCount') }}</span>
              </div>
              <div>
                <div>
                  <span v-if="sendCount" style="margin-right: 5px">{{ sendCount }}</span>
                  <el-tag v-if="!hasPerm('email:send')">{{ sendType }}</el-tag>
                  <el-tag v-else>{{ sendType }}</el-tag>
                </div>
                <div>
                  <el-tag v-if="settingStore.settings.manyEmail || settingStore.settings.addEmail">
                    {{ $t('disabled') }}
                  </el-tag>
                  <span v-else-if="accountCount && hasPerm('account:add')"
                        style="margin-right: 5px">{{ $t('totalUserAccount', {msg: accountCount}) }}</span>
                  <el-tag v-else-if="!accountCount && hasPerm('account:add')">{{ $t('unlimited') }}</el-tag>
                  <el-tag v-else-if="!hasPerm('account:add')">{{ $t('unauthorized') }}</el-tag>
                </div>
              </div>
            </div>
            <div class="logout">
              <el-button v-if="hasPerm('ai:use')" class="ai-menu-entry" @click="openAiFromMenu">
                {{ $t('aiAssistant') }}
              </el-button>
              <el-button type="primary" :loading="logoutLoading" @click="clickLogout">{{ $t('logOut') }}</el-button>
            </div>
          </div>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import router from "@/router";
import hanburger from '@/components/hamburger/index.vue'
import EmailSearch from '@/components/email-search/index.vue'
import aiAssistant from '@/components/ai-assistant/index.vue'
import {useEmailStore} from '@/store/email.js';
import {logout} from "@/request/login.js";
import {Icon} from "@iconify/vue";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useRoute} from "vue-router";
import {computed, ref} from "vue";
import {clearToken} from "@/utils/token-store.js";
import {useSettingStore} from "@/store/setting.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {setExtend} from "@/utils/day.js"

const {t} = useI18n();
const route = useRoute();
const settingStore = useSettingStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const emailStore = useEmailStore();
const logoutLoading = ref(false)
const userInfoShow = ref(false)
const userinfoRef = ref({})
const aiAssistantRef = ref(null)
function openAiFromMenu() {
  userInfoShow.value = false
  aiAssistantRef.value?.openPanel()
}
const showMailSearch = computed(() => ['email', 'star', 'unread', 'deleted', 'spam', 'all-email', 'send', 'draft', 'contacts', 'user'].includes(route.name))
const searchOptions = computed(() => {
  if (['contacts', 'user'].includes(route.name)) {
    return [
      {type: 'all', label: t('searchSummaryAll')},
      {type: 'name', label: t('contactName')},
      {type: 'email', label: t('contactEmail')},
    ]
  }
  return [
    {type: 'all', label: t('searchSummaryAll')},
    {type: 'subject', label: t('searchSummarySubject')},
    {type: 'content', label: t('searchSummaryContent')},
    {type: 'sender', label: t('searchSummarySender')},
    {type: 'senderAddress', label: t('searchSummarySenderAddress')},
    {type: 'recipientAddress', label: t('searchSummaryRecipientAddress')},
  ]
})

function refreshMailList() {
  if (['contacts', 'user', 'all-email'].includes(route.name)) {
    window.dispatchEvent(new CustomEvent('otsmail:search', {detail: {...emailStore.searchParams}}))
    return
  }
  emailStore.emailScroll?.refreshList()
}

const accountCount = computed(() => {
  return userStore.user.role.accountCount
})

const sendType = computed(() => {

  if (settingStore.settings.send === 1) {
    return t('disabled')
  }

  if (!hasPerm('email:send')) {
    return t('unauthorized')
  }

  if (userStore.user.role.sendType === 'ban') {
    return t('sendBanned')
  }

  if (userStore.user.role.sendType === 'internal') {
    return t('sendInternal')
  }

  if (!userStore.user.role.sendCount) {
    return t('unlimited')
  }

  if (userStore.user.role.sendType === 'day') {
    return t('daily')
  }

  if (userStore.user.role.sendType === 'count') {
    return t('total')
  }
})

const sendCount = computed(() => {


  if (!hasPerm('email:send')) {
    return null
  }

  if (userStore.user.role.sendType === 'ban') {
    return null
  }

  if (userStore.user.role.sendType === 'internal') {
    return null
  }

  if (!userStore.user.role.sendCount) {
    return null
  }

  if (settingStore.settings.send === 1) {
    return null
  }

  return userStore.user.sendCount + '/' + userStore.user.role.sendCount
})

function userInfoHide(e) {
    if (userInfoShow.value) {
        userinfoRef.value.handleClose()
    } else {
        userinfoRef.value.handleOpen()
    }
}

async function copyEmail(email) {
  try {
    await navigator.clipboard.writeText(email);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function changeLang(lang) {
  setExtend(lang === 'en' ? 'en' : 'zh-cn')
  settingStore.lang = lang
}

function openNotice() {
  uiStore.showNotice()
}

function openDark(e) {

  const nextIsDark = !uiStore.dark
  const root = document.documentElement

  if (!document.startViewTransition) {
    switchDark(nextIsDark, root);
    return
  }

  const x = e.clientX
  const y = e.clientY

  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  const endRadius = Math.hypot(maxX, maxY)

  // 标记切换目标，供 CSS 选择器使用
  root.setAttribute('data-theme-to', nextIsDark ? 'dark' : 'light')
  root.style.setProperty('--vt-x', `${x}px`)
  root.style.setProperty('--vt-y', `${y}px`)
  root.style.setProperty('--vt-end-radius', `${endRadius + 10}px`)

  const transition = document.startViewTransition(() => {
    switchDark(nextIsDark, root);
  })

  transition.finished.finally(() => {
    // 清理标记
    root.removeAttribute('data-theme-to')
  })
}

function switchDark(nextIsDark, root) {
  root.setAttribute('class', nextIsDark ? 'dark' : '')
  root.setAttribute('data-theme', nextIsDark ? 'dark' : 'light')
  const metaTag = document.getElementById('theme-color-meta');
  const isMobile =  !window.matchMedia("(pointer: fine) and (hover: hover)").matches;
  metaTag.setAttribute('content', nextIsDark ? (isMobile ? '#141414' : '#000000') : (isMobile ? '#FFFFFF' : '#F1F1F1'));
  uiStore.dark = nextIsDark
}

function openSend() {
  uiStore.writerRef.open()
}

function changeAside() {
  if (window.innerWidth > 1024) {
    uiStore.asideCollapsed = !uiStore.asideCollapsed
  } else {
    uiStore.asideShow = !uiStore.asideShow
  }
}

function clickLogout() {
  if (logoutLoading.value) return
  logoutLoading.value = true
  // 清掉内存里的 token 再跳转：只删 localStorage.token 的话守卫仍认为已登录，
  // 会把 /login 弹回来，表现就是要连点好几次才退得出去。
  logout().catch(() => {})
  clearToken()
  router.replace('/login').finally(() => {
    logoutLoading.value = false
  })
}

function formatName(email) {
  return email[0]?.toUpperCase() || ''
}

</script>
<style>
.detail-dropdown {
  color: var(--el-text-color-primary) !important;
}
</style>
<style lang="scss" scoped>

:deep(.el-popper.is-pure) {
  border-radius: 6px;
}

.user-details {
  width: 250px;
  font-size: 14px;
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;

  .user-name {
    font-weight: bold;
    margin-top: 10px;
    padding-left: 20px;
    padding-right: 20px;
    width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
  }

  .detail-user-type {
    margin-top: 10px;
  }

  .action-info {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto;
    margin-top: 10px;

    > div:first-child {
      display: grid;
      align-items: center;
      gap: 10px;
    }

    > div:last-child {
      display: grid;
      gap: 10px;
      text-align: center;

      > div {
        display: flex;
        align-items: center;
      }
    }
  }

  .detail-email {
    padding-left: 20px;
    padding-right: 20px;
    width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    color: var(--regular-text-color);
    cursor: pointer;
  }

  .logout {
    margin-top: 20px;
    width: 100%;
    padding-left: 10px;
    padding-right: 10px;
    padding-bottom: 10px;

    .el-button {
      border-radius: 6px;
      height: 28px;
      width: 100%;
    }
  }

  .details-avatar {
    margin-top: 20px;
    height: 40px;
    width: 40px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    overflow: hidden;
    border-radius: 50%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    border: 1px solid var(--dark-border);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
  }
}


.header {
  text-align: left;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  gap: 12px;
}

.writer-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  color: #ffffff;
  background: var(--blue, #007aff);
  box-shadow: 0 2px 8px rgba(0, 122, 255, .2);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform .16s var(--ease-ios, ease), box-shadow .16s var(--ease-ios, ease), background .16s ease;
}

.writer-box:hover {
  background: var(--blue, #007aff);
  box-shadow: 0 4px 12px rgba(0, 122, 255, .28);
  transform: translateY(-1px);
}

.writer-box:active {
  transform: scale(.96);
  box-shadow: none;
}

.writer-text {
  white-space: nowrap;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  min-width: 0;
  flex: 1;
}

.header-mail-search {
  flex: 1;
  max-width: 720px;
}

.header-ai {
  display: inline-flex;
  align-items: center;
}

.breadcrumb-item {
  font-weight: bold;
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;

  .icon-item {
    align-self: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--label-2);
    transition: background .16s ease, color .16s ease;
  }

  .icon-item:hover {
    background: var(--fill-quaternary);
    color: var(--label);
  }

  .notice {
    font-size: 21px;
    margin-right: 2px;
  }

  .dark-icon {
    font-size: 19px;
  }

  .sun-icon {
    font-size: 22px;
  }

  @media (max-width: 767px) {
    gap: 2px;

    .writer-text {
      display: none;
    }

    .writer-box {
      width: 34px;
      padding: 0;
      justify-content: center;
    }

    .notice, .dark-icon, .sun-icon {
      display: none;
    }
  }

  .avatar {
    display: flex;
    align-items: center;
    cursor: pointer;

    .avatar-text {
      background: var(--el-bg-color);
      color: var(--el-text-color-primary);
      height: 30px;
      width: 30px;
      overflow: hidden;
      border-radius: 50%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 8px;
      border: 1px solid var(--dark-border);
    }

    .setting-icon {
      position: relative;
      top: 0;
      margin-right: 10px;
      bottom: 10px;
    }
  }

}

.el-tooltip__trigger:first-child:focus-visible {
  outline: unset;
}
</style>

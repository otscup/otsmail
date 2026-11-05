<template>
  <div class="mail-split" :class="{ 'split-open': selectedEmailId }">
  <emailScroll ref="scroll"
               :cancel-success="cancelStar"
               :star-success="addStar"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :star-add="starAdd"
               :star-cancel="starCancel"
               :time-sort="params.timeSort"
               :email-read="emailRead"
               :email-unread="emailUnread"
               :show-unread="true"
               :show-categories="!mailbox"
               actionLeft="4px"
               @jump="jumpContent"
               @category-change="closeContent"
  >
    <template #first>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
            v-if="params.timeSort === 0" width="28" height="28"/>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
            width="28" height="28"/>
    </template>

  </emailScroll>
  <MailContent v-if="selectedEmailId" :key="selectedEmailId" embedded class="split-content" @close="closeContent"/>
  <div v-else class="split-empty">
    <div class="empty-inner">
      <p class="empty-kicker"><span aria-hidden="true"></span>{{ $t('mailEmptyKicker') }}</p>
      <h2>{{ $t('mailEmptyTitle') }}</h2>
      <p class="empty-copy">{{ $t('mailEmptyBody') }}</p>
      <div class="empty-actions">
        <button type="button" class="empty-primary" @click="composeFromEmpty">
          <Icon icon="material-symbols:edit-outline-sharp" width="18" height="18"/>
          {{ $t('compose') }}<kbd>C</kbd>
        </button>
        <button type="button" class="empty-secondary" @click="focusSearch">
          <Icon icon="mdi:magnify" width="18" height="18"/>
          {{ $t('searchMail') }}<kbd>/</kbd>
        </button>
      </div>
      <dl class="empty-meta">
        <div>
          <dt>{{ $t('mailEmptyAccount') }}</dt>
          <dd>{{ accountStore.currentAccount.email || '—' }}</dd>
        </div>
        <div>
          <dt>{{ $t('mailEmptyShortcuts') }}</dt>
          <dd>Esc · C · /</dd>
        </div>
      </dl>
    </div>
  </div>
  </div>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import {useUiStore} from "@/store/ui.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailLatest, emailRead, emailUnread} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {defineOptions, h, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {sleep} from "@/utils/time-utils.js";
import {notifyNewEmail} from "@/utils/notify.js";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import MailContent from "@/views/content/index.vue";
import { useRoute } from 'vue-router'

defineOptions({ name: 'email' })
const props = defineProps({ mailbox: { type: String, default: '' } })

const route = useRoute();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const uiStore = useUiStore();
const settingStore = useSettingStore();
const scroll = ref({})
const selectedEmailId = ref(null)
const params = reactive({
  timeSort: 0,
})

onMounted(() => {
  emailStore.emailScroll = scroll;
  window.addEventListener('keydown', handleShortcut);
  latest()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleShortcut);
})

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

function focusSearch() {
  document.querySelector('.header-mail-search input')?.focus();
}

function composeFromEmpty() {
  uiStore.writerRef?.value?.open?.() || uiStore.writerRef?.open?.();
}

function handleShortcut(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(document.activeElement)) return;
  if (document.querySelector('.el-overlay, .el-message-box')) return;

  if (event.key === '/') {
    event.preventDefault();
    focusSearch();
  } else if (event.key.toLowerCase() === 'c') {
    event.preventDefault();
    composeFromEmpty();
  }
}


watch(() => accountStore.currentAccountId, () => {
  selectedEmailId.value = null
  scroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  scroll.value.refreshList();
}

function jumpContent(email) {
  if (email.unread === 0) { emailRead([email.emailId]); email.unread = 1 }
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showUnread = true
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  if (window.innerWidth > 1024) {
    selectedEmailId.value = email.emailId
    return
  }
  router.push('/mail')
}

function closeContent() {
  selectedEmailId.value = null
}

const existIds = new Set();

async function latest() {
  while (true) {

    let autoRefresh = settingStore.settings.autoRefresh;
    await sleep(autoRefresh > 1 ? autoRefresh * 1000 : 3000);

    // 搜索中不追加最新邮件：新到的邮件不一定符合搜索条件
    if (route.name !== 'email' || emailStore.hasSearch || scroll.value.activeCategory !== 'primary') {
      continue;
    }

    const latestId = scroll.value.latestEmail?.emailId

    if (!scroll.value.firstLoad && autoRefresh > 1) {
      try {
        const accountId = accountStore.currentAccountId
        const allReceive = scroll.value.latestEmail?.allReceive
        const curTimeSort = params.timeSort
        let list = []

        //确保发起请求时最后一个邮件是当前账号的,或者
        if (accountId === scroll.value.latestEmail?.reqAccountId) {
          list = await emailLatest(latestId, accountId, allReceive);
        }

        //确保请求回来后，账号没有切换，时间排序没有改变，全部邮件类型没变
        if (accountId === accountStore.currentAccountId && params.timeSort === curTimeSort && allReceive === accountStore.currentAccount.allReceive) {
          if (list.length > 0) {

            for (let email of list) {

              email.reqAccountId = accountId;
              email.allReceive = allReceive;

              if (!existIds.has(email.emailId)) {

                existIds.add(email.emailId)
                scroll.value.addItem(email)
                notifyNewEmail(email)

                await sleep(50)
              }

            }

          }

        }
      } catch (e) {
        if (e.code === 401 || e.code === 403) {
          settingStore.settings.autoRefresh = 0;
        }
        console.error(e)
      }
    }
  }
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size, category, page) {
  const accountId =  accountStore.currentAccountId;
  const allReceive = accountStore.currentAccount.allReceive;
  return emailList(accountId, allReceive, emailId, params.timeSort, size, 0, emailStore.searchParams, props.mailbox || undefined, category, page).then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    return data;
  })
}

</script>
<style>
.icon {
  cursor: pointer;
}
.split-empty {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(40px, 7vw, 96px) clamp(32px, 7vw, 104px);
  overflow: auto;
  border-left: 1px solid var(--rd-line);
  background: var(--rd-panel);
}
.empty-inner { width: min(560px, 100%); }
.empty-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 22px;
  color: var(--rd-muted);
  font-size: 12px;
}
.empty-kicker span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rd-accent);
  box-shadow: 0 0 0 4px var(--rd-accent-weak);
}
.split-empty h2 {
  margin: 0 0 16px;
  color: var(--rd-text);
  font-family: "Iowan Old Style", "Palatino Linotype", "Songti SC", Georgia, serif;
  font-size: clamp(32px, 4.2vw, 52px);
  font-weight: 600;
  letter-spacing: -.03em;
  line-height: 1.08;
}
.empty-copy {
  max-width: 430px;
  margin: 0 0 30px;
  color: var(--rd-muted);
  font-size: 14px;
  line-height: 1.7;
}
.empty-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.empty-actions button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 15px;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease, transform .16s ease;
}
.empty-actions button:active { transform: translateY(1px); }
.empty-actions button:focus-visible { outline: 2px solid var(--rd-accent); outline-offset: 2px; }
.empty-primary { color: #fff; background: var(--rd-accent); border: 1px solid var(--rd-accent); box-shadow: 0 8px 20px rgba(36, 84, 214, .18); }
.empty-primary:hover { background: color-mix(in srgb, var(--rd-accent) 82%, #000); border-color: color-mix(in srgb, var(--rd-accent) 82%, #000); }
.empty-secondary { color: var(--rd-text); background: var(--rd-panel); border: 1px solid var(--rd-line-strong); }
.empty-secondary:hover { background: var(--rd-panel-2); }
.empty-actions kbd {
  margin-left: 4px;
  padding: 3px 5px;
  border: 1px solid currentColor;
  border-radius: 5px;
  font: inherit;
  font-size: 10px;
  line-height: 1;
  opacity: .55;
}
.empty-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin: 42px 0 0;
  padding: 18px 0 0;
  border-top: 1px solid var(--rd-line);
}
.empty-meta div { min-width: 0; }
.empty-meta dt { margin-bottom: 5px; color: var(--rd-faint); font-size: 11px; letter-spacing: .02em; }
.empty-meta dd { max-width: 260px; margin: 0; overflow: hidden; color: var(--rd-text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
html[data-theme="dark"] .split-empty { background: var(--rd-panel); }
html[data-theme="dark"] .empty-primary { color: #06111d; }
@media (max-width:1024px){ .split-empty{display:none} }
</style>

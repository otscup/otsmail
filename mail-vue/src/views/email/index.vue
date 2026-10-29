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
               :show-categories="true"
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
    <div class="empty-logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="4" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 8l7.5 5.4L19.5 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <b>Select a message</b>
    <span>选择一封邮件开始阅读</span>
  </div>
  </div>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailLatest, emailRead, emailUnread} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {defineOptions, h, onMounted, reactive, ref, watch} from "vue";
import {sleep} from "@/utils/time-utils.js";
import {notifyNewEmail} from "@/utils/notify.js";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import MailContent from "@/views/content/index.vue";
import { useRoute } from 'vue-router'

defineOptions({
  name: 'email'
})

const route = useRoute();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const scroll = ref({})
const selectedEmailId = ref(null)
const params = reactive({
  timeSort: 0,
})

onMounted(() => {
  emailStore.emailScroll = scroll;
  latest()
})


watch(() => accountStore.currentAccountId, () => {
  selectedEmailId.value = null
  scroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  scroll.value.refreshList();
}

function jumpContent(email) {
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
  return emailList(accountId, allReceive, emailId, params.timeSort, size, 0, emailStore.searchParams, undefined, category, page).then(data => {
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
.split-empty { flex:1 1 0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--rd-muted,var(--label-3)); background:var(--rd-bg); }
.split-empty .empty-logo { width:58px; height:58px; display:grid; place-items:center; border-radius:18px; color:#63e6ff; background:linear-gradient(145deg,rgba(99,230,255,.16),rgba(109,92,231,.16)); box-shadow:0 0 28px rgba(99,230,255,.14); margin-bottom:6px; }
.split-empty .empty-logo svg { width:30px; height:30px; }
.split-empty b { font-size:14px; color:var(--rd-text,var(--label)); font-weight:650; }
.split-empty span { font-size:12px; }
@media (max-width:1024px){ .split-empty{display:none} }
</style>

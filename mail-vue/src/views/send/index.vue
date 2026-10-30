<template>
  <div class="mail-list-split">
  <div class="mail-list-left">
  <emailScroll ref="sendScroll"
               :cancel-success="cancelStar"
               :star-success="addStar"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :email-unread="emailUnread"
               :star-add="starAdd"
               show-status
               :show-search="true"
               actionLeft="4px"
               :star-cancel="starCancel"
               @jump="jumpContent"
               :time-sort="params.timeSort"
               :type="'send'"
  >
    <template #first>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
            v-if="params.timeSort === 0" width="28" height="28"/>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
            width="28" height="28"/>
    </template>
  </emailScroll>
  </div>
  <MailContent v-if="selectedEmailId" :key="selectedEmailId" embedded class="mail-list-reader" @close="closeContent"/>
  <div v-else class="mail-list-empty"><span>Select a message</span><small>选择一封邮件开始阅读</small></div>
  </div>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailUnread} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {defineOptions, onMounted, reactive, ref, watch} from "vue";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import MailContent from "@/views/content/index.vue";

defineOptions({
  name: 'send'
})

const emailStore = useEmailStore();
const accountStore = useAccountStore();
const sendScroll = ref({})
const selectedEmailId = ref(null)
const params = reactive({
  timeSort: 0,
})

onMounted(() => {
  emailStore.sendScroll = sendScroll;
})

watch(() => accountStore.currentAccountId, () => {
  sendScroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  sendScroll.value.refreshList();
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  if (innerWidth > 1366) { selectedEmailId.value = email.emailId; return }
  router.push('/mail')
}

function closeContent() { selectedEmailId.value = null }

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size, category, page) {
  const accountId =  accountStore.currentAccountId;
  const allReceive = accountStore.currentAccount.allReceive;
  return emailList(accountId, allReceive, emailId, params.timeSort, size, 1, emailStore.searchParams, undefined, undefined, page).then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    return data;
  })
}

</script>

<style scoped>
.icon {
  cursor: pointer;
}
</style>
<style scoped>
.mail-list-split { height:100%; display:flex; min-height:0; }
.mail-list-left { flex:0 0 440px; min-width:0; display:flex; flex-direction:column; min-height:0; }
.mail-list-reader { flex:1 1 auto; min-width:0; }
.mail-list-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--rd-muted); }
.mail-list-empty span { font-weight:600; color:var(--rd-text); }
.mail-list-empty small { font-size:12px; }
@media (max-width:1024px){ .mail-list-split{display:block} .mail-list-left{width:100%;flex:1 1 auto} .mail-list-empty,.mail-list-reader{display:none} }
</style>

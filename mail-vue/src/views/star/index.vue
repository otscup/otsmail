<template>
  <div class="mail-list-split">
  <div class="mail-list-left">
  <emailScroll type="star" ref="scroll"
               :allow-star="false"
               :cancel-success="cancelStar"
               :getEmailList="getStarList"
               :emailDelete="emailDelete"
               :email-unread="emailUnread"
               :star-add="starAdd"
               :star-cancel="starCancel"
               @jump="jumpContent"
               actionLeft="6px"
               :show-account-icon="false"
  />
  </div>
  <MailContent v-if="selectedEmailId" :key="selectedEmailId" embedded class="mail-list-reader" @close="closeContent"/>
  <div v-else class="mail-list-empty"><span>Select a message</span><small>选择一封邮件开始阅读</small></div>
  </div>
</template>

<script setup>
import emailScroll from "@/components/email-scroll/index.vue"
import {emailDelete, emailUnread} from "@/request/email.js";
import {starAdd, starCancel, starList} from "@/request/star.js";
import {useEmailStore} from "@/store/email.js";
import {defineOptions, onMounted, ref} from "vue";
import router from "@/router/index.js";
import MailContent from "@/views/content/index.vue";

defineOptions({
  name: 'star'
})

const scroll = ref({})
const emailStore = useEmailStore();
const selectedEmailId = ref(null)

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  if (innerWidth > 1366) { selectedEmailId.value = email.emailId; return }
  router.push('/mail')
}

function getStarList(emailId, size, category, page) {
  return starList(emailId, size, page)
}

function closeContent() { selectedEmailId.value = null }

function cancelStar(email) {
  emailStore.cancelStarEmailId = email.emailId
  scroll.value.deleteEmail([email.emailId])
}

onMounted(() => {
  emailStore.starScroll = scroll
})

</script>

<style scoped>
.mail-list-split { height:100%; display:flex; min-height:0; }
.mail-list-left { flex:0 0 440px; min-width:0; display:flex; flex-direction:column; min-height:0; }
.mail-list-reader { flex:1 1 auto; min-width:0; }
.mail-list-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--rd-muted); }
.mail-list-empty span { font-weight:600; color:var(--rd-text); }
.mail-list-empty small { font-size:12px; }
@media (max-width:1024px){ .mail-list-split{display:block} .mail-list-left{width:100%;flex:1 1 auto} .mail-list-empty,.mail-list-reader{display:none} }
</style>

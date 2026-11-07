<template>
  <div class="mailbox-page">
    <div class="mailbox-list">
    <div class="mailbox-note" v-if="mailbox === 'spam'">
      自动判定：反垃圾头（X-Spam-Status / X-Spam-Flag / 分数≥5 / 五星标记）、主题含 [SPAM] 等标记，以及后台黑名单；
      也可以在邮件详情或列表右键里手动标记。
    </div>
    <emailScroll ref="scroll"
                 :cancel-success="cancelStar"
                 :star-success="addStar"
                 :getEmailList="getEmailList"
                 :emailDelete="emailDelete"
                 :star-add="starAdd"
                 :star-cancel="starCancel"
                 :email-read="emailRead"
                 :email-unread="emailUnread"
                 :show-search="true"
                 :show-unread="true"
                 :type="mailbox"
                 actionLeft="4px"
                 @jump="jumpContent">
      <template #subject="row">
        <span class="subj-text">{{ row.email.subject }}</span>
        <span class="row-actions" v-if="mailbox === 'deleted'">
          <button class="row-btn" @click.stop="restoreMail(row.email)">{{ $t('restoreMail') }}</button>
          <button class="row-btn danger" @click.stop="deleteForever(row.email)">{{ $t('delete') }}</button>
        </span>
        <span class="row-actions" v-else-if="mailbox === 'spam'">
          <button class="row-btn" @click.stop="notSpam(row.email)">{{ $t('unmarkSpam') }}</button>
          <button class="row-btn danger" @click.stop="emailDelete([row.email.emailId])">{{ $t('delete') }}</button>
        </span>
      </template>
    </emailScroll>
    <div class="mailbox-empty" v-if="isEmpty">
      <el-empty :description="$t(emptyKey)"/>
    </div>
    </div>
    <MailContent v-if="selectedEmailId" :key="selectedEmailId" embedded class="mailbox-reader" @close="closeContent"/>
    <div v-else class="mailbox-reader-empty">
      <span>Select a message</span><small>选择一封邮件开始阅读</small>
    </div>
  </div>
</template>

<script setup>
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete as emailDeleteApi, emailRead, emailUnread, emailRestore, emailSpamCancel, emailPhysicsDelete} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useI18n} from "vue-i18n";
import {computed, defineOptions, onMounted, ref, watch} from "vue";
import {useRoute} from "vue-router";
import router from "@/router/index.js";
import {ElMessageBox} from "element-plus";
import MailContent from "@/views/content/index.vue";

defineOptions({
  name: 'mailbox'
})

const props = defineProps({
  mailbox: {
    type: String,
    default: ''
  }
})

const route = useRoute();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const {t} = useI18n();
const scroll = ref({})
const selectedEmailId = ref(null)

// 参数化分类列表：props 优先，其次路由 meta.mailbox，缺省未读
const mailbox = computed(() => props.mailbox || route.meta.mailbox || 'unread')

const emptyKey = computed(() => ({
  unread: 'unreadEmpty',
  deleted: 'deletedEmpty',
  spam: 'spamEmpty'
}[mailbox.value] || 'noMessagesFound'))

const isEmpty = computed(() => scroll.value.noLoading && scroll.value.emailList?.length === 0)

onMounted(() => {
  emailStore.emailScroll = scroll;
})

watch(() => accountStore.currentAccountId, () => {
  scroll.value.refreshList();
})

watch(mailbox, () => {
  scroll.value.refreshList?.();
})

function getEmailList(emailId, size, category, page) {
  const accountId = accountStore.currentAccountId;
  const allReceive = accountStore.currentAccount.allReceive;
  return emailList(accountId, allReceive, emailId, 0, size, 0, emailStore.searchParams, mailbox.value, undefined, page).then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    return data;
  })
}

function jumpContent(email) {
  if (email.unread === 0) { emailRead([email.emailId]); email.unread = 1 }
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  if (innerWidth > 1366) { selectedEmailId.value = email.emailId; return }
  // 未读列表里打开信件按常规标已读；垃圾/已删除不标
  emailStore.contentData.showUnread = mailbox.value === 'unread'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = mailbox.value !== 'deleted'
  router.push('/mail')
}

function closeContent() {
  selectedEmailId.value = null
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

async function restoreMail(email) {
  await emailRestore(email.emailId)
  scroll.value.deleteEmail([email.emailId])
}

async function notSpam(email) {
  await emailSpamCancel(email.emailId)
  scroll.value.deleteEmail([email.emailId])
}

async function deleteForever(email) {
  await ElMessageBox.confirm(t('delEmailConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  })
  await emailPhysicsDelete(email.emailId)
  scroll.value.deleteEmail([email.emailId])
}

// 回收站里的“删除”就是彻底删除；其它分类走 /email/delete。
async function emailDelete(emailIds, forever = false) {
  if (forever || mailbox.value === 'deleted') {
    for (const emailId of emailIds) {
      await emailPhysicsDelete(emailId)
    }
    return
  }
  await emailDeleteApi(emailIds)
}
</script>

<style scoped>
.mailbox-page {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: row;
  min-height: 0;
}
.mailbox-list {
  flex: 0 0 440px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mailbox-reader { flex: 1 1 auto; min-width: 0; }
.mailbox-reader-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--rd-muted); }
.mailbox-reader-empty span { font-weight: 600; color: var(--rd-text); }
.mailbox-reader-empty small { font-size: 12px; }
@media (max-width: 1366px) {
  .mailbox-page { display: block; }
  .mailbox-reader-empty { display: none; }
}

.mailbox-page :deep(.email-container) {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
}

.mailbox-note {
  margin: 0 0 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md, 10px);
  background: var(--fill-quaternary, rgba(118, 118, 128, .08));
  color: var(--label-3, #8e8e93);
  font-size: 12px;
  line-height: 1.45;
}

/* 分类空态用本页文案，隐藏列表组件的通用空态 */
:deep(.email-container .empty) {
  display: none;
}

.mailbox-empty {
  position: absolute;
  inset: 56px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 行内操作接在主题文本之后 */
:deep(.subject-text) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.subj-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 行内恢复/删除不参与主题行排版，悬停时浮在右侧，避免把标题挤歪。 */
.mailbox-page :deep(.row-actions) {
  position: absolute;
  top: 7px;
  right: 12px;
  z-index: 3;
  display: inline-flex;
  gap: 6px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity .15s ease;
}

.mailbox-page :deep(.email-row) {
  position: relative;
}

.mailbox-page :deep(.email-row:hover .row-actions) {
  opacity: 1;
  pointer-events: auto;
}
.mailbox-page :deep(.email-row.deleted:hover .phone-time),
.mailbox-page :deep(.email-row.deleted:hover .row-markers) {
  opacity: 0;
}

.mailbox-page :deep(.email-row.deleted .email-actions),
.mailbox-page :deep(.email-row.spam .email-actions) {
  display: none !important;
}

.mailbox-page :deep(.row-btn) {
  height: 26px;
  padding: 0 var(--space-2, 8px);
  border: 0.5px solid var(--separator, rgba(60, 60, 67, 0.29));
  border-radius: var(--radius-md, 8px);
  background: var(--bg-secondary, #fff);
  color: var(--blue, #007aff);
  font-size: var(--text-footnote, 13px);
  line-height: 1;
  cursor: pointer;
}

.mailbox-page :deep(.row-btn:hover) {
  background: var(--fill-quaternary, rgba(116, 116, 128, 0.08));
}

.mailbox-page :deep(.row-btn.danger) {
  color: #ff3b30;
}
</style>

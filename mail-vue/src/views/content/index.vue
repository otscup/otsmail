<template>
  <div class="box mail-detail" v-if="email">
    <div class="header-actions">
      <el-tooltip :content="$t('backToList')" placement="bottom">
        <Icon class="icon" icon="material-symbols-light:arrow-back-ios-new" width="20" height="20" @click="handleBack"/>
      </el-tooltip>
      <Icon v-perm="'email:delete'" class="icon" icon="uiw:delete" width="16" height="16" @click="handleDelete"/>
      <span class="star" v-if="emailStore.contentData.showStar">
        <Icon class="icon" @click="changeStar" v-if="email.isStar" icon="fluent-color:star-16" width="20" height="20"/>
        <Icon class="icon" @click="changeStar" v-else icon="solar:star-line-duotone" width="18" height="18"/>
      </span>
      <el-tooltip v-if="email.type === 0"
                  :content="email.spam ? $t('unmarkSpam') : $t('markSpam')"
                  placement="top">
        <Icon class="icon" @click="toggleSpam"
              :icon="email.spam ? 'fluent:mail-read-20-regular' : 'mdi:email-remove'" width="20" height="20"/>
      </el-tooltip>
      <el-dropdown trigger="click" @command="moveCurrentTo" :teleported="false">
        <Icon class="icon" icon="mdi:folder-move-outline" width="20" height="20" :title="$t('moveToCategory')"/>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in categories" :key="item.key" :command="item.key"
                              :disabled="email.category === item.key">
              <div class="move-category-item">
                <Icon :icon="item.icon" width="18" height="18"/>
                <span>{{ $t(item.label) }}</span>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <aiAssistant class="detail-ai" inline :email-id="email.emailId" :email-subject="email.subject"/>
      <button type="button" class="reader-summary-btn" :class="{active: showSummary}" @click="toggleSummary">
        <Icon icon="mdi:star-four-points" width="16" height="16"/><span>AI Brief</span>
      </button>
      <el-tooltip v-if="emailStore.contentData.showReply" :content="$t('reply')" placement="bottom">
        <Icon class="icon" v-perm="'email:send'" @click="openReply" icon="la:reply" width="21" height="21" />
      </el-tooltip>
      <el-tooltip v-if="emailStore.contentData.showReply" :content="$t('replyAll')" placement="bottom">
        <Icon class="icon" v-perm="'email:send'" @click="openReplyAll" icon="mdi:reply-all" width="21" height="21" />
      </el-tooltip>
      <el-tooltip v-if="emailStore.contentData.showReply" :content="$t('forward')" placement="bottom">
        <Icon class="icon" v-perm="'email:send'" @click="openForward" icon="iconoir:arrow-up-right" width="20" height="20" />
      </el-tooltip>
      <el-tooltip
          :content="translationState === 'translated' ? $t('showOriginal') : $t('translate')"
          placement="top">
        <el-dropdown trigger="click" @command="onTranslateCmd" :teleported="false">
          <Icon
              class="icon"
              :class="{ 'translating': translationState === 'loading' }"
              :icon="translationState === 'translated' ? 'mdi:translate-off' : 'mdi:translate'"
              width="20" height="20"/>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="l in targetLangs" :key="l.code" :command="l.code">
                {{ l.name }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-tooltip>
    </div>
    <div></div>
    <el-scrollbar class="scrollbar">
      <div class="container">
        <div class="email-title">
          {{ displaySubject }}
        </div>
        <div class="content">
          <div class="email-info">
            <div class="reader-avatar"><span>{{ senderInitial(email.name) }}</span></div>
            <div class="email-info-main">
              <div class="send"><span class="send-source">{{$t('from')}}</span>
                <div class="send-name">
                  <span class="send-name-title">{{ email.name }}</span>
                  <span><{{ email.sendEmail }}></span>
                  <el-tooltip :content="$t('contactAddQuick')" placement="top">
                    <Icon class="add-contact-inline" icon="mdi:account-plus-outline" width="18" height="18"
                          @click.stop="addSenderContact"/>
                  </el-tooltip>
                </div>
              </div>
              <div class="receive"><span class="source">{{$t('recipient')}}</span><span class="receive-email">{{  formateReceive(email.recipient) }}</span></div>
              <div class="date">
                <div>{{ formatDetailDate(email.createTime) }}</div>
              </div>
            </div>
            <el-alert v-if="email.status === 3" :closable="false" :title="toMessage(email.message)" class="email-msg" type="error" show-icon />
            <el-alert v-if="email.status === 4" :closable="false" :title="$t('complained')" class="email-msg" type="warning" show-icon />
            <el-alert v-if="email.status === 5" :closable="false" :title="$t('delayed')" class="email-msg" type="warning" show-icon />
          </div>
          <div v-if="showSummary" class="ai-summary-card">
            <div class="ai-summary-head">
              <Icon icon="mdi:creation" width="18" height="18"/>
              <b>AI Brief</b><span>AI 摘要</span>
              <button type="button" class="summary-refresh" :disabled="summaryLoading" @click="loadSummary">
                <Icon icon="ion:reload" width="14" height="14" :class="{spinning: summaryLoading}"/>
              </button>
              <button type="button" class="summary-close" @click="showSummary = false">×</button>
            </div>
            <div v-if="summaryLoading" class="ai-summary-loading">Summarizing this thread…</div>
            <div v-else-if="summaryError" class="ai-summary-error">{{ summaryError }}</div>
            <div v-else class="ai-summary-text">{{ summary }}</div>
          </div>
          <el-alert
              v-if="translationState === 'translated'"
              type="info"
              :closable="false"
              class="translation-banner"
              show-icon>
            <span>{{ $t('translatedFrom', { lang: sourceLang || $t('langUnknown') }) }}</span>
            <el-link type="primary" @click="toggleOriginal">&nbsp;{{ $t('showOriginal') }}</el-link>
          </el-alert>
          <el-scrollbar class="htm-scrollbar" :class="email.attList.length === 0 ? 'bottom-distance' : ''">
            <ShadowHtml class="shadow-html" :html="formatImage(displayContent)" v-if="displayContent" />
            <pre v-else class="email-text" >{{email.text}}</pre>
          </el-scrollbar>
          <div class="detail-actions" v-if="emailStore.contentData.showReply" v-perm="'email:send'">
            <el-button round @click="openReply">
              <Icon icon="la:reply" width="17" height="17"/>&nbsp;{{ $t('reply') }}
            </el-button>
            <el-button round @click="openReplyAll">
              <Icon icon="mdi:reply-all" width="17" height="17"/>&nbsp;{{ $t('replyAll') }}
            </el-button>
            <el-button round @click="openForward">
              <Icon icon="iconoir:arrow-up-right" width="17" height="17"/>&nbsp;{{ $t('forward') }}
            </el-button>
          </div>
          <div class="att" v-if="email.attList.length > 0">
            <div class="att-title">
              <span>{{$t('attachments')}}</span>
              <span>{{$t('attCount',{total: email.attList.length})}}</span>
            </div>
            <div class="att-box">

              <div class="att-item" v-for="att in email.attList" :key="att.attId">
                <div class="att-icon" @click="showImage(att.key)">
                  <Icon v-bind="getIconByName(att.filename)" />
                </div>
                <div class="att-name" @click="showImage(att.key)">
                  {{ att.filename }}
                </div>
                <div class="att-size">{{ formatBytes(att.size) }}</div>
                <div class="opt-icon att-icon">
                  <Icon v-if="isImage(att.filename)" icon="hugeicons:view" width="22" height="22" @click="showImage(att.key)"/>
                  <a :href="cvtR2Url(att.key)" download>
                    <Icon icon="system-uicons:push-down" width="22" height="22"/>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <el-image-viewer
        v-if="showPreview"
        :url-list="srcList"
        show-progress
        @close="showPreview = false"
    />
  </div>
</template>
<script setup>
import ShadowHtml from '@/components/shadow-html/index.vue'
import {reactive, ref, watch, onMounted, onUnmounted} from "vue";
import {useRouter} from 'vue-router'
import {ElMessage, ElMessageBox} from 'element-plus'
import {emailDelete, emailRead, emailDetail, emailSpam, emailSpamCancel, emailMoveCategory} from "@/request/email.js";
import {Icon} from "@iconify/vue";
import aiAssistant from '@/components/ai-assistant/index.vue';
import {useEmailStore} from "@/store/email.js";
import {useAccountStore} from "@/store/account.js";
import {formatDetailDate} from "@/utils/day.js";
import {starAdd, starCancel} from "@/request/star.js";
import {getExtName, formatBytes} from "@/utils/file-utils.js";
import {cvtR2Url,toOssDomain} from "@/utils/convert.js";
import {getIconByName} from "@/utils/icon-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {allEmailDelete} from "@/request/all-email.js";
import {useUiStore} from "@/store/ui.js";
import {useI18n} from "vue-i18n";
import {EmailUnreadEnum} from "@/enums/email-enum.js";
import {translateEmail} from "@/request/translation.js";
import {aiSummary} from "@/request/ai.js";
import {contactAdd} from "@/request/contact.js";
import {computed} from "vue";

const uiStore = useUiStore();
const settingStore = useSettingStore();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const props = defineProps({
  embedded: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])
const router = useRouter()
const email = emailStore.contentData.email
const showPreview = ref(false)
const showSummary = ref(false)
const summary = ref('')
const summaryLoading = ref(false)
const summaryError = ref('')
const srcList = reactive([])

async function loadSummary() {
  if (!email?.emailId) return
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const data = await aiSummary(email.emailId)
    summary.value = data?.text || ''
    if (!summary.value) summaryError.value = 'No summary returned.'
  } catch (e) {
    summaryError.value = e?.message || 'AI summary unavailable.'
  } finally {
    summaryLoading.value = false
  }
}

function toggleSummary() {
  showSummary.value = !showSummary.value
  if (showSummary.value && !summary.value && !summaryLoading.value) loadSummary()
}

function senderInitial(name) {
  const v = String(name || email?.sendEmail || '?').trim()
  if (/^[\u3400-\u9fff]/.test(v)) return v.slice(0, 1)
  return v.split(/\s+/).map(x => x[0] || '').join('').slice(0, 2).toUpperCase() || '?'
}

async function addSenderContact() {
  if (!email?.sendEmail) return
  await contactAdd({
    name: email.name || '',
    email: email.sendEmail,
    groupName: '默认',
    remark: ''
  })
  ElMessage({message: t('contactAddSuccess'), type: 'success', plain: true})
}

const { t, locale } = useI18n()
const categories = [
  {key: 'primary', label: 'categoryPrimary', icon: 'mdi:inbox-outline'},
  {key: 'social', label: 'categorySocial', icon: 'mdi:account-group-outline'},
  {key: 'promotion', label: 'categoryPromotion', icon: 'mdi:tag-outline'},
  {key: 'updates', label: 'categoryUpdates', icon: 'mdi:bell-outline'},
  {key: 'ads', label: 'categoryAds', icon: 'mdi:bullhorn-outline'},
  {key: 'spam', label: 'categorySpam', icon: 'mdi:alert-octagon-outline'},
]

// ---- 一键翻译 ----------------------------------------------------------
const targetLangs = [
  { code: 'zh', name: '简体中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
]
const translationState = ref('idle') // 'idle' | 'loading' | 'translated'
const translatedSubject = ref('')
const translatedContent = ref('')
const sourceLang = ref('')
const lastLang = ref('')

const displaySubject = computed(() =>
  translationState.value === 'translated' ? translatedSubject.value : email.subject)
const displayContent = computed(() =>
  translationState.value === 'translated' ? translatedContent.value : email.content)

function toggleOriginal() {
  translationState.value = 'idle'
}

// 从下拉选具体语言
function onTranslateCmd(lang) {
  doTranslate(lang)
}

async function doTranslate(lang) {
  if (translationState.value === 'loading') return
  // 同一封、同一语言已翻过 → 直接展示缓存
  if (translatedContent.value && lastLang.value === lang) {
    translationState.value = 'translated'
    return
  }
  translationState.value = 'loading'
  try {
    const data = await translateEmail(email.emailId, lang)
    if (data.alreadyInTargetLang) {
      ElMessage({ message: t('alreadyInTargetLang'), type: 'info', plain: true })
      translationState.value = 'idle'
      return
    }
    translatedSubject.value = data.translatedSubject
    translatedContent.value = data.translatedContent
    sourceLang.value = data.sourceLang || ''
    lastLang.value = lang
    translationState.value = 'translated'
  } catch (e) {
    translationState.value = 'idle'
  }
}

// 切换邮件时清空翻译态
// 直接打开 /mail（刷新恢复失败）时 email 可能为 null，getter 里必须容忍
watch(() => [email?.emailId, settingStore.settings.aiSummaryMode], ([id, mode]) => {
  translationState.value = 'idle'
  translatedSubject.value = ''
  showSummary.value = false
  summary.value = ''
  summaryError.value = ''
  if (id && mode === 'auto') {
    showSummary.value = true
    loadSummary()
  }
  translatedContent.value = ''
  sourceLang.value = ''
  lastLang.value = ''
}, { immediate: true })

watch(() => accountStore.currentAccountId, () => {
  handleBack()
})

onMounted(async () => {
  // T-02 edge: persisted contentData.email null -> no recoverable id, fall back to inbox list
  if (!email || !email.emailId) {
    if (!props.embedded) router.replace('/inbox')
    return
  }
  // T-02: 刷新后从 persist 恢复的 contentData.email 可能 content 缺失/过期 → 用 detail 兜底重取
  if (email && email.emailId && !email.content) {
    try {
      const detail = await emailDetail(email.emailId)
      // 就地合并，保持模板 `email` 引用与响应式
      Object.assign(email, detail)
    } catch (e) {
      // 兜底失败不阻塞其它 onMounted 逻辑（错误已有 axios 拦截器 Toast）
    }
  }
  if (emailStore.contentData.showUnread && email.unread === EmailUnreadEnum.UNREAD) {
    email.unread = EmailUnreadEnum.READ;
    emailStore.markListRead(email.emailId);
    emailRead([email.emailId]).then(() => emailStore.emailScroll?.loadCategoryCounts?.());
  }
  window.addEventListener('keydown', handleKeyDown);
})

onUnmounted(() => {
  emailStore.contentData.showUnread = false;
  window.removeEventListener('keydown', handleKeyDown);
})

function handleKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (showPreview.value) return;
  if (document.querySelector('.el-message-box')) return;
  const writeBox = document.querySelector('.write-box');
  if (writeBox && writeBox.offsetParent !== null) return;
  handleBack();
}

function openReply() {
  uiStore.writerRef.openReply(email)
}

function openReplyAll() {
  uiStore.writerRef.openReplyAll(email)
}

function openForward() {
  uiStore.writerRef.openForward(email)
}

function toMessage(message) {
  return  message ? JSON.parse(message).message : '';
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return  content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function showImage(key) {
  if (!isImage(key)) return;
  const url = cvtR2Url(key)
  srcList.length = 0
  srcList.push(url)
  showPreview.value = true
}

function isImage(filename) {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif','jfif'].includes(getExtName(filename))
}

function formateReceive(recipient) {
  recipient = JSON.parse(recipient)
  return recipient.map(item => item.address).join(', ')
}

function changeStar() {
  if (email.isStar) {
    email.isStar = 0;
    starCancel(email.emailId).then(() => {
      email.isStar = 0;
      emailStore.cancelStarEmailId = email.emailId
      setTimeout(() => emailStore.cancelStarEmailId = 0)
      emailStore.starScroll?.deleteEmail([email.emailId])
    }).catch((e) => {
      console.error(e)
      email.isStar = 1;
    })
  } else {
    email.isStar = 1;
    starAdd(email.emailId).then(() => {
      email.isStar = 1;
      emailStore.addStarEmailId = email.emailId
      setTimeout(() => emailStore.addStarEmailId = 0)
      emailStore.starScroll?.addItem(email)
    }).catch((e) => {
      console.error(e)
      email.isStar = 0;
    })
  }
}

// 标记 / 取消垃圾邮件（仅收到的邮件）
function toggleSpam() {
  const target = email.spam ? 0 : 1
  const req = target ? emailSpam : emailSpamCancel
  req(email.emailId).then(() => {
    email.spam = target
  })
}

async function moveCurrentTo(category) {
  try {
    await emailMoveCategory([email.emailId], category)
    email.category = category
    email.spam = category === 'spam' ? 1 : 0
    const label = t(categories.find(item => item.key === category)?.label || 'categoryPrimary')
    ElMessage({message: t('movedToCategory', {category: label}), type: 'success', plain: true})
    emailStore.emailScroll?.refreshList()
    window.dispatchEvent(new CustomEvent('otsmail:counts'))
  } catch (e) {
    ElMessage({message: e?.message || t('operationFailed'), type: 'error', plain: true})
  }
}

const handleBack = () => {
  if (props.embedded) {
    emit('close')
    return
  }
  router.back()
}

const handleDelete = () => {
  ElMessageBox.confirm(t('delEmailConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    if (emailStore.contentData.delType === 'logic') {
      emailDelete(email.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.emailId]
      })
    } else  {

      allEmailDelete(email.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.emailId]
      })
    }

    router.back()
  })
}
</script>
<style scoped lang="scss">
.box {
  height: 100%;
  overflow: hidden;
}

.header-actions {
  padding: 9px 15px 8px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--header-actions-border);
  font-size: 18px;
  .star {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
  }
  .icon {
    cursor: pointer;
    transition: transform 120ms cubic-bezier(.2,.8,.2,1), background 120ms ease;
    &:active { transform: scale(.9); }
  }
}

.detail-ai { display: inline-flex; }

.move-category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 132px;
}


.scrollbar {
  height: calc(100% - 38px);
  width: 100%;
}

.container {
  font-size: 14px;
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 10px;
  @media (max-width: 1023px) {
    padding-left: 15px;
    padding-right: 15px;
  }

  .email-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .htm-scrollbar {
  }

  .content {
    display: flex;
    flex-direction: column;

    .att {
      margin-top: 30px;
      margin-bottom: 30px;
      border: 1px solid var(--light-border-color);
      padding: 14px;
      border-radius: 6px;
      width: fit-content;
      .att-box {
        min-width: min(410px,calc(100vw - 60px));
        max-width: 600px;
        display: grid;
        gap: 12px;
        grid-template-rows: 1fr;
      }

      .att-title {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        span:first-child {
          font-weight: bold;
        }
      }

      .att-item {
        cursor: pointer;
        div {
          align-self: center;
        }
        background: var(--light-ill);
        padding: 5px 7px;
        border-radius: 4px;
        align-self: start;
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        .att-icon {
          display: grid;
        }

        .att-size {
          color: var(--secondary-text-color);
        }

        .att-name {
          margin-left: 8px;
          margin-right: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-all;
        }

        .att-image {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }

        .opt-icon {
          padding-left: 10px;
          color: var(--secondary-text-color);
          align-items: center;
          display: flex;
          gap: 8px;
          cursor: pointer;
          a {
            color: var(--secondary-text-color);
            align-items: center;
            display: flex;
          }
        }
      }
    }

    .email-info {

      border-bottom: 1px solid var(--light-border-color);
      margin-bottom: 20px;
      padding-bottom: 8px;
      @media (max-width: 1024px) {
        margin-bottom: 15px;
      }
      .date {
        color: var(--regular-text-color);
        margin-bottom: 6px;
      }

      .email-msg {
        max-width: 400px;
        width: fit-content;
        margin-bottom: 15px;
      }

      .send {
        display: flex;
        margin-bottom: 6px;

        .send-name {
          color: var(--regular-text-color);
          display: flex;
          flex-wrap: wrap;
        }

        .send-name-title {
          padding-right: 5px;
        }

        .add-contact-inline {
          margin-left: 8px;
          align-self: center;
          color: var(--label-3);
          cursor: pointer;

          &:hover {
            color: var(--blue);
          }
        }
      }

      .receive {
        margin-bottom: 6px;
        display: flex;
        .receive-email {
          max-width: 700px;
          word-break: break-word;
        }
        span:nth-child(2) {
          color: var(--regular-text-color);
        }
      }

      .send-source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }

      .source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }
    }
  }
}

.shadow-html::after  {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--message-block-color); /* 半透明黑色蒙层 */
  pointer-events: none; /* 不影响点击 */
}

.email-text {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.bottom-distance {
  margin-bottom: 30px;
}



.email-info { display:flex !important; gap:13px; align-items:flex-start; flex-wrap:wrap; }
.email-info-main { flex:1 1 280px; min-width:0; }
.reader-avatar { flex:0 0 48px; width:48px; height:48px; padding:2px; border-radius:50%; background:conic-gradient(from 210deg,#6ee7ff,#7c7bff,#d56bff,#6ee7ff); box-shadow:0 0 0 1px var(--rd-panel),0 0 18px rgba(124,123,255,.20); }
.reader-avatar > span { width:100%; height:100%; display:grid; place-items:center; border-radius:50%; background:var(--rd-panel); color:var(--rd-text); font-size:13px; font-weight:750; }
.reader-summary-btn { height:30px; padding:0 11px; border:1px solid var(--rd-line); border-radius:9px; background:var(--rd-panel); color:var(--rd-text); display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:650; cursor:pointer; }
.reader-summary-btn:hover,.reader-summary-btn.active { background:var(--rd-accent-weak); border-color:var(--rd-accent); color:var(--rd-accent); }
.ai-summary-card { margin: 0 0 18px; padding: 14px 16px; border:1px solid color-mix(in srgb, var(--rd-accent) 28%, var(--rd-line)); border-radius:13px; background:linear-gradient(135deg, color-mix(in srgb, var(--rd-accent) 8%, var(--rd-panel)), var(--rd-panel)); }
.ai-summary-head { display:flex; align-items:center; gap:7px; color:var(--rd-accent); }
.ai-summary-head b { font-size:12px; color:var(--rd-text); }
.ai-summary-head span { font-size:10px; color:var(--rd-muted); }
.summary-refresh,.summary-close { margin-left:auto; border:0; background:transparent; color:var(--rd-muted); cursor:pointer; width:24px; height:24px; border-radius:7px; }
.summary-close { margin-left:2px; font-size:18px; }
.summary-refresh:hover,.summary-close:hover { background:var(--fill-quaternary); color:var(--rd-text); }
.ai-summary-text,.ai-summary-loading,.ai-summary-error { margin-top:8px; font-size:12px; line-height:1.75; color:var(--rd-muted); white-space:pre-wrap; }
.ai-summary-error { color:#d9534f; }
.spinning { animation: spin 1s linear infinite; }
</style>

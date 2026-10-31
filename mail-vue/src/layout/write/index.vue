<template>
  <div class="send" v-show="show">
    <div class="write-box">
      <div class="title">
        <div class="title-left">
          <span class="title-text">
            <Icon icon="hugeicons:quill-write-01" width="28" height="28"/>
          </span>
          <span class="sender">{{ $t('sender') }}:</span>
          <el-select
              v-model="form.accountId"
              class="compose-account"
              popper-class="compose-account-popper"
              size="small"
              :teleported="false"
              @change="changeComposeAccount"
          >
            <el-option
                v-for="item in composeAccounts"
                :key="item.accountId"
                :label="item.email"
                :value="item.accountId"
            />
          </el-select>
        </div>
        <div @click="close" style="cursor: pointer;">
          <Icon icon="material-symbols-light:close-rounded" width="22" height="22"/>
        </div>
      </div>
      <div class="container">
        <el-input-tag :key="recipientInputKey" @add-tag="addTagChange" tag-type="primary" @input="inputChange" size="default" v-model="form.receiveEmail" >
          <template #prefix>
            <div class="item-title" >{{ $t('recipient') }}</div>
            <el-select
                ref="mySelect"
                class="write-select"
                popper-class="write-select"
                :show-arrow="false"
                :no-match-text="' '"
                :no-data-text="' '"
                @visible-change="selectStatusChange"
                @change="selectChange"
            >
              <el-option
                  v-for="item in selectRecipientList"
                  :key="item"
                  :label="contactLabel(item)"
                  :value="item"
                  style="color: #999896;"
                  @mousedown.prevent
                  @click.stop="selectChange(item)"
              />
            </el-select>
          </template>
          <template #suffix>
            <div style="display: flex;align-items: center;margin-right: 3px;">
              <span class="cc-toggle" :class="{ 'is-open': showCc }" @click.stop="showCc = !showCc">{{ $t('cc') }}</span>
              <span class="cc-toggle" :class="{ 'is-open': showBcc }" @click.stop="showBcc = !showBcc">{{ $t('bcc') }}</span>
              <Icon icon="fa7-solid:user-plus" width="20" height="20" class="add-contact" @click.stop="openContacts('to')" />
            </div>
          </template>
        </el-input-tag>
        <el-input-tag class="cc-input" v-if="showCc" v-model="form.cc" tag-type="info">
          <template #prefix>
            <div class="item-title">{{ $t('cc') }}</div>
          </template>
          <template #suffix>
            <Icon icon="fa7-solid:user-plus" width="20" height="20" class="add-contact" @click.stop="openContacts('cc')" />
          </template>
        </el-input-tag>
        <el-input-tag class="cc-input" v-if="showBcc" v-model="form.bcc" tag-type="info">
          <template #prefix>
            <div class="item-title">{{ $t('bcc') }}</div>
          </template>
          <template #suffix>
            <Icon icon="fa7-solid:user-plus" width="20" height="20" class="add-contact" @click.stop="openContacts('bcc')" />
          </template>
        </el-input-tag>
        <el-input v-model="form.subject" :placeholder="t('subject')" />
        <tinyEditor :def-value="defValue" ref="editor" @change="change" @focus="focusChange" />
        <div class="button-item">
          <div class="att-add" @click="chooseFile">
            <Icon icon="iconamoon:attachment-fill" width="24" height="24"/>
          </div>
          <div class="att-clear" @click="clearContent">
            <Icon icon="icon-park-outline:clear-format" width="24" height="24 "/>
          </div>
          <div class="att-list">
            <div class="att-item" v-for="(item,index) in form.attachments" :key="index">
              <Icon v-bind="getIconByName(item.filename)"/>
              <span class="att-filename">{{ item.filename }}</span>
              <span class="att-size">{{ formatBytes(item.size) }}</span>
              <Icon style="cursor: pointer;" icon="material-symbols-light:close-rounded" @click="delAtt(index)"
                    width="22" height="22"/>
            </div>
          </div>
          <button type="button" class="ai-compose-btn" @click="openComposeAi">
            <Icon icon="mdi:star-four-points" width="15" height="15"/> AI
          </button>
          <div>
            <el-button type="primary" @click="sendEmail" v-if="form.sendType === 'reply'">{{ $t('reply') }}</el-button>
            <el-button type="primary" @click="sendEmail" v-else-if="form.sendType === 'forward'">{{ $t('forward') }}</el-button>
            <el-button type="primary" @click="sendEmail" v-else>{{ $t('send') }}</el-button>
          </div>
        </div>
      </div>
    </div>
    <el-dialog top="10vh" v-model="showContacts" @closed="clearSelectContact" :title="t('recentContacts')">
      <el-table ref="contactsTabRef" row-key="email" :data="contacts" style="height: 445px" @cell-click="cellClick">
        <el-table-column type="selection" width="32" />
        <el-table-column property="email" :label="t('emailAccount')" >
          <template #default="props">
            <div class="email-row">{{ props.row.email }}</div>
          </template>
        </el-table-column>
        <el-table-column width="55" label="" >
          <template #default>
            <div style="display: flex;">
              <Icon icon="mage:user" style="color: var(--el-text-color-primary)" width="22" height="22" color="#606266" />
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="contacts-bottom">
        <el-button type="default" @click="deleteContact">{{t('clear')}}</el-button>
        <el-button type="primary" @click="chooseContact">{{t('selectContacts')}}</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import tinyEditor from '@/components/tiny-editor/index.vue'
import {h, nextTick, onMounted, onUnmounted, reactive, ref, toRaw, computed} from "vue";
import {Icon} from "@iconify/vue";
import {useUserStore} from "@/store/user.js";
import {emailSend} from "@/request/email.js";
import {isEmail} from "@/utils/verify-utils.js";
import {useAccountStore} from "@/store/account.js";
import {accountList} from "@/request/account.js";
import {useEmailStore} from "@/store/email.js";
import {fileToBase64, formatBytes} from "@/utils/file-utils.js";
import {getIconByName} from "@/utils/icon-utils.js";
import sendPercent from "@/components/send-percent/index.vue"
import {toOssDomain} from "@/utils/convert.js";
import {formatDetailDate} from "@/utils/day.js";
import {marked} from "marked";
import DOMPurify from "dompurify";
import {contactList} from "@/request/contact.js";
import {useSettingStore} from "@/store/setting.js";
import {userDraftStore} from "@/store/draft.js";
import {useWriterStore} from "@/store/writer.js";
import db from "@/db/db.js";
import dayjs from "dayjs";
import {useI18n} from "vue-i18n";
import router from "@/router/index.js";
import {clearToken} from "@/utils/token-store.js";
import {ElMessageBox} from "element-plus";

defineExpose({
  open,
  openReply,
  openForward,
  openDraft,
  openAiReply,
  openReplyAll
})

const {t} = useI18n()
const writerStore = useWriterStore();
const draftStore = userDraftStore()
const settingStore = useSettingStore()
const emailStore = useEmailStore();
const accountStore = useAccountStore()
const editor = ref({})
const userStore = useUserStore();
const show = ref(false);
const percent = ref(0)
let percentMessage = null
let sending = false
const defValue = ref('')
const contactsTabRef = ref({})
const showContacts = ref(false)
const showCc = ref(false)
const showBcc = ref(false)
const mySelect = ref()
let selectStatus = false
const backReply = reactive({
  receiveEmail: [],
  subject: '',
  content: '',
  sendType: ''
})
const form = reactive({
  sendEmail: '',
  receiveEmail: [],
  cc: [],
  bcc: [],
  accountId: -1,
  name: '',
  subject: '',
  content: '',
  sendType: '',
  text: '',
  emailId: 0,
  attachments: [],
  draftId: null,
})

const selectRecipientList = ref([])
const composeAccounts = ref([])
const recipientInputKey = ref(0)
const contactTarget = ref('to')

function currentSender() {
  if (accountStore.currentAccount.email) {
    return accountStore.currentAccount
  }
  return {...userStore.user.account, email: userStore.user.email, name: userStore.user.name}
}

function changeComposeAccount(accountId) {
  const account = composeAccounts.value.find(item => item.accountId === accountId)
  if (!account) return
  form.sendEmail = account.email
  form.name = account.name
}

async function loadComposeAccounts() {
  const current = currentSender()
  composeAccounts.value = [{...current, email: current.email}]
  try {
    const list = await accountList(0, 100, null)
    const merged = new Map([[current.accountId, composeAccounts.value[0]]])
    list.forEach(item => merged.set(item.accountId, item))
    composeAccounts.value = [...merged.values()]
  } catch (e) {
    // Keep the current account selectable if the account list is unavailable.
  }
}

const contactBook = ref([])
onMounted(() => {
  contactList('', '').then(data => {
    contactBook.value = data.list || []
  }).catch(() => {})
})

// 联系人簿 + 最近收件人合并；同一邮箱只出现一次
const contacts = computed(() => {
  const seen = new Set()
  const list = []
  contactBook.value.forEach(item => {
    if (!item.email || seen.has(item.email)) return
    seen.add(item.email)
    list.push({email: item.email, name: item.name, groupName: item.groupName, remark: item.remark})
  })
  writerStore.sendRecipientRecord.forEach(email => {
    if (!email || seen.has(email)) return
    seen.add(email)
    list.push({email})
  })
  return list
})

function targetRecipients() {
  if (contactTarget.value === 'cc') return form.cc
  if (contactTarget.value === 'bcc') return form.bcc
  return form.receiveEmail
}

function openContacts(target = 'to') {
  contactTarget.value = target
  showContacts.value = true
  contactList('', '').then(data => {
    contactBook.value = data.list || []
  }).catch(() => {})
  nextTick(() => {
    targetRecipients().forEach(item => {
      const row = contacts.value.find(contact => contact.email === item)
      if (row) {
        contactsTabRef.value.toggleRowSelection(row)
      }
    })
  })
}

function deleteContact() {
  ElMessageBox.confirm(t('confirmDeletionOfContacts'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    const selected = contactsTabRef.value.getSelectionRows().map(item => item.email);
    const target = targetRecipients()
    const kept = target.filter(item => !selected.includes(item))
    if (contactTarget.value === 'cc') form.cc = kept
    else if (contactTarget.value === 'bcc') form.bcc = kept
    else form.receiveEmail = kept
    writerStore.sendRecipientRecord = writerStore.sendRecipientRecord.filter(item => !selected.includes(item));
  })
}

function chooseContact() {
  const selected = contactsTabRef.value.getSelectionRows().map(item => item.email);
  const target = targetRecipients()
  selected.forEach(item => {
    if (!target.includes(item)) target.push(item);
  })
  showContacts.value = false
}

function clearSelectContact() {
  contactsTabRef.value.clearSelection();
}

function cellClick(row, column) {
  if (column?.type === 'selection') return
  contactsTabRef.value.toggleRowSelection(row)
}

function selectChange(value) {
  if (!value) return
  if (!form.receiveEmail.includes(value)) {
    form.receiveEmail.push(value)
  }
  selectRecipientList.value = []
  selectStatus = false
  recipientInputKey.value++
}

function selectStatusChange(status) {
  selectStatus = status
}

const openSelect = () => {
  mySelect.value.toggleMenu()
}

function contactLabel(email) {
  const contact = contacts.value.find(item => item.email === email)
  return contact?.name ? `${contact.name} <${email}>` : email
}

function inputChange(value) {

  const keyword = (value || '').toLowerCase()
  const book = contacts.value.map(item => item.email)
  const all = [...new Set([...writerStore.sendRecipientRecord, ...book])]
  selectRecipientList.value = all
      .filter(item => keyword && !form.receiveEmail.includes(item) && (item.toLowerCase().includes(keyword) || contactLabel(item).toLowerCase().includes(keyword)))
      .slice(0, 10);

  if (!selectStatus && selectRecipientList.value.length > 0) {
    openSelect()
  }

  if (selectStatus && selectRecipientList.value.length === 0) {
    openSelect()
  }

}

function addTagChange(val) {

  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  form.receiveEmail.splice(form.receiveEmail.length - 1, 1)

  let has = false
  emails.forEach(email => {
    if (isEmail(email) && !form.receiveEmail.includes(email)) {
      form.receiveEmail.push(email)
      has = true
    }
  })
  if (selectStatus && has) openSelect()
}

function clearContent() {
  ElMessageBox.confirm(t('clearContentConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    resetForm()
  })

}

function delAtt(index) {
  form.attachments.splice(index, 1);
}

function chooseFile() {
  const doc = document.createElement("input")
  doc.setAttribute("type", "file")
  doc.multiple = true;
  doc.click()
  doc.onchange = async (e) => {

    const fileList = e.target.files;

    for (const file of fileList) {

      const size = file.size
      const filename = file.name
      const contentType = file.type

      const content = await fileToBase64(file)
      form.attachments.push({content, filename, size, contentType})

    }

  }
}

async function sendEmail() {

  if (form.receiveEmail.length === 0) {
    ElMessage({
      message: t('emptyRecipientMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.subject) {
    ElMessage({
      message: t('emptySubjectMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.content) {
    form.content = editor.value.getContent();
  }

  if (!form.content) {
    ElMessage({
      message: t('emptyContentMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.manyType === 'divide' && form.attachments.length > 0) {
    ElMessage({
      message: t('noSeparateSendMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if ([...form.cc, ...form.bcc].some(item => !isEmail(item))) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (sending) {
    ElMessage({
      message: t('sendingErrorMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  percentMessage = ElMessage({
    message: () => h(sendPercent, {value: percent.value, desc: t('sending')}),
    dangerouslyUseHTMLString: true,
    plain: true,
    duration: 0,
    customClass: 'message-bottom'
  })

  sending = true

  show.value = false

  emailSend(form, (e) => {
    percent.value = Math.round((e.loaded * 98) / e.total)
  }).then(emailList => {
    const email = emailList[0]
    emailList.forEach(item => {
      emailStore.sendScroll?.addItem(item)
    })

    ElNotification({
      title: t('sendSuccessMsg'),
      type: "success",
      message: h('span', {style: 'color: teal'}, email.subject),
      position: 'bottom-right'
    })

    userStore.refreshUserInfo();

    addRecipientRecord();

    if (form.draftId) {
      form.subject = ''
      form.content = ''
      form.receiveEmail = []
      draftStore.setDraft = {...toRaw(form)}
    }

    show.value = false
    resetForm();
  }).catch((e) => {
    ElNotification({
      title: t('sendFailMsg'),
      type: e.code === 403 ? 'warning' : 'error',
      message: h('span', {style: 'color: teal'}, e.message),
      position: 'bottom-right'
    })
    if (e.code === 401) {
      clearToken();
      router.replace('/login');
    }
    show.value = true
    addRecipientRecord();
  }).finally(() => {
    percentMessage.close()
    percent.value = 0
    sending = false
  })
}

function addRecipientRecord() {
  writerStore.sendRecipientRecord = writerStore.sendRecipientRecord.filter(
      email => !form.receiveEmail.includes(email)
  );

  writerStore.sendRecipientRecord.unshift(...form.receiveEmail);
  writerStore.sendRecipientRecord = writerStore.sendRecipientRecord.slice(0, 500);
}

function resetForm() {
  form.receiveEmail = []
  form.cc = []
  form.bcc = []
  showCc.value = false
  showBcc.value = false
  form.subject = ''
  form.content = ''
  form.manyType = null
  form.attachments = []
  form.sendType = ''
  form.emailId = 0
  form.draftId = null
  backReply.content = ''
  backReply.subject = ''
  backReply.receiveEmail = []
  backReply.sendType = ''
  editor.value.clearEditor()
}

function change(content, text) {
  form.content = content;
  form.text = text
}

function focusChange() {
  if (selectStatus) openSelect()
}

function openForward(email) {
  resetForm();

  email.subject = email.subject || ''

  form.subject = email.subject
  form.sendType = 'forward'

  defValue.value = ''

  setTimeout(() => {
    defValue.value = `
      ${signatureHtml()}
      ${formatImage(email.content) || `<pre style="font-family: inherit;word-break: break-word;white-space: pre-wrap;margin: 0">${email.text}</pre>`}
    `
    open()

    nextTick(() => {
      backReply.content = editor.value.getContent()
      backReply.subject = form.subject
      backReply.receiveEmail = form.receiveEmail
      backReply.sendType = form.sendType
    })

  });
}

function openReply(email) {

  resetForm();

  email.subject = email.subject || ''

  form.receiveEmail.push(email.sendEmail)
  form.subject = (
      email.subject.startsWith('Re:') ||
      email.subject.startsWith('Re：') ||
      email.subject.startsWith('回复：') ||
      email.subject.startsWith('回复:')) ? email.subject : 'Re: ' + email.subject
  form.sendType = 'reply'
  form.emailId = email.emailId

  defValue.value = ''

  setTimeout(() => {
    defValue.value = `
    <div></div>
    ${signatureHtml()}
    <div>
    <br>
        ${formatDetailDate(email.createTime)} ${email.name} &lt${email.sendEmail}&gt ${t('wrote')}:
    </div>
    <blockquote class="mceNonEditable" style="margin: 0 0 0 0.8ex;border-left: 1px solid rgb(204,204,204);padding-left: 1ex;">
      <articl>
          ${formatImage(email.content) || `<pre style="font-family: inherit;word-break: break-word;white-space: pre-wrap;margin: 0">${email.text}</pre>`}
      </article>
    </blockquote>`
    open()

    nextTick(() => {
      backReply.content = editor.value.getContent()
      backReply.subject = form.subject
      backReply.receiveEmail = form.receiveEmail
      backReply.sendType = form.sendType
    })
  })

}

// AI 回复：保留原邮件收件人/主题，正文用 AI 草稿替换（不覆盖引用）
function openReplyAll(email) {
  openReply(email)
  const add = []
  const push = value => {
    const address = typeof value === 'string' ? value : value?.address
    if (address && !add.includes(address)) add.push(address)
  }
  const parse = value => {
    if (Array.isArray(value)) return value
    try { return JSON.parse(value || '[]') } catch { return [] }
  }
  parse(email?.recipient).forEach(push)
  parse(email?.cc).forEach(push)
  const own = form.sendEmail || accountStore.currentAccount.email || userStore.user.email
  add.forEach(address => {
    if (address !== own && address !== email?.sendEmail && !form.receiveEmail.includes(address) && !form.cc.includes(address)) form.cc.push(address)
  })
  showCc.value = form.cc.length > 0
}

function openAiReply(email, text) {
  resetForm()
  if (!email) return
  email.subject = email.subject || ''
  form.receiveEmail.push(email.sendEmail)
  form.subject = /^(Re:|Re：|回复：|回复:)/.test(email.subject) ? email.subject : 'Re: ' + email.subject
  form.sendType = 'reply'
  form.emailId = email.emailId
  defValue.value = signatureHtml() + String(text || '')
      .split('\n')
      .map(line => `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</div>`)
      .join('')
  open()
}

function signatureHtml() {
  const text = String(userStore.user?.signature || '').trim()
  if (!text) return ''
  const html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  return `<div class="mail-signature"><br><div>--</div><div>${html}</div></div>`
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function open() {
  const sender = currentSender()
  form.sendEmail = sender.email;
  form.accountId = sender.accountId;
  form.name = sender.name;
  loadComposeAccounts()
  if (!form.sendType) defValue.value = signatureHtml()
  show.value = true;
  editor.value.focus()
}

function openDraft(draft) {
  Object.assign(form, {...draft})
  loadComposeAccounts()
  showCc.value = form.cc?.length > 0
  showBcc.value = form.bcc?.length > 0
  defValue.value = ''
  setTimeout(() => defValue.value = form.content)
  show.value = true;
  editor.value.focus()
}

const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    close()
  }
};

function plainEditorText() {
  const html = editor.value?.getContent?.() || form.content || ''
  return String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function openComposeAi() {
  document.body.classList.add('compose-ai-open')
  window.dispatchEvent(new CustomEvent('otsmail:ai-compose', {detail: {text: form.text || plainEditorText(), emailId: form.emailId || 0, subject: form.subject || ''}}))
}

function onAiFill(event) {
  const text = String(event.detail?.text || '').trim()
  if (!text || !editor.value) return
  const html = DOMPurify.sanitize(marked.parse(text))
  const current = editor.value.getContent?.() || ''
  // Keep the existing signature/quoted reply below the generated body.
  editor.value.setContent(html + current)
  form.content = editor.value.getContent()
  form.text = text
  document.body.classList.remove('compose-ai-open')
  nextTick(() => editor.value?.focus())
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('otsmail:ai-fill', onAiFill)
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('otsmail:ai-fill', onAiFill)
});

function close() {

  if (selectStatus) openSelect();

  if (!form.content) {
    form.content = editor.value.getContent();
  }

  if (form.draftId) {
    draftStore.setDraft = {...toRaw(form)}
    show.value = false
    resetForm()
    return;
  }

  if (!(form.content || form.subject || form.receiveEmail.length > 0)) {
    show.value = false
    resetForm()
    return;
  }

  if (backReply.sendType === 'reply' || backReply.sendType === 'forward') {
    let subjectFlag = form.subject === backReply.subject
    let contentFlag = editor.value.getContent() === backReply.content
    let receiveFlag = form.receiveEmail.length === 1 && form.receiveEmail[0] === backReply.receiveEmail[0]
    if (backReply.sendType === 'forward' && form.receiveEmail.length === 0) {
      receiveFlag = true;
    }
    if (subjectFlag && contentFlag && receiveFlag) {
      resetForm();
      close()
      return;
    }
  }

  ElMessageBox.confirm(t('saveDraftConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning',
    distinguishCancelAndClose: true
  }).then(async () => {
    const formData = {...toRaw(form)};
    delete formData.draftId
    delete formData.attachments
    formData.createTime = dayjs().utc().format('YYYY-MM-DD HH:mm:ss');
    const draftId = await db.value.draft.add({...formData})
    db.value.att.add({draftId, attachments: toRaw(form.attachments)})
    draftStore.refreshList++
    show.value = false
    await nextTick(() => {
      resetForm()
    })
  }).catch((action) => {
    if (action === 'cancel') {
      show.value = false
      resetForm()
    }
  })

}

</script>
<style>
.write-select .el-select-dropdown__list {
  padding: 4px 4px !important;
}
.write-select .el-select-dropdown__item {
  padding: 0 10px 0 10px;
}

.write-select .el-select-dropdown {
  min-width: 0 !important;
}

.compose-account-popper.el-select__popper.el-popper {
  border: 1px solid #e4e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(32, 33, 36, .12);
}

.compose-account :deep(.el-select__wrapper) {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e4e7eb inset;
  padding: 2px 8px;
}

.compose-account-popper .el-select-dropdown__item {
  margin: 2px 6px;
  border-radius: 8px;
  background: #fff !important;
}

.compose-account-popper .el-select-dropdown__item.is-selected,
.compose-account-popper .el-select-dropdown__item.is-selected.is-hovering {
  color: var(--label) !important;
  background: #fff !important;
  font-weight: 600;
}

.compose-account-popper .el-select-dropdown__item.is-hovering {
  background: #f5f6f7 !important;
}
</style>
<style scoped lang="scss">
.send {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .write-box {
    background: var(--el-bg-color);
    width: min(1367px, calc(100% - 80px));
    box-shadow: var(--el-box-shadow-light);
    border: 1px solid var(--el-border-color-light);
    transition: var(--el-transition-duration);
    padding: 15px;
    border-radius: 8px;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    @media (max-width: 1024px) {
      width: 100%;
      height: 100%;
      border-radius: 0;
      border: 0;
      padding-top: 10px;
    }

    @media (min-width: 1025px) {
      height: min(800px, calc(100vh - 60px));
    }

    .title {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;

      .title-left {
        align-items: center;
        display: grid;
        grid-template-columns: auto auto auto 1fr;
      }

      .title-text {
      }

      .sender {
        margin-left: 8px;
      }

      .sender-name {
        margin-left: 8px;
        font-weight: bold;
      }

      .send-email {
        color: #999896;
        margin-left: 5px;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .compose-account {
        width: 230px;
        margin-left: 5px;
      }

      .compose-account :deep(.el-select__wrapper) {
        width: 100%;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 0 0 1px #e4e7eb inset;
        padding: 2px 8px;
      }

      .compose-account :deep(.el-select__selection) {
        flex: 1;
        min-width: 0;
      }

      .compose-account :deep(.el-select__placeholder) {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }


      div {
        display: flex;
        align-items: center;
      }
    }

    .container {
      height: 100%;
      /* flex, not a fixed row count: the cc/bcc rows are optional */
      display: flex;
      flex-direction: column;
      gap: 15px;

      .cc-input {
        flex: 0 0 auto;
      }

      /* editor takes the leftover height; scoped height:100% would overflow the flex parent */
      :deep(.editor-box) {
        flex: 1 1 auto;
        min-height: 0;
        height: auto;
      }

      .item-title {
      }

      .button-item {
        display: grid;
        grid-template-columns: auto auto 1fr auto auto;
        align-items: center;
        gap: 8px;

        .ai-compose-btn {
          height: 30px; padding: 0 10px; border: 1px solid var(--rd-line, var(--el-border-color));
          border-radius: 9px; background: var(--rd-panel-2, transparent); color: var(--rd-text, var(--el-text-color-primary));
          display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 650; cursor: pointer;
        }
        .ai-compose-btn:active { transform: scale(.95); }

        .att-add {
          cursor: pointer;
        }

        .att-clear {
          cursor: pointer;
          margin-left: 10px;
        }

        .att-list {
          display: grid;
          gap: 5px;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          padding-left: 10px;
          padding-right: 10px;
          max-height: 110px;
          overflow-y: auto;
          @media (max-width: 450px) {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          }

          .att-item {
            display: grid;
            grid-template-columns: auto 1fr auto auto;
            gap: 5px;
            height: 32px;
            font-size: 14px;
            padding: 4px 5px;
            background: var(--light-ill);
            border-radius: 4px;
            .att-filename {
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
            }
          }
        }
      }
    }
  }

}

.email-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-dialog) {
  width: 420px !important;
  @media (max-width: 460px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

.contacts-bottom {
  display: flex;
  justify-content: end;
  margin-top: 10px;
}

.add-contact {
  color: var(--regular-text-color)
}

.write-select {
  position: absolute;
  width: 300px;
  left: 60px;
  z-index: 0;
  opacity: 0;
  pointer-events: none;
}

:deep(.el-input-tag__suffix) {
  padding-right: 4px;
}

.icon {
  cursor: pointer;
}
</style>

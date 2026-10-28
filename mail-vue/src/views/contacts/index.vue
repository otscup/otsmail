<template>
  <div class="contacts">
    <div class="contacts__bar">
      <el-button type="primary" class="contacts__new" @click="openAdd">
        <Icon icon="ion:add-outline" width="18" height="18"/>
        <span class="contacts__new-text">{{ $t('contactNew') }}</span>
      </el-button>
    </div>

    <div class="contacts__chips">
      <button class="chip" :class="{'chip--on': group === ''}" @click="pickGroup('')">{{ $t('all') }}</button>
      <button
          v-for="item in groups"
          :key="item"
          class="chip"
          :class="{'chip--on': group === item}"
          @click="pickGroup(item)">{{ item }}
      </button>
    </div>

    <div class="contacts__card">
      <div class="row" v-for="item in list" :key="item.contactId">
        <div class="row__avatar">{{ initial(item) }}</div>
        <div class="row__main">
          <div class="row__name">{{ item.name || item.email }}</div>
          <div class="row__email">{{ item.email }}</div>
          <div class="row__meta">{{ item.groupName }}<template v-if="item.remark"> · {{ item.remark }}</template></div>
        </div>
        <div class="row__ops">
          <Icon icon="fluent:edit-16-regular" width="18" height="18" @click="openEdit(item)"/>
          <Icon icon="fluent:delete-16-regular" width="18" height="18" @click="remove(item)"/>
        </div>
      </div>

      <div class="empty" v-if="!loading && list.length === 0">
        <div class="empty__title">{{ $t('contactEmpty') }}</div>
        <div class="empty__desc">{{ $t('contactEmptyDesc') }}</div>
      </div>
    </div>

    <el-dialog v-model="showForm" :title="form.contactId ? $t('contactEdit') : $t('contactNew')" width="420px">
      <div class="form">
        <el-input v-model="form.name" :placeholder="$t('contactName')"/>
        <el-input v-model="form.email" :placeholder="$t('contactEmail')"/>
        <el-select v-model="form.groupName" filterable allow-create default-first-option
                   :placeholder="$t('contactGroup')" class="form__group">
          <el-option v-for="item in groupOptions" :key="item" :label="item" :value="item"/>
        </el-select>
        <el-input v-model="form.remark" type="textarea" :rows="2" :placeholder="$t('contactRemark')"/>
      </div>
      <template #footer>
        <el-button @click="showForm = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ $t('save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";
import { contactAdd, contactDelete, contactList, contactSet } from "@/request/contact.js";

defineOptions({
  name: 'contacts'
})

const {t} = useI18n()

const DEFAULT_GROUP = '默认'

const keyword = ref('')
const group = ref('')
const list = reactive([])
const groups = reactive([])
const loading = ref(true)
const saving = ref(false)
const showForm = ref(false)

const form = reactive({
  contactId: null,
  name: '',
  email: '',
  groupName: '',
  remark: ''
})

// 已有分组 + 默认分组，去重
const groupOptions = computed(() => {
  const set = new Set([...groups, DEFAULT_GROUP])
  if (form.groupName) {
    set.add(form.groupName)
  }
  return [...set]
})

function initial(item) {
  const text = (item.name || item.email || '?').trim()
  return text.charAt(0).toUpperCase()
}

function load() {
  loading.value = true
  contactList(keyword.value, group.value).then(data => {
    list.length = 0
    list.push(...(data.list || []))
    groups.length = 0
    groups.push(...(data.groups || []))
  }).finally(() => {
    loading.value = false
  })
}

function onGlobalSearch(event) {
  keyword.value = event.detail?.text || ''
  group.value = ''
  load()
}

onMounted(() => {
  window.addEventListener('otsmail:search', onGlobalSearch)
  load()
})

onUnmounted(() => {
  window.removeEventListener('otsmail:search', onGlobalSearch)
})

function pickGroup(name) {
  group.value = name
  load()
}

function resetForm() {
  form.contactId = null
  form.name = ''
  form.email = ''
  form.groupName = groups[0] || DEFAULT_GROUP
  form.remark = ''
}

function openAdd() {
  resetForm()
  showForm.value = true
}

function openEdit(item) {
  form.contactId = item.contactId
  form.name = item.name
  form.email = item.email
  form.groupName = item.groupName
  form.remark = item.remark
  showForm.value = true
}

function submit() {
  if (saving.value) return
  if (!form.email.trim()) {
    ElMessage({message: t('contactEmail'), type: 'error', plain: true})
    return
  }

  saving.value = true
  const request = form.contactId ? contactSet : contactAdd
  request({...form}).then(() => {
    showForm.value = false
    ElMessage({message: t('addSuccessMsg'), type: 'success', plain: true})
    load()
  }).finally(() => {
    saving.value = false
  })
}

function remove(item) {
  ElMessageBox.confirm(t('contactDeleteConfirm', {email: item.email}), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    contactDelete(item.contactId).then(() => {
      ElMessage({message: t('delSuccessMsg'), type: 'success', plain: true})
      load()
    })
  })
}

</script>

<style scoped>
.contacts {
  height: 100%;
  overflow-y: auto;
  padding: var(--space-4);
  background: var(--bg-grouped);
  box-sizing: border-box;
}

.contacts__bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.contacts__search {
  flex: 1;
  max-width: 420px;
}

.contacts__new {
  flex: none;
  min-height: 40px;
}

.contacts__new-text {
  margin-left: var(--space-1);
}

.contacts__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.chip {
  border: none;
  border-radius: var(--radius-pill);
  padding: 6px var(--space-3);
  min-height: 32px;
  background: var(--fill-quaternary);
  color: var(--label-2);
  font-size: var(--text-subhead);
  line-height: var(--lh-subhead);
  cursor: pointer;
  transition: background-color var(--dur-fade) var(--ease-ios), color var(--dur-fade) var(--ease-ios);
}

.chip:hover {
  background: var(--fill-tertiary);
}

.chip--on {
  background: var(--blue);
  color: #fff;
}

.contacts__card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--row-height-list);
  padding: var(--space-2) var(--space-4);
  border-bottom: 0.5px solid var(--separator);
  transition: background-color var(--dur-fade) var(--ease-ios);
}

.row:last-child {
  border-bottom: none;
}

.row:hover {
  background: var(--fill-quaternary);
}

.row__avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fill-tertiary);
  color: var(--blue);
  font-size: var(--text-headline, 17px);
  font-weight: var(--weight-semibold);
}

.row__main {
  flex: 1;
  min-width: 0;
}

.row__name {
  color: var(--label);
  font-size: var(--text-body);
  line-height: var(--lh-body);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__email {
  color: var(--label-2);
  font-size: var(--text-subhead);
  line-height: var(--lh-subhead);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__meta {
  color: var(--label-3);
  font-size: var(--text-footnote);
  line-height: var(--lh-footnote);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row__ops {
  flex: none;
  display: flex;
  gap: var(--space-3);
  color: var(--label-3);
  cursor: pointer;
}

.row__ops svg:hover {
  color: var(--blue);
}

.empty {
  padding: var(--space-11) var(--space-4);
  text-align: center;
}

.empty__title {
  color: var(--label);
  font-size: var(--text-body);
  line-height: var(--lh-body);
  margin-bottom: var(--space-1);
}

.empty__desc {
  color: var(--label-3);
  font-size: var(--text-footnote);
  line-height: var(--lh-footnote);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form__group {
  width: 100%;
}
</style>

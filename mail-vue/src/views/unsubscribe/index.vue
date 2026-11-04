<template>
  <div class="unsub-page">
    <settingsTabs/>
    <div class="unsub-card">
      <div class="unsub-head">
        <div>
          <h2>{{ $t('unsubscribeManage') }}</h2>
          <p>{{ $t('unsubscribeManageDesc') }}</p>
        </div>
        <el-button :loading="loading" circle @click="load"><Icon icon="mdi:refresh" width="18"/></el-button>
      </div>
      <div v-if="loading" class="unsub-empty">{{ $t('loadingText') }}</div>
      <div v-else-if="!rows.length" class="unsub-empty">{{ $t('unsubscribeEmpty') }}</div>
      <div v-else class="unsub-list">
        <div v-for="item in rows" :key="item.sendEmail" class="unsub-row">
          <div class="unsub-avatar">{{ (item.name || item.sendEmail || '?').slice(0, 1).toUpperCase() }}</div>
          <div class="unsub-main">
            <strong>{{ item.name || item.sendEmail }}</strong>
            <small>{{ item.sendEmail }} · {{ $t('unsubscribeMailCount', { count: item.count }) }}</small>
          </div>
          <el-button size="small" type="primary" plain @click="unsubscribe(item)">{{ $t('unsubscribe') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {ElMessage} from 'element-plus'
import {Icon} from '@iconify/vue'
import settingsTabs from '@/components/settings-tabs/index.vue'
import {unsubscribeList} from '@/request/email.js'
import {useI18n} from 'vue-i18n'

defineOptions({name: 'unsubscribe'})
const {t} = useI18n()
const rows = ref([])
const loading = ref(true)

function httpTarget(value) {
  const raw = String(value || '')
  return (raw.match(/<(https?:\/\/[^>]+)>/i) || [])[1] || (raw.match(/https?:\/\/[^\s,>]+/i) || [])[0] || ''
}

async function unsubscribe(item) {
  const url = httpTarget(item.listUnsubscribe)
  if (!url) {
    const mailto = (String(item.listUnsubscribe || '').match(/<mailto:([^>]+)>/i) || [])[1]
    if (mailto) {
      window.open(`mailto:${mailto}?subject=unsubscribe`, '_blank')
      return
    }
    ElMessage.warning(t('unsubscribeNoLink'))
    return
  }
  // One-click POST 由浏览器发起，不经过 Worker，避免任意 URL 的 SSRF。
  if (/one-click/i.test(item.listUnsubscribePost || '')) {
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'List-Unsubscribe=One-Click'
      })
      ElMessage.success(t('unsubscribeSent'))
    } catch {
      window.open(url, '_blank', 'noopener')
    }
    return
  }
  window.open(url, '_blank', 'noopener')
}

async function load() {
  loading.value = true
  try {
    rows.value = await unsubscribeList()
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.unsub-page { min-height: 100%; background: var(--rd-bg, #f5f7fa); }
.unsub-card { max-width: 920px; margin: 22px auto; background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 12px; padding: 22px 24px; }
.unsub-head { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.unsub-head h2 { margin: 0 0 6px; font-size: 20px; }
.unsub-head p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
.unsub-empty { padding: 42px 0; text-align: center; color: var(--el-text-color-secondary); font-size: 13px; }
.unsub-list { display: grid; gap: 2px; }
.unsub-row { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--el-border-color-lighter); }
.unsub-avatar { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 700; }
.unsub-main { display: grid; gap: 3px; min-width: 0; }
.unsub-main strong, .unsub-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unsub-main strong { font-size: 14px; }
.unsub-main small { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 767px) {
  .unsub-card { margin: 12px; padding: 16px; }
  .unsub-row { grid-template-columns: 34px minmax(0, 1fr) auto; }
}
</style>

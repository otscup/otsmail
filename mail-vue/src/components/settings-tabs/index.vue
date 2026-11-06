<template>
  <div class="settings-tabs" role="tablist">
    <button
        v-for="tab in tabs" :key="tab.path" type="button" role="tab"
        :aria-selected="route.path === tab.path"
        :class="{ active: route.path === tab.path }"
        @click="router.push(tab.path)">{{ tab.label }}</button>
  </div>
</template>
<script setup>
import {computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useUserStore} from '@/store/user.js'
import {useI18n} from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const {t} = useI18n()
const tabs = computed(() => {
  const list = [{path: '/settings', label: t('settings')}]
  if (userStore.user?.type === 0 || userStore.user?.role?.permKeys?.includes('*')) {
    list.push({path: '/sys-setting', label: t('systemSettings')}, {path: '/mcp-admin', label: t('mcpService')})
  }
  list.push({path: '/user', label: t('accountPermissions')}, {path: '/role', label: t('role')}, {path: '/unsubscribe', label: t('unsubscribeManage')}, {path: '/reg-key', label: t('regKey')}, {path: '/analysis', label: t('analysis')})
  return list
})
</script>
<style scoped>
.settings-tabs {
  display: flex;
  gap: 4px;
  align-items: center;
  width: calc(100% - 44px);
  margin: 14px 22px 0;
  padding: 5px;
  overflow-x: auto;
  border: 1px solid var(--rd-line);
  border-radius: 12px;
  background: var(--rd-panel);
  scrollbar-width: none;
}
.settings-tabs::-webkit-scrollbar { display: none; }
.settings-tabs button {
  flex: 0 0 auto;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--rd-muted);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
  white-space: nowrap;
}
.settings-tabs button:hover { color: var(--rd-text); background: var(--rd-panel-2); }
.settings-tabs button.active { color: var(--rd-accent); background: var(--rd-accent-weak); border-color: color-mix(in srgb, var(--rd-accent) 24%, transparent); }
@media (max-width: 767px) {
  .settings-tabs { width: calc(100% - 24px); margin: 10px 12px 0; padding: 4px; }
  .settings-tabs button { padding: 7px 10px; font-size: 12px; }
}
</style>

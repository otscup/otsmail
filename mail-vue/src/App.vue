<template>
  <el-config-provider :locale="settingStore.lang === 'zh' ? zhCn : null">
    <router-view />
  </el-config-provider>
</template>
<script setup>
import { useI18n } from "vue-i18n";
import { watch, onMounted } from "vue";
import {useSettingStore} from "@/store/setting.js";
import {useUiStore} from "@/store/ui.js";
const settingStore = useSettingStore()
const uiStore = useUiStore()
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import('@/icons/index.js')
const { locale } = useI18n()
locale.value = settingStore.lang
watch(() => settingStore.lang, () => locale.value = settingStore.lang)

function applyTheme(dark) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.setAttribute('data-theme', dark ? 'dark' : 'light')
}
watch(() => uiStore.dark, (v) => applyTheme(v), { immediate: true })
onMounted(() => applyTheme(uiStore.dark))
</script>
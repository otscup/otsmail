<template>
  <el-container class="layout" :class="{ 'layout-collapsed': uiStore.asideCollapsed && !isMobile }"\n                :style="{ gridTemplateColumns: (!isMobile && uiStore.asideCollapsed) ? '1fr' : (isMobile ? '1fr' : '280px 1fr') }">
    <el-aside
        v-if="!uiStore.asideCollapsed || isMobile"
        class="aside"
        :width="uiStore.asideCollapsed && !isMobile ? '64px' : '280px'"
        :class="[uiStore.asideShow ? 'aside-show' : 'el-aside-hide', { 'aside-collapsed': uiStore.asideCollapsed && !isMobile }]">
      <Aside />
    </el-aside>
    <div
        :class="(uiStore.asideShow && isMobile)? 'overlay-show':'overlay-hide'"
        @click="uiStore.asideShow = false"
    ></div>
    <el-container class="main-container">
      <el-main>
        <el-header>
            <Header />
        </el-header>
        <Main />
      </el-main>
    </el-container>
  </el-container>
  <button
      v-if="isMobile && !uiStore.asideShow"
      type="button"
      class="layout-menu-fab"
      title="展开菜单"
      @click="isMobile ? uiStore.asideShow = true : uiStore.asideCollapsed = false"
  >
    <Icon icon="mingcute:menu-line" width="20" height="20"/>
  </button>
  <writer ref="writerRef" />
</template>

<script setup>
import { Icon } from '@iconify/vue'
import Aside from '@/layout/aside/index.vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {useUiStore} from "@/store/ui.js";
import writer from '@/layout/write/index.vue'

const uiStore = useUiStore();
const writerRef = ref({})
const isMobile = ref(window.innerWidth < 1025)
const handleResize = () => {
  isMobile.value = window.innerWidth < 1025
  uiStore.asideShow = window.innerWidth > 1024;
}

onMounted(() => {
  uiStore.writerRef = writerRef

  window.addEventListener('resize', handleResize)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.el-aside-hide {
  position: fixed;
  left: 0;
  height: 100%;
  z-index: 100;
  transform: translateX(-100%);
  transition: all 100ms ease;
}

.aside-show {
  -webkit-box-shadow: var(--aside-right-border);
  box-shadow: var(--aside-right-border);
  transform: translateX(0);
  transition: all 100ms ease;
  z-index: 101;
  @media (max-width: 1025px) {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 101;
    height: 100%;
    background: var(--el-bg-color);
  }
}

.el-aside {
  width: 280px;
  transition: all 100ms ease;
  overflow: hidden;
}

.aside-collapsed {
  :deep(.title) {
    margin: 10px 8px;
    padding: 0;
  }
  :deep(.title-text),
  :deep(.acct-label),
  :deep(.acct-chevron),
  :deep(.menu-name),
  :deep(.manage-title) {
    display: none !important;
  }
  :deep(.acct) {
    margin: 0 8px 6px;
  }
  :deep(.acct-toggle) {
    justify-content: center;
    padding: 0;
  }
  :deep(.el-menu-item) {
    justify-content: center;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
}

.layout {
  height: 100%;
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
}

.main-container {
  height: 100vh;
  background: var(--el-bg-color);
  overflow: hidden;
}

.layout-menu-fab {
  position: fixed;
  left: 14px;
  bottom: 16px;
  z-index: 90;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--label);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.14);
  cursor: pointer;
}

.el-main {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.el-header {
  flex: 0 0 60px;
  background: var(--el-bg-color);
  border-bottom: solid 1px var(--el-border-color);
  padding: 0;
}

.overlay-show {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  transition: all 0.3s;
}

.overlay-hide {
  display: flex;
  pointer-events: none;
  opacity: 0;
}
</style>



<template>
  <el-container class="layout layout-v2" :class="{ 'layout-collapsed': uiStore.asideCollapsed && !isMobile }"
                :style="{ gridTemplateColumns: isMobile ? '1fr' : (uiStore.asideCollapsed ? '1fr' : '272px 1fr') }">
    <button v-if="!isMobile" type="button" class="side-toggle"
            :class="{ collapsed: uiStore.asideCollapsed }"
            :title="uiStore.asideCollapsed ? '展开侧栏 Expand sidebar' : '收起侧栏 Collapse sidebar'"
            @click="uiStore.asideCollapsed = !uiStore.asideCollapsed">
      <Icon :icon="uiStore.asideCollapsed ? 'mingcute:right-line' : 'mingcute:left-line'" width="15" height="15"/>
    </button>
    <el-aside
        v-if="!uiStore.asideCollapsed || isMobile"
        class="aside"
        :width="isMobile ? '280px' : '272px'"
        :class="uiStore.asideShow ? 'aside-show' : 'el-aside-hide'">
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
  <writer ref="writerRef" />
</template>

<script setup>
import { Icon } from '@iconify/vue'
import Aside from '@/layout/aside/index.vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import router from '@/router/index.js'
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import writer from '@/layout/write/index.vue'

const uiStore = useUiStore();
const userStore = useUserStore();
const route = useRoute();
const writerRef = ref({})
const initials = computed(() => {
  const name = userStore.user.name || userStore.user.email || 'O'
  return String(name).trim().charAt(0).toUpperCase()
})
function openWriter() {
  writerRef.value?.open?.()
}
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

/* v4: 272px sidebar, no icon rail; toggle collapses the whole left column */
.layout.layout-v2 { display:grid !important; grid-template-rows:100vh; }
.layout-v2 .el-aside { grid-column:1; width:272px !important; height:100vh; background:var(--rd-panel); border-right:1px solid var(--rd-line); }
.layout-v2 .main-container { grid-column:2; min-width:0; }
.layout-v2.layout-collapsed .main-container { grid-column:1; }
.side-toggle { position:absolute; left:258px; top:22px; z-index:120; width:28px; height:28px; border-radius:50%;
  display:grid; place-items:center; border:1px solid var(--rd-line-strong, rgba(148,163,184,.25)); background:var(--rd-panel);
  color:var(--rd-muted, #64748b); box-shadow:0 5px 16px rgba(0,0,0,.18); cursor:pointer; transition:left .22s ease, background .18s; }
.side-toggle:hover { color:var(--rd-accent, #0a84ff); background:var(--rd-panel-2); }
.side-toggle.collapsed { left:12px; }
.side-toggle:active { transform:scale(.92); }
@media (max-width:1024px){ .side-toggle{display:none} }
</style>



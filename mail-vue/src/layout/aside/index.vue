<template>
  <el-scrollbar class="scroll">
    <div>
      <div class="title" >
        <img class="title-logo" src="/mail-pwa.png" alt="otsmail" />
        <div class="title-text">
          <div class="title-main">{{ settingStore.settings.title || 'OTSCUP Mail' }}</div>
          <div class="title-sub" v-if="settingStore.settings.subtitle">{{ settingStore.settings.subtitle }}</div>
        </div>
        <button type="button" class="collapse-toggle" :title="uiStore.asideCollapsed ? '展开菜单' : '收起菜单'"
                @click="uiStore.asideCollapsed = !uiStore.asideCollapsed">
          <Icon :icon="uiStore.asideCollapsed ? 'mingcute:right-line' : 'mingcute:left-line'" width="18" height="18"/>
        </button>
      </div>
      <div class="acct" v-perm="'account:query'">
        <button type="button" class="acct-toggle" @click="toggleAcct">
          <Icon icon="mdi:account-multiple-outline" width="18" height="18"/>
          <span class="acct-label">{{ $t('accounts') }}</span>
          <Icon class="acct-chevron" :class="{ open: acctOpen }" icon="mingcute:down-small-fill" width="18" height="18"/>
        </button>
        <el-collapse-transition>
          <div class="acct-panel" v-show="acctOpen">
            <Account/>
          </div>
        </el-collapse-transition>
      </div>
      <el-menu :collapse="false" text-color="var(--label)" active-text-color="var(--blue)" style="margin-top: 10px">
        <el-menu-item @click="router.push({name: 'email'})" index="email"
                      :class="route.meta.name === 'email' ? 'choose-item' : ''">
          <Icon icon="hugeicons:mailbox-01" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('inbox')}}</span>
          <span class="menu-badge" v-if="counts.inbox">{{ counts.inbox }}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'unread'})" index="unread"
                      :class="route.meta.name === 'unread' ? 'choose-item' : ''">
          <Icon icon="mdi:email-multiple-outline" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('unreadList')}}</span>
          <span class="menu-badge" v-if="counts.inbox">{{ counts.inbox }}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'spam'})" index="spam"
                      :class="route.meta.name === 'spam' ? 'choose-item' : ''">
          <Icon icon="mdi:alert-octagon-outline" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('spamList')}}</span>
          <span class="menu-badge" v-if="counts.spam">{{ counts.spam }}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'deleted'})" index="deleted"
                      :class="route.meta.name === 'deleted' ? 'choose-item' : ''">
          <Icon icon="mdi:trash-can-outline" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('deletedList')}}</span>
          <span class="menu-badge" v-if="counts.deleted">{{ counts.deleted }}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'send'})" index="send" v-perm="'email:send'"
                      :class="route.meta.name === 'send' ? 'choose-item' : ''">
          <Icon icon="cil:send" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('sent')}}</span>
          <span class="menu-badge" v-if="counts.sent">{{ counts.sent }}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'draft'})" index="draft" v-perm="'email:send'"
                      :class="route.meta.name === 'draft' ? 'choose-item' : ''">
          <Icon icon="ep:document" width="19" height="19" />
          <span class="menu-name" style="margin-left: 22px">{{$t('drafts')}}</span>
          <span class="menu-badge" v-if="counts.drafts">{{ counts.drafts }}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'star'})" index="star"
                      :class="route.meta.name === 'star' ? 'choose-item' : ''">
          <Icon icon="solar:star-line-duotone" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('starred')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'contacts'})" index="contacts"
                      :class="route.meta.name === 'contacts' ? 'choose-item' : ''">
          <Icon icon="mdi:account-box-multiple-outline" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('contacts')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'setting'})" index="setting"
                      :class="route.meta.name === 'setting' ? 'choose-item' : ''">
          <Icon icon="fluent:settings-48-regular" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('settings')}}</span>
        </el-menu-item>
        <div class="manage-title" v-perm="['all-email:query','user:query','role:query','setting:query','analysis:query','reg-key:query']">
          <div>{{$t('manage')}}</div>
        </div>
        <el-menu-item @click="router.push({name: 'analysis'})" index="analysis" v-perm="'analysis:query'"
                      :class="route.meta.name === 'analysis' ? 'choose-item' : ''">
          <Icon icon="fluent:data-pie-20-regular" width="24" height="24" />
          <span class="menu-name" style="margin-left: 18px">{{$t('analytics')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'user'})" index="user" v-perm="'user:query'"
                      :class="route.meta.name === 'user' ? 'choose-item' : ''">
          <Icon icon="si:user-alt-2-line" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('allUsers')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'all-email'})" index="all-email" v-perm="'all-email:query'"
                      :class="route.meta.name === 'all-email' ? 'choose-item' : ''">
          <Icon icon="fluent:mail-list-28-regular" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{$t('allMail')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'role'})" index="role" v-perm="'role:query'"
                      :class="route.meta.name === 'role' ? 'choose-item' : ''">
          <Icon icon="fluent:lock-closed-16-regular" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{$t('permissions')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'reg-key'})" index="reg-key" v-perm="'reg-key:query'"
                      :class="route.meta.name === 'reg-key' ? 'choose-item' : ''">
          <Icon icon="fluent:fingerprint-20-filled" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{$t('inviteCode')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'sys-setting'})" index="sys-setting" v-perm="'setting:query'"
                      :class="route.meta.name === 'sys-setting' ? 'choose-item' : ''">
          <Icon icon="eos-icons:system-ok-outlined" width="18" height="18" style="margin-left: 2px" />
          <span class="menu-name" style="margin-left: 22px">{{$t('SystemSettings')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'mcp'})" index="mcp" v-perm="'setting:query'"
                      :class="route.meta.name === 'mcp' ? 'choose-item' : ''">
          <Icon icon="mdi:connection" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('mcpService')}}</span>
        </el-menu-item>
      </el-menu>
    </div>
  </el-scrollbar>
</template>

<script setup>
import router from "@/router/index.js";
import { useRoute } from "vue-router";
import {Icon} from "@iconify/vue";
import {useSettingStore} from "@/store/setting.js";
import {useUiStore} from "@/store/ui.js";
import {ref, reactive, onMounted, onUnmounted, watch} from "vue";
import Account from "@/layout/account/index.vue";
import {emailMenuCounts} from "@/request/email.js";
import db from "@/db/db.js";

const settingStore = useSettingStore();
const uiStore = useUiStore();
const route = useRoute();
const counts = reactive({inbox: 0, sent: 0, deleted: 0, spam: 0, drafts: 0});
let countTimer = null;

async function loadCounts() {
  try {
    const data = await emailMenuCounts();
    Object.assign(counts, data);
  } catch {}
  try {
    counts.drafts = await db.value.draft.count();
  } catch {}
}

onMounted(() => {
  loadCounts();
  countTimer = setInterval(loadCounts, 30000);
  window.addEventListener('otsmail:counts', loadCounts);
});

onUnmounted(() => {
  clearInterval(countTimer);
  window.removeEventListener('otsmail:counts', loadCounts);
});

watch(() => route.name, loadCounts);
// 子邮箱默认收起，展开状态记在 localStorage（以前每次刷新都展开，很碍事）
const acctOpen = ref(localStorage.getItem('acctOpen') === '1');

function toggleAcct() {
  acctOpen.value = !acctOpen.value
  localStorage.setItem('acctOpen', acctOpen.value ? '1' : '0')
}

</script>

<style lang="scss" scoped>

.acct {
  margin: 0 10px 6px;
}

.acct-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--label-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: var(--fill-quaternary);
  }
}

.acct-label {
  flex: 1;
  text-align: left;
}

.acct-chevron {
  color: var(--label-3);
  transition: transform .15s;
}

.acct-chevron.open {
  transform: rotate(180deg);
}

.acct-panel {
  margin-top: 4px;
  max-height: 38vh;
  overflow: hidden;
}

:deep(.account-box) {
  border-right: 0 !important;
  background: transparent;
  display: flex;
  flex-direction: column;
  height: auto;
}

:deep(.account-box .head-opt) {
  height: 30px;
  padding: 0 4px;
  box-shadow: none;
}

/* 账户多时在面板里滚动，不把菜单挤下去 */
:deep(.account-box .scrollbar) {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  max-height: 30vh;
}

.title {
  margin: 15px 10px;
  height: 54px;
  border-radius: 8px;
  display: flex;
  position: relative;
  font-size: 16px;
  font-weight: bold;
  align-items: center;
  justify-content: flex-start;
  gap: 9px;
  padding-left: 10px;
  color: #ffffff;
  background: var(--blue);
  transition: all 0.3s ease;
  max-width: 260px;
  padding: 0 12px;
  .title-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .title-main,
  .title-sub {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: calc(260px - 24px - 31px);
  }
  .title-sub {
    font-size: 11px;
    font-weight: 400;
    line-height: 14px;
    opacity: .75;
  }

  :deep(.el-icon) {
    flex-shrink: 0;
    font-size: 20px;
  }

  .user-right-icon {
    align-self: center;
    position: absolute;
    font-size: 12px;
    right: 8px;
    color: #ffffff;
  }

}


.manage-title {
  margin-top: 10px;
  padding-left: 20px;
  color: var(--label-2);
}

/* iOS overrides handle .el-menu-item styling */

.choose-item {
  font-weight: bold;
  background: var(--ots-accent-weak) !important;
  backdrop-filter: blur(4px);
}

@media (hover: hover) {
  .el-menu-item:hover {
    background: var(--fill-quaternary) !important;
  }
}

.menu-name {
  user-select: none;
  flex: 1;
  min-width: 0;
}

.menu-badge {
  margin-left: auto;
  margin-right: 8px;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.collapse-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, .18);
  color: #fff;
  cursor: pointer;
}

.title-text {
  flex: 1;
  min-width: 0;
  padding-right: 28px;
  line-height: 1.15;
}

.title-main,
.title-sub {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.title-main {
  font-size: 14px;
  font-weight: 700;
}

.title-sub {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 400;
  opacity: .82;
}

.title-logo {
  width: 34px;
  height: 34px;
  margin-left: 8px;
  border-radius: 9px;
  object-fit: cover;
}

:global(.aside-collapsed) .collapse-toggle {
  position: static;
  transform: none;
  margin-left: 0;
  background: transparent;
}

:global(.aside-collapsed) .menu-badge,
:global(.aside-collapsed) .title-text,
:global(.aside-collapsed) .title-logo {
  display: none;
}

:global(.aside-collapsed) .title {
  justify-content: center;
  padding-left: 0;
}


:deep(.el-scrollbar__wrap--hidden-default ) {
  background: transparent !important;
}

:deep(.el-menu-item) {
  background: transparent;
}

:deep(.el-menu) {
  background: transparent;
}

.el-menu {
  border-right: 0;
}

:deep(.el-divider__text) {
  background: var(--aside-backgound);
  color: var(--label-2);
}

.scroll {

}
</style>

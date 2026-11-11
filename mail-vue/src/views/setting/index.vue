<template>
  <div class="box">
    <settingsTabs/>
    <div class="container">
      <div class="title">{{$t('appearance')}}</div>
      <div class="item wide">
        <SkinSelector/>
      </div>
    </div>
    <div class="container">
      <div class="title">{{$t('profile')}}</div>
      <div class="item wide">
        <div>{{$t('avatar')}}</div>
        <div class="row-flex">
          <el-avatar :size="44" :src="userStore.user.avatar || undefined" class="avatar-preview">{{ avatarLetter }}</el-avatar>
          <el-button type="primary" @click="openAvatar">{{$t('changeAvatar')}}</el-button>
        </div>
      </div>
      <div class="item">
        <div>{{$t('showSenderAvatar')}}</div>
        <el-switch :model-value="settingStore.showAvatars" @change="settingStore.setShowAvatars"/>
      </div>
      <div class="item">
        <div>{{$t('username')}}</div>
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0;">
          <span v-if="setNameShow" style="display: flex; align-items: center; gap: 8px;">
            <el-input v-model="accountName" style="width: 120px;"></el-input>
            <span class="edit-name" @click="setName">
             {{$t('save')}}
            </span>
          </span>
          <span v-else style="display: flex; align-items: center; gap: 8px; min-width: 0;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ userStore.user.name }}</span>
            <span class="edit-name" @click="showSetName">
             {{$t('change')}}
            </span>
          </span>
        </div>
      </div>
      <div class="item">
        <div>{{$t('emailAccount')}}</div>
        <div>{{ userStore.user.email }}</div>
      </div>
      <div class="item">
        <div>{{$t('password')}}</div>
        <div>
          <el-button type="primary" @click="pwdShow = true">{{$t('changePwdBtn')}}</el-button>
        </div>
      </div>
      <div class="item wide">
        <div>{{$t('recoveryEmail')}}</div>
        <div class="row-flex">
          <span style="font-size: 13px; color: var(--el-text-color-regular);">{{ userStore.user.recoveryEmail || '未设置' }}</span>
          <el-button type="primary" @click="openRecoveryEmailDialog">{{ userStore.user.recoveryEmail ? $t('change') : $t('bind') }}</el-button>
        </div>
        <span class="row-desc">{{$t('recoveryEmailDesc')}}</span>
      </div>
      <div class="item wide">
        <div>{{$t('disablePasswordLogin')}}</div>
        <div class="row-flex">
          <el-switch :model-value="userStore.user.disablePasswordLogin === true" @change="handleTogglePasswordLogin" :loading="togglePwdLoading"/>
          <span class="row-desc">{{$t('disablePasswordLoginDesc')}}</span>
        </div>
      </div>
      <div class="item wide">
        <div>{{$t('twoFactor')}}</div>
        <div class="row-flex">
          <span>{{ twoFactorEnabled ? $t('enabled') : $t('disabled') }}</span>
          <el-button type="primary" @click="openTwoFactor">{{ twoFactorEnabled ? $t('disable') : $t('enable') }}</el-button>
        </div>
      </div>
      <div class="item wide">
        <div>{{$t('twoFactorRequired')}}</div>
        <div class="row-flex">
          <el-switch :model-value="twoFactorRequired" :disabled="!twoFactorEnabled" @change="toggleTwoFactorRequired"/>
          <span class="row-desc">{{$t('twoFactorRequiredDesc')}}</span>
        </div>
      </div>
      <div class="item wide">
        <div>{{$t('signature')}}</div>
        <div class="signature-editor">
          <el-input v-model="signatureDraft" type="textarea" :rows="4" :maxlength="2000" show-word-limit :placeholder="$t('signaturePlaceholder')"/>
          <el-button type="primary" :loading="signatureSaving" @click="saveSignature">{{$t('save')}}</el-button>
        </div>
      </div>
      <div class="item wide">
        <div>{{$t('browserNotify')}}</div>
        <div class="row-flex">
          <el-switch :model-value="notifyOn" @change="toggleNotify"/>
          <el-button v-if="notifyOn" size="small" :loading="pushTesting" @click="sendTestPush">测试通知</el-button>
          <span class="row-desc">{{$t('browserNotifyDesc')}}</span>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="title">{{ $t('thirdPartyAccounts') }}</div>
      <div class="item oauth-item" v-if="settingStore.settings.githubSwitch">
        <div class="provider-label"><Icon icon="mingcute:github-line" width="18" height="18"/><span>GitHub</span></div>
        <div class="binding-actions">
          <template v-if="bindingFor('github')">
            <span class="bound-account">{{ $t('boundAs', {name: bindingLabel(bindingFor('github'))}) }}</span>
            <el-button link type="danger" @click="unbindProvider('github')">{{ $t('unbind') }}</el-button>
          </template>
          <el-button v-else type="primary" @click="bindGithub">{{ $t('bindProvider', {name:'GitHub'}) }}</el-button>
        </div>
      </div>
      <div class="item oauth-item" v-if="settingStore.settings.googleSwitch">
        <div class="provider-label"><Icon icon="flat-color-icons:google" width="18" height="18"/><span>Google</span></div>
        <div class="binding-actions">
          <template v-if="bindingFor('google')">
            <span class="bound-account">{{ $t('boundAs', {name: bindingLabel(bindingFor('google'))}) }}</span>
            <el-button link type="danger" @click="unbindProvider('google')">{{ $t('unbind') }}</el-button>
          </template>
          <el-button v-else type="primary" @click="bindGoogle">{{ $t('bindProvider', {name:'Google'}) }}</el-button>
        </div>
      </div>
      <div class="item oauth-item" v-if="settingStore.settings.linuxdoSwitch">
        <div class="provider-label"><Icon icon="simple-icons:linux" width="18" height="18"/><span>LinuxDo</span></div>
        <div class="binding-actions">
          <template v-if="bindingFor('linuxdo')">
            <span class="bound-account">{{ $t('boundAs', {name: bindingLabel(bindingFor('linuxdo'))}) }}</span>
            <el-button link type="danger" @click="unbindProvider('linuxdo')">{{ $t('unbind') }}</el-button>
          </template>
          <el-button v-else type="primary" @click="bindLinuxDo">{{ $t('bindProvider', {name:'LinuxDo'}) }}</el-button>
        </div>
      </div>
      <div class="item oauth-item" v-for="provider in enabledOidcProviders" :key="provider.id">
        <div class="provider-label">
          <img v-if="isImageIcon(provider.icon)" :src="normalizeIcon(provider.icon)" class="oidc-icon" alt=""/>
          <Icon v-else :icon="provider.icon || 'mingcute:shield-check-line'" width="18" height="18"/>
          <span>{{ provider.name || 'SSO' }}</span>
        </div>
        <div class="binding-actions">
          <template v-if="bindingFor(oidcProviderKey(provider))">
            <span class="bound-account">{{ $t('boundAs', {name: bindingLabel(bindingFor(oidcProviderKey(provider)))}) }}</span>
            <el-switch :model-value="bindingFor(oidcProviderKey(provider)).active !== 0"
                       @change="val => toggleBinding(oidcProviderKey(provider), val)"/>
            <el-button link type="danger" @click="unbindProvider(oidcProviderKey(provider))">{{ $t('unbind') }}</el-button>
          </template>
          <el-button v-else type="primary" @click="bindOidc(provider.id)">{{ $t('bindProvider', {name: provider.name || 'SSO'}) }}</el-button>
        </div>
      </div>

      <!-- Passkey (WebAuthn 通行密钥) -->
      <div class="item oauth-item">
        <div class="provider-label">
          <Icon icon="solar:key-minimalistic-square-line-duotone" width="18" height="18"/>
          <span>Passkey 通行密钥</span>
        </div>
        <div class="binding-actions">
          <template v-if="passkeyList.length">
            <span class="bound-account">已绑定 {{ passkeyList.length }} 个密钥</span>
            <el-button link type="primary" @click="addPasskey">添加新密钥</el-button>
            <el-button link type="danger" @click="clearPasskeys">管理</el-button>
          </template>
          <el-button v-else type="primary" :loading="passkeyLoading" @click="addPasskey">添加 Passkey</el-button>
        </div>
      </div>
      <!-- Passkey 列表：按创建时间与凭据 ID 前缀区分，支持单条删除 -->
      <div class="passkey-block" v-if="passkeyList.length">
        <div class="row-desc">删除前请核对创建时间与凭据 ID 前缀，避免删错条目（时间按本地时区显示）。</div>
        <div class="device-list">
          <div v-for="item in passkeyList" :key="item.id" class="device-row">
            <div class="device-main">
              <div class="device-name">{{ item.name || 'Passkey' }}</div>
              <div class="device-meta">创建时间：{{ formatDateTime(item.createdAt) }}</div>
              <div class="device-meta">最后使用：{{ item.lastUsedAt ? formatDateTime(item.lastUsedAt) : '从未使用' }}</div>
              <div class="device-meta">凭据 ID：{{ credentialPrefix(item.credentialId) }}… · 来源：未记录（服务端未保存创建来源）</div>
            </div>
            <button type="button" class="device-kick" @click="removePasskey(item)">删除</button>
          </div>
        </div>
      </div>
      <div class="item" v-if="!settingStore.settings.githubSwitch && !settingStore.settings.googleSwitch && !settingStore.settings.linuxdoSwitch && enabledOidcProviders.length === 0">
        <div><span>{{ $t('noThirdParty') }}</span></div>
      </div>
    </div>
    <div class="language">
      <div class="title">{{$t('language')}}</div>
      <el-select
          :model-value="langSelect"
          class="language-select"
          placeholder="Select"
          @change="changeLang"
      >
        <el-option label="中文" value="zh" @pointerdown.prevent.stop="changeLang('zh')"/>
        <el-option label="English" value="en" @pointerdown.prevent.stop="changeLang('en')"/>
      </el-select>
    </div>
    <div class="container">
      <div class="title">{{ $t('loginDevices') }}</div>
      <div class="item wide">
        <div class="row-desc">{{ $t('loginDevicesDesc') }}</div>
        <div class="device-list">
          <div v-for="item in sessions" :key="item.id" class="device-row">
            <div class="device-main">
              <div class="device-name">
                {{ item.device || $t('deviceUnknown') }}
                <span v-if="item.current" class="device-tag">{{ $t('deviceCurrent') }}</span>
              </div>
              <div class="device-meta">{{ [item.browser, item.os, item.ip].filter(Boolean).join(' · ') || $t('deviceUnknown') }}</div>
              <div v-if="item.time" class="device-meta">{{ $t('deviceLastActive') }} {{ formatDateTime(item.time) }}</div>
            </div>
            <button v-if="!item.current" type="button" class="device-kick" @click="kickDevice(item)">{{ $t('deviceKick') }}</button>
          </div>
          <div v-if="!sessions.length" class="row-desc">{{ $t('deviceNoSessions') }}</div>
        </div>
      </div>
    </div>
    <div class="del-email" v-perm="'my:delete'">
      <div class="title">{{$t('deleteUser')}}</div>
      <div style="color: var(--regular-text-color);">
        {{$t('delAccountMsg')}}
      </div>
      <div>
        <el-button type="primary" @click="deleteConfirm">{{$t('deleteUserBtn')}}</el-button>
      </div>
    </div>
    <el-dialog v-model="pwdShow" :title="$t('changePassword')" width="360" append-to-body class="clean-dialog">
      <div class="form-col">
        <el-input type="password" :placeholder="$t('oldPassword')" v-model="form.oldPassword" autocomplete="current-password" @keyup.enter="submitPwd"/>
        <el-input type="password" :placeholder="$t('newPassword')" v-model="form.password" autocomplete="new-password" @keyup.enter="submitPwd"/>
        <el-input type="password" :placeholder="$t('confirmPassword')" v-model="form.newPwd" autocomplete="new-password" @keyup.enter="submitPwd"/>
        <el-input v-if="twoFactorEnabled || twoFactorRequired" v-model="form.twoFactorCode" maxlength="6" :placeholder="$t('verifyCode')" @keyup.enter="submitPwd"/>
        <div class="actions">
          <el-button @click="pwdShow = false">{{$t('cancel')}}</el-button>
          <el-button type="primary" :loading="setPwdLoading" @click="submitPwd">{{$t('save')}}</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 辅助邮箱设置弹窗 -->
    <el-dialog v-model="recoveryShow" :title="$t('recoveryEmail')" width="360" append-to-body class="clean-dialog">
      <div class="form-col">
        <el-input v-model="recoveryEmailDraft" :placeholder="$t('recoveryEmailPlaceholder')"/>
        <el-input type="password" :placeholder="$t('password') + '（验证身份）'" v-model="recoveryPasswordDraft" autocomplete="current-password" @keyup.enter="submitRecoveryEmail"/>
        <div class="actions">
          <el-button @click="recoveryShow = false">{{$t('cancel')}}</el-button>
          <el-button type="primary" :loading="recoverySaving" @click="submitRecoveryEmail">{{$t('save')}}</el-button>
        </div>
      </div>
    </el-dialog>
    <el-dialog v-model="avatarShow" :title="$t('changeAvatar')" width="380" append-to-body class="clean-dialog">
      <div class="form-col" style="gap: 16px;">
        <div class="avatar-center">
          <el-avatar :size="72" :src="avatarDraft || userStore.user.avatar || undefined" class="avatar-preview" style="box-shadow: 0 4px 12px rgba(0,0,0,0.08);">{{ avatarLetter }}</el-avatar>
        </div>
        <el-input v-model="avatarDraft" :placeholder="$t('imageLink')" clearable/>
        <div class="avatar-upload-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <input ref="avatarFileRef" type="file" style="display: none"
                 accept="image/png,image/jpeg,image/webp,image/gif" @change="pickAvatarFile"/>
          <el-button @click="avatarFileRef.click()" style="flex: none;">{{$t('uploadImage')}}</el-button>
          <span class="row-desc" style="font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.3;">{{$t('avatarUploadTip')}}</span>
        </div>
        <div class="actions" style="margin-top: 8px;">
          <el-button @click="avatarShow = false">{{$t('cancel')}}</el-button>
          <el-button type="primary" :loading="avatarSaving" @click="saveAvatarLink">{{$t('save')}}</el-button>
        </div>
      </div>
    </el-dialog>
    <el-dialog v-model="twoFactorShow" :title="$t('twoFactor')" width="380" append-to-body>
      <div class="form-col">
        <template v-if="!twoFactorEnabled">
          <span class="row-desc">{{$t('twoFactorSetupDesc')}}</span>
          <div class="secret-box">
            <div class="secret-row">
              <span class="secret-label">{{$t('secretKeyLabel')}}</span>
              <span class="secret-value">{{ twoFactorSecret || '...' }}</span>
              <span class="edit-name" @click="copySecret">{{$t('copy')}}</span>
            </div>
            <div class="secret-url">{{ twoFactorUrl }}</div>
          </div>
          <el-input v-model="twoFactorCode" maxlength="6" :placeholder="$t('verifyCode')" @keyup.enter="confirmTwoFactor"/>
          <div class="actions">
            <el-button @click="twoFactorShow = false">{{$t('cancel')}}</el-button>
            <el-button type="primary" :loading="twoFactorLoading" @click="confirmTwoFactor">{{$t('enable')}}</el-button>
          </div>
        </template>
        <template v-else>
          <span class="row-desc">{{$t('twoFactorDisableDesc')}}</span>
          <el-input v-model="twoFactorCode" maxlength="6" :placeholder="$t('verifyCode')" @keyup.enter="disableTwoFactor"/>
          <div class="actions">
            <el-button @click="twoFactorShow = false">{{$t('cancel')}}</el-button>
            <el-button type="primary" :loading="twoFactorLoading" @click="disableTwoFactor">{{$t('disable')}}</el-button>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import {computed, reactive, ref, onMounted, onUnmounted, defineOptions, h} from 'vue'
import {Icon} from '@iconify/vue'
import {
  resetPassword,
  userDelete,
  setAvatar,
  uploadAvatar,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
  setTwoFactorRequired
} from "@/request/my.js";
import {useUserStore} from "@/store/user.js";
import settingsTabs from "@/components/settings-tabs/index.vue";
import SkinSelector from "@/components/skin-selector/index.vue";
import router from "@/router/index.js";
import {accountSetName} from "@/request/account.js";
import {useAccountStore} from "@/store/account.js";
import {useI18n} from "vue-i18n";
import {useSettingStore} from "@/store/setting.js";
import {clearToken} from "@/utils/token-store.js";
import {oidcConfig, oauthBindings, oauthUnbind, oauthSetBindingActive} from "@/request/ouath.js";
import {createPkce} from "@/utils/pkce.js";
import {notifyEnabled, enableNotify, disableNotify} from "@/utils/notify.js";
import {testPush} from "@/request/push.js";
import {updateMySetting, mySessions, kickMySession, updateRecoveryEmail, togglePasswordLogin} from "@/request/my.js";
import {formatDateTime} from "@/utils/day.js";

const { t } = useI18n()
const accountStore = useAccountStore()
const settingStore = useSettingStore()
const userStore = useUserStore();
const isAdmin = computed(() => userStore.user?.role?.permKeys?.includes('*') || userStore.user?.role?.name === 'admin');
const signatureDraft = ref(userStore.user?.signature || '')
const signatureSaving = ref(false)
async function saveSignature() {
  signatureSaving.value = true
  try {
    const result = await updateMySetting({signature: signatureDraft.value})
    userStore.user.signature = result.signature
    ElMessage({message: t('signatureSaved'), type: 'success', plain: true})
  } catch (e) {
    ElMessage({message: e?.message || t('saveFailed'), type: 'error', plain: true})
  } finally {
    signatureSaving.value = false
  }
}
const setPwdLoading = ref(false)
const setNameShow = ref(false)
const accountName = ref(null)
const langSelect = ref(settingStore.lang)
const enabledOidcProviders = computed(() => {
  const list = settingStore.settings.oidcProviders
  if (Array.isArray(list) && list.length > 0) return list
  return settingStore.settings.oidcSwitch
      ? [{id: '', name: settingStore.settings.oidcName || 'SSO'}]
      : []
})
const oauthBindingList = ref([])
const bindingMap = computed(() => Object.fromEntries(oauthBindingList.value.map(item => [item.provider, item])))

function oidcProviderKey(provider) {
  return provider.id === 'legacy' ? 'oidc' : 'oidc:' + provider.id
}
function bindingFor(provider) {
  return bindingMap.value[provider]
}
function bindingLabel(binding) {
  return binding?.name || binding?.username || t('boundAccount')
}
function normalizeIcon(icon) {
  return String(icon || '').replace(/\\\//g, '/').replace(/\\:/g, ':').trim()
}
function isImageIcon(icon) {
  return /^(https?:\/\/|data:image\/|\/\/|\/)/i.test(normalizeIcon(icon))
}
async function loadBindings() {
  try {
    oauthBindingList.value = await oauthBindings()
  } catch (e) {
    oauthBindingList.value = []
  }
}
async function toggleBinding(provider, active) {
  const current = bindingFor(provider)
  if (!current) return
  const old = current.active
  current.active = active ? 1 : 0
  try {
    await oauthSetBindingActive(provider, !!active)
    ElMessage({message: active ? t('bindingEnabled') : t('bindingDisabled'), type: 'success', plain: true})
  } catch (e) {
    current.active = old
    ElMessage({message: e?.message || t('bindingFailed'), type: 'error', plain: true})
  }
}
async function unbindProvider(provider) {
  try {
    await ElMessageBox.confirm(t('unbindConfirm'), t('unbindTitle'), {type: 'warning'})
    await oauthUnbind(provider)
    oauthBindingList.value = oauthBindingList.value.filter(item => item.provider !== provider)
    ElMessage({message: t('unbound'), type: 'success', plain: true})
  } catch (e) {
    if (e !== 'cancel') ElMessage({message: e?.message || t('unbindFailed'), type: 'error', plain: true})
  }
}
onMounted(loadBindings)

const sessions = ref([])
async function loadSessions() {
  try {
    sessions.value = await mySessions()
  } catch (e) {
    sessions.value = []
  }
}
async function kickDevice(item) {
  try {
    await ElMessageBox.confirm(t('deviceKickConfirm'), t('loginDevices'), {type: 'warning'})
    await kickMySession(item.id)
    sessions.value = sessions.value.filter(row => row.id !== item.id)
    ElMessage({message: t('deviceKicked'), type: 'success', plain: true})
  } catch (e) {
    if (e !== 'cancel') ElMessage({message: e?.message || t('skinSyncFailed'), type: 'error', plain: true})
  }
}
onMounted(loadSessions)
onMounted(loadPasskeys)

// 回调必须落在登录页，登录页才能拿 code；老配置里填站点根的要纠正
function oidcCallback(url) {
  const fallback = window.location.origin + '/login'
  if (!url) return fallback
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '/' || parsed.pathname === '') return parsed.origin + '/login'
    return url
  } catch (e) {
    return fallback
  }
}

defineOptions({
  name: 'setting'
})

function showSetName() {
  accountName.value = userStore.user.name
  setNameShow.value = true
}

// v1.3 登录态绑定（大网站模式）：个人设置页把当前 GitHub/Google/LinuxDo 授权绑到当前账号
// 走 state=bind → 回调后 login 的 oauthGetUser 分支调 PUT /oauth/bind
function oauthNonce() {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `oauth_nonce=${nonce}; Path=/; SameSite=Lax${secure}`
  return nonce
}

function bindGithub() {
  const clientId = settingStore.settings.githubClientId
  const redirectUri = encodeURIComponent(settingStore.settings.githubCallbackUrl)
  if (!clientId) {
    ElMessage({ message: t('providerNotConfigured', {name:'GitHub'}), type: 'warning', plain: true })
    return
  }
  window.location.href =
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user&state=bind-github:${oauthNonce()}`
}

function bindGoogle() {
  const clientId = settingStore.settings.googleClientId
  const redirectUri = encodeURIComponent(settingStore.settings.googleCallbackUrl)
  if (!clientId) {
    ElMessage({ message: t('providerNotConfigured', {name:'Google'}), type: 'warning', plain: true })
    return
  }
  window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&state=bind-google:${oauthNonce()}`
}

function bindLinuxDo() {
  const clientId = settingStore.settings.linuxdoClientId
  const redirectUri = encodeURIComponent(settingStore.settings.linuxdoCallbackUrl)
  if (!clientId) {
    ElMessage({ message: t('providerNotConfigured', {name:'LinuxDo'}), type: 'warning', plain: true })
    return
  }
  window.location.href =
      `https://connect.linux.do/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=bind-linuxdo:${oauthNonce()}`
}

// 企业 SSO 绑定：授权端点与 client_id 由后端 discovery 提供，后台改配置不用动前端
async function bindOidc(providerId) {
  try {
    const config = await oidcConfig(providerId)
    const nonce = oauthNonce()
    const state = (providerId ? 'bind-oidc:' + providerId : 'bind-oidc') + ':' + nonce
    const {challenge} = await createPkce(state)
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: oidcCallback(config.callbackUrl),
      response_type: 'code',
      scope: config.scope || 'openid profile email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    })
    window.location.href = config.authorizationEndpoint + '?' + params.toString()
  } catch (e) {
    ElMessage({message: e?.message || t('oidcConfigFailed'), type: 'error', plain: true})
  }
}

// Passkey (WebAuthn) 管理与注册
const passkeyList = ref([])
const passkeyLoading = ref(false)

async function loadPasskeys() {
  try {
    const res = await fetch('/api/my/passkey/list', {
      headers: { Authorization: localStorage.getItem('token') || '' }
    }).then(r => r.json())
    if (res.code === 200) {
      passkeyList.value = res.data || []
    }
  } catch {}
}

// credentialId 前缀用于和 Bitwarden 里的条目对照（服务端未保存注册来源，不做臆测）
function credentialPrefix(value) {
  const text = String(value || '')
  return text ? text.slice(0, 8) : '未知'
}

async function removePasskey(item) {
  try {
    await ElMessageBox.confirm(
      h('div', { style: 'line-height: 1.8' }, [
        h('div', '删除后该通行密钥将无法再用于登录，请核对是不是这一条：'),
        h('div', `创建时间：${formatDateTime(item.createdAt)}`),
        h('div', `凭据 ID：${credentialPrefix(item.credentialId)}…`)
      ]),
      '删除通行密钥',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch (e) {
    return
  }
  try {
    const res = await fetch(`/api/my/passkey/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: localStorage.getItem('token') || '' }
    }).then(r => r.json())
    if (res.code !== 200) throw new Error(res.message || '删除失败')
    ElMessage({ message: '已删除', type: 'success', plain: true })
    loadPasskeys()
  } catch (e) {
    ElMessage({ message: e?.message || '删除失败', type: 'error', plain: true })
  }
}

async function addPasskey() {
  if (!window.PublicKeyCredential) {
    ElMessage.error('当前浏览器或系统不支持 Passkey')
    return
  }
  passkeyLoading.value = true
  try {
    const optRes = await fetch('/api/my/passkey/register/options', {
      method: 'POST',
      headers: { Authorization: localStorage.getItem('token') || '', 'Content-Type': 'application/json' }
    }).then(r => r.json())
    if (optRes.code !== 200) throw new Error(optRes.message || '获取注册挑战失败')

    const options = optRes.data
    options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    options.user.id = new TextEncoder().encode(options.user.id)

    const credential = await navigator.credentials.create({ publicKey: options })
    const credentialData = {
      id: credential.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      type: credential.type,
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
        attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)))
      }
    }

    const verifyRes = await fetch('/api/my/passkey/register/verify', {
      method: 'POST',
      headers: { Authorization: localStorage.getItem('token') || '', 'Content-Type': 'application/json' },
      body: JSON.stringify(credentialData)
    }).then(r => r.json())

    if (verifyRes.code === 200) {
      ElMessage.success('Passkey 添加成功！')
      loadPasskeys()
    } else {
      throw new Error(verifyRes.message || '验证失败')
    }
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      ElMessage.error(e.message || '添加 Passkey 失败')
    }
  } finally {
    passkeyLoading.value = false
  }
}

async function clearPasskeys() {
  try {
    await ElMessageBox.confirm('确定要管理并重置所有已绑定的 Passkey 吗？', '管理 Passkey', { type: 'warning' })
    for (const item of passkeyList.value) {
      const res = await fetch(`/api/my/passkey/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: localStorage.getItem('token') || '' }
      }).then(r => r.json()).catch(() => null)
      // 服务端可能因「删完就没有任何登录方式」而拒绝，必须把原因提示出来
      if (res && res.code !== 200) {
        ElMessage({ message: res.message || '删除失败', type: 'error', plain: true })
        loadPasskeys()
        return
      }
    }
    ElMessage.success('已清空 Passkey')
    loadPasskeys()
  } catch {}
}

function setName() {

  if (!accountName.value) {
    ElMessage({
      message: t('emptyUserNameMsg'),
      type: 'error',
      plain: true,
    })
    return;
  }

  setNameShow.value = false
  let name = accountName.value

  if (name === userStore.user.name) {
    return
  }

  userStore.user.name = accountName.value

  accountSetName(userStore.user.account.accountId,name).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true,
    })

    accountStore.changeUserAccountName = name

  }).catch(() => {
    userStore.user.name = name
  })
}

function changeLang(lang) {
  let setting = {}
  try {
    setting = JSON.parse(localStorage.getItem('setting') || '{}')
  } catch (e) {
    setting = {}
  }
  localStorage.setItem('setting', JSON.stringify({...setting, lang}))
  window.location.reload()
}

const pwdShow = ref(false)
const form = reactive({
  oldPassword: '',
  password: '',
  newPwd: '',
  twoFactorCode: '',
})

const deleteConfirm = () => {
  ElMessageBox.confirm(t('delAccountConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    userDelete().then(() => {
      clearToken();
      router.replace('/login');
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true,
      })
    })
  })
}


function submitPwd() {

  if (setPwdLoading.value) return

  if (!form.oldPassword) {
    ElMessage({
      message: t('oldPassword'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.password.length < 6 || form.password.length > 30) {
    ElMessage({
      message: t('pwdLengthMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.password !== form.newPwd) {
    ElMessage({
      message: t('confirmPwdFailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  setPwdLoading.value = true
  resetPassword(form.oldPassword, form.password, form.twoFactorCode).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true,
    })
    clearToken()
    router.replace('/login')
  }).catch(() => {
    setPwdLoading.value = false
  })

}

// ---- 辅助安全邮箱与停用密码登录 ----

const recoveryShow = ref(false)
const recoveryEmailDraft = ref('')
const recoveryPasswordDraft = ref('')
const recoverySaving = ref(false)
const togglePwdLoading = ref(false)

function openRecoveryEmailDialog() {
  recoveryEmailDraft.value = userStore.user.recoveryEmail || ''
  recoveryPasswordDraft.value = ''
  recoveryShow.value = true
}

async function submitRecoveryEmail() {
  if (!recoveryPasswordDraft.value) {
    ElMessage.error('请输入当前登录密码以验证身份')
    return
  }
  recoverySaving.value = true
  try {
    const res = await updateRecoveryEmail(recoveryEmailDraft.value, recoveryPasswordDraft.value)
    userStore.user.recoveryEmail = res.recoveryEmail
    ElMessage.success(t('saveSuccessMsg'))
    recoveryShow.value = false
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    recoverySaving.value = false
  }
}

async function handleTogglePasswordLogin(disable) {
  // 关闭密码登录属于高风险操作，需要当前密码二次确认，光有会话 token 不足以执行
  let password = ''
  if (disable) {
    try {
      const { value } = await ElMessageBox.prompt('请输入当前登录密码以确认停用密码登录', t('disablePasswordLogin'), {
        inputType: 'password',
        inputPlaceholder: t('password'),
        confirmButtonText: t('confirm'),
        cancelButtonText: t('cancel')
      })
      password = value || ''
    } catch {
      return
    }
    if (!password) {
      ElMessage.error('请输入当前登录密码以验证身份')
      return
    }
  }
  togglePwdLoading.value = true
  try {
    const res = await togglePasswordLogin(disable, password)
    userStore.user.disablePasswordLogin = res.disablePasswordLogin
    ElMessage.success(disable ? '已停用密码登录' : '已恢复密码登录')
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    togglePwdLoading.value = false
  }
}

// ---- 头像 ----

const avatarShow = ref(false)
const avatarDraft = ref('')
const avatarSaving = ref(false)
const avatarFileRef = ref(null)

const avatarLetter = computed(() =>
    (userStore.user.name || userStore.user.email || '?').charAt(0).toUpperCase())

function openAvatar() {
  avatarDraft.value = userStore.user.avatar || ''
  avatarShow.value = true
}

function saveAvatarLink() {
  if (avatarSaving.value) return
  const avatar = avatarDraft.value.trim()
  if (avatar && !/^https?:\/\//i.test(avatar)) {
    ElMessage({message: t('avatarLinkInvalid'), type: 'error', plain: true})
    return
  }
  avatarSaving.value = true
  setAvatar(avatar).then(() => {
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
    userStore.refreshUserInfo()
    avatarShow.value = false
  }).catch(() => {}).finally(() => {
    avatarSaving.value = false
  })
}

function pickAvatarFile(event) {
  const file = event.target.files && event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage({message: t('avatarTooLarge'), type: 'error', plain: true})
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    avatarSaving.value = true
    uploadAvatar(reader.result).then(() => {
      ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
      userStore.refreshUserInfo()
      avatarShow.value = false
    }).catch(() => {}).finally(() => {
      avatarSaving.value = false
    })
  }
  reader.readAsDataURL(file)
}

// ---- 两步验证 ----

const twoFactorEnabled = computed(() => userStore.user.twoFactor === true)
const twoFactorRequired = computed(() => userStore.user.twoFactorRequired === true)
const twoFactorShow = ref(false)
const twoFactorSecret = ref('')
const twoFactorUrl = ref('')
const twoFactorCode = ref('')
const twoFactorLoading = ref(false)

function openTwoFactor() {
  twoFactorCode.value = ''
  twoFactorSecret.value = ''
  twoFactorUrl.value = ''
  twoFactorShow.value = true
  if (twoFactorEnabled.value) return
  twoFactorSetup().then(res => {
    twoFactorSecret.value = res.secret
    twoFactorUrl.value = res.otpauthUrl
  }).catch(() => {
    twoFactorShow.value = false
  })
}

function checkCode() {
  if (!/^\d{6}$/.test(twoFactorCode.value)) {
    ElMessage({message: t('verifyCodeInvalid'), type: 'error', plain: true})
    return false
  }
  return true
}

function confirmTwoFactor() {
  if (!checkCode() || twoFactorLoading.value) return
  twoFactorLoading.value = true
  twoFactorEnable(twoFactorCode.value).then(() => {
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
    userStore.refreshUserInfo()
    twoFactorShow.value = false
  }).catch(() => {}).finally(() => {
    twoFactorLoading.value = false
  })
}

function disableTwoFactor() {
  if (!checkCode() || twoFactorLoading.value) return
  twoFactorLoading.value = true
  twoFactorDisable({code: twoFactorCode.value}).then(() => {
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
    userStore.refreshUserInfo()
    twoFactorShow.value = false
  }).catch(() => {}).finally(() => {
    twoFactorLoading.value = false
  })
}

async function toggleTwoFactorRequired(value) {
  try {
    await setTwoFactorRequired(value)
    await userStore.refreshUserInfo()
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
  } catch (e) {}
}

function copySecret() {
  if (!twoFactorSecret.value) return
  navigator.clipboard.writeText(twoFactorSecret.value).then(() => {
    ElMessage({message: t('copySuccessMsg'), type: 'success', plain: true})
  }).catch(() => {})
}

// ---- 浏览器通知 ----

const notifyOn = ref(notifyEnabled())
const pushTesting = ref(false)
const syncNotifyState = () => { notifyOn.value = notifyEnabled() }
onMounted(() => window.addEventListener('otsmail:notify', syncNotifyState))
onUnmounted(() => window.removeEventListener('otsmail:notify', syncNotifyState))

async function sendTestPush() {
  if (pushTesting.value) return
  pushTesting.value = true
  try {
    const data = await testPush()
    const results = data?.results || []
    if (results.length === 0) {
      ElMessage({message: '当前没有 Web Push 订阅', type: 'warning', plain: true})
    } else {
      const failed = results.filter(item => !item.ok)
      ElMessage({
        message: failed.length
          ? `测试通知失败：${failed.map(item => item.status || item.error || 'unknown').join(', ')}`
          : '测试通知已发送',
        type: failed.length ? 'warning' : 'success',
        plain: true
      })
    }
  } catch (e) {
    ElMessage({message: e?.message || '测试通知失败', type: 'error', plain: true})
  } finally {
    pushTesting.value = false
  }
}

async function toggleNotify(value) {
  if (!value) {
    disableNotify()
    notifyOn.value = false
    return
  }
  const result = await enableNotify()
  notifyOn.value = result.ok
  if (!result.ok) {
    ElMessage({
      message: result.reason === 'push'
        ? `${t('notificationPushFailedTitle')}: ${result.error || 'unknown'}`
        : t('notifyDenied'),
      type: 'warning',
      plain: true
    })
  }
}

</script>
<style scoped lang="scss">
.box {
  padding: 40px 40px;

  @media (max-width: 767px) {
    padding: 30px 30px;
  }

  .update-pwd {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .admin-link { margin-left:12px; font-size:12px; font-weight:500; color:var(--rd-accent); text-decoration:none; }
.title {
    font-size: 18px;
    font-weight: bold;
  }

  .container {
    font-size: 14px;
    display: grid;
    gap: 20px;
    margin-bottom: 40px;

    .item {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 140px;
      position: relative;
      .user-name {
        display: grid;
        grid-template-columns: auto 1fr;
        span:first-child {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }

      .edit-name-input {
        position: absolute;
        bottom: -6px;
        .el-input {
          width: min(200px,calc(100vw - 222px));
        }
      }

      .edit-name {
        color: #4dabff;
        padding-left: 10px;
        cursor: pointer;
      }

      @media (max-width: 767px) {
        gap: 70px;
      }

      div:first-child {
        font-weight: bold;
      }

      div:last-child {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }

    /* 头像 / 两步验证 / 通知行：标签更长，收窄固定列 */
    .item.wide {
      grid-template-columns: 84px 1fr;
      gap: 106px;

      @media (max-width: 767px) {
        grid-template-columns: 84px 1fr;
        gap: 36px;
      }
    }

    .item.oauth-item {
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 40px;
      align-items: center;

      @media (max-width: 767px) {
        grid-template-columns: 110px minmax(0, 1fr);
        gap: 12px;
      }
    }

    .provider-label,
    .binding-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .binding-actions {
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .bound-account {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--label);
      font-weight: normal;
    }

    .oidc-icon {
      width: 18px;
      height: 18px;
      object-fit: contain;
      border-radius: 4px;
    }
  }

  .row-flex {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }

  .row-flex.row-start {
    justify-content: flex-start;
  }

  .row-desc {
    color: var(--label-2, #8e8e93);
    font-size: var(--text-footnote, 13px);
    line-height: 1.4;
    white-space: normal;
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }

  .device-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--rd-line, rgba(148, 163, 184, .25));
    border-radius: 10px;
    background: var(--rd-panel-2, transparent);
  }

  .device-main {
    min-width: 0;
  }

  .device-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--rd-text, var(--label));
  }

  .device-tag {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--rd-accent-weak, rgba(10, 132, 255, .12));
    color: var(--rd-accent, #0a84ff);
    font-size: 11px;
    font-weight: 600;
  }

  .device-meta {
    margin-top: 2px;
    color: var(--rd-muted, var(--label-2));
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .device-kick {
    flex: none;
    padding: 5px 12px;
    border: 1px solid var(--rd-line, rgba(148, 163, 184, .3));
    border-radius: 8px;
    background: transparent;
    color: var(--rd-muted, var(--label-2));
    font-size: 12px;
    cursor: pointer;
    transition: color .15s ease, border-color .15s ease, background .15s ease;
  }

  .device-kick:hover {
    border-color: #e5484d;
    background: rgba(229, 72, 77, .08);
    color: #e5484d;
  }

  .avatar-preview {
    flex: none;
    background: var(--fill-quaternary, #f2f2f7);
  }

  .form-col {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .avatar-center {
    display: flex;
    justify-content: center;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .secret-box {
    padding: 12px;
    border-radius: var(--radius-md, 12px);
    background: var(--bg-grouped, #f2f2f7);

    .secret-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--text-subhead, 15px);
    }

    .secret-label {
      color: var(--label-2, #8e8e93);
      flex: none;
    }

    .secret-value {
      font-family: ui-monospace, Menlo, monospace;
      word-break: break-all;
    }

    .secret-row .edit-name {
      color: var(--blue, #007aff);
      cursor: pointer;
      flex: none;
    }

    .secret-url {
      margin-top: 8px;
      color: var(--label-3, #aeaeb2);
      font-size: var(--text-footnote, 13px);
      word-break: break-all;
    }
  }

  .language {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 40px;

    .language-select {
      width: 100px;
    }
  }

  .del-email {
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
}

:deep(.clean-dialog.el-dialog) {
  border-radius: 14px !important;
  background: var(--bg-primary, #ffffff) !important;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.16) !important;

  .el-dialog__header {
    margin-right: 0 !important;
    padding: 18px 20px 12px !important;
    border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06)) !important;
  }

  .el-dialog__title {
    font-size: 16px !important;
    font-weight: 600 !important;
  }

  .el-dialog__body {
    padding: 20px !important;
    background: transparent !important;
  }

  .el-input__wrapper {
    background: transparent !important;
    border: 1px solid var(--border-color, #dcdfe6) !important;
    box-shadow: none !important;
    min-height: 40px !important;

    &.is-focus {
      border-color: var(--el-color-primary, #409eff) !important;
    }
  }
}
</style>

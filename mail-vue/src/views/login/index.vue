<template>
  <div id="login-box" data-build="v11" :data-login-theme="loginTheme" :style=" background ? 'background: var(--el-bg-color)' : ''" v-loading="oauthLoading" element-loading-text="登录中...">
    <aside class="login-brand-panel">
      <div class="brand-top">
        <span class="brand-mark">O</span>
        <div class="brand-word">
          <b>{{ settingStore.settings.title || 'otsmail' }}</b>
          <small>PRIVATE MAIL / 2026</small>
        </div>
      </div>
      <div class="brand-main">
        <span class="brand-kicker">{{ $t('loginKicker') }}</span>
        <h1>{{ $t('loginHeadline') }}</h1>
        <p>{{ $t('loginSubline') }}</p>
        <ul>
          <li>{{ $t('loginFeature1') }}</li>
          <li>{{ $t('loginFeature2') }}</li>
          <li>{{ $t('loginFeature3') }}</li>
        </ul>
      </div>
      <div class="login-fresh-art" aria-hidden="true">
        <svg viewBox="0 0 280 210" fill="none">
          <path d="M40 54h200v124H40z" stroke="currentColor" stroke-width="1.4"/>
          <path d="m42 56 98 74 98-74M42 176l73-66m123 66-73-66" stroke="currentColor" stroke-width="1.4"/>
          <path d="M140 8v58m0-26c-18 0-30-10-30-26 18 0 30 10 30 26Zm0 8c18 0 30-10 30-26-18 0-30 10-30 26Z" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="192" cy="26" r="5" fill="#e9765b"/>
        </svg>
      </div>
      <div class="login-gala-rail" aria-hidden="true"><span>OTSCUP</span><span>MAIL</span></div>
      <div class="login-postmark" aria-hidden="true">
        <span>OTS</span>
        <small>MAIL · 2026<br>DELIVERED</small>
      </div>
      <div class="login-letter-stack" aria-hidden="true">
        <div class="letter back"></div>
        <div class="letter mid"></div>
        <div class="letter front">
          <div class="letter-head"><span>INBOX / 09:41</span><span>OTSCUP</span></div>
          <div class="letter-from">
            <span class="letter-avatar">MC</span>
            <div><b>Maya Chen</b><small>maya@figma.com</small></div>
            <em>刚刚</em>
          </div>
          <div class="letter-subject">Friday's review,<br>ready when you are.</div>
          <div class="letter-snippet">Three directions attached. No rush — the second option is the one I'd pick.</div>
        </div>
      </div>
      <div class="brand-foot">
        <span>{{ $t('loginMeta') }}</span>
        <span>Cloudflare Workers</span>
      </div>
    </aside>
    <div id="background-wrap" v-if="!settingStore.settings.background">
      <div class="x1 cloud"></div>
      <div class="x2 cloud"></div>
      <div class="x3 cloud"></div>
      <div class="x4 cloud"></div>
      <div class="x5 cloud"></div>
    </div>
    <div v-else class="login-bg" :style="background"></div>
    <div class="form-wrapper">
      <div class="container">
        <span class="login-form-eyebrow">{{ show === 'login' ? $t('loginEyebrow') : $t('regBtn') }}</span>
        <span class="form-title">{{ settingStore.settings.title || 'otsmail' }}</span>
        <span class="form-desc" v-if="show === 'login'">{{ $t('loginTitle') }}</span>
        <span class="form-desc" v-else>{{ $t('regTitle') }}</span>
        <div v-show="show === 'login'">
          <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="form.email"
                    type="text" :placeholder="$t('emailAccount')" autocomplete="off" @keyup.enter="submit">
            <template #suffix v-if="!hideLoginDomain">
              <div class="domain-picker" :class="{ 'domain-picker-open': domainPickerOpen }" @click.stop="domainPickerOpen = !domainPickerOpen" ref="domainPickerRef">
                <span class="domain-picker-label">{{ suffix || $t('select') }}</span>
                <Icon icon="mingcute:down-line" width="14" height="14" class="domain-picker-arrow" />
                <transition name="domain-picker-fade">
                  <div v-if="domainPickerOpen && show === 'login'" class="domain-picker-dropdown">
                    <div
                      v-for="item in domainList"
                      :key="item"
                      class="domain-picker-option"
                      :class="{ active: suffix === item }"
                      @click.stop="suffix = item; domainPickerOpen = false"
                    >
                      {{ item }}
                      <Icon v-if="suffix === item" icon="mingcute:check-line" width="16" height="16" />
                    </div>
                  </div>
                </transition>
              </div>
            </template>
          </el-input>
          <el-input v-model="form.password" :placeholder="$t('password')" type="password" autocomplete="off" @keyup.enter="submit">
          </el-input>
          <template v-if="twoFactorShow">
            <el-input v-model="twoFactorCode" maxlength="6" inputmode="numeric"
                      :placeholder="$t('verifyCode')" autocomplete="one-time-code" @keyup.enter="submit"/>
            <div class="two-factor-hint">{{ $t('twoFactorLoginHint') }}</div>
          </template>
          <div class="login-action-bar">
            <el-button class="forgot-pwd-btn" link v-if="settingStore.settings.passwordResetSwitch" @click="openForgotPwd">
              {{ $t('forgotPassword') }}
            </el-button>
            <el-button class="qr-login-btn" link @click="openQr">{{ $t('qrLogin') }}</el-button>
          </div>
          <el-button class="btn" type="primary" @click="submit" :loading="loginLoading"
          >{{ $t('loginBtn') }}
          </el-button>
          <el-button v-if="supportsPasskey" class="btn passkey-login-btn" style="margin-top: 10px;" :loading="passkeyLoading" @click="passkeyLogin">
            <Icon icon="solar:key-minimalistic-square-line-duotone" width="18" height="18" style="margin-right: 6px;"/>
            使用 Passkey 通行密钥登录
          </el-button>
          <div class="login-divider" v-if="hasAltLogin"><span>{{ $t('or') || '或' }}</span></div>
          <div class="social-row" v-if="hasProviderButtons">
            <el-button class="provider-btn" v-if="settingStore.settings.linuxdoSwitch" @click="linuxDoLogin">
              <el-avatar src="/image/linuxdo.webp" :size="17" />LinuxDo
            </el-button>
            <el-button class="provider-btn" v-if="settingStore.settings.githubSwitch" @click="githubLogin">
              <Icon icon="mingcute:github-line" width="17" height="17" />GitHub
            </el-button>
            <el-button class="provider-btn" v-if="settingStore.settings.googleSwitch" @click="googleLogin">
              <Icon icon="flat-color-icons:google" width="17" height="17" />Google
            </el-button>
          </div>
          <div class="sso-stack" v-if="oidcProviders.length">
            <el-button class="sso-btn" v-for="provider in oidcProviders" :key="provider.id" @click="oidcLogin(provider.id)">
              <img v-if="isImageIcon(provider.icon)" :src="normalizeIcon(provider.icon)" class="oidc-provider-icon" alt=""/>
              <Icon v-else :icon="provider.icon || 'mingcute:shield-check-line'" width="16" height="16" />{{ provider.name || 'SSO' }}
            </el-button>
          </div>
        </div>
        <div v-show="show !== 'login'">
          <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="registerForm.email" type="text" :placeholder="$t('emailAccount')"
                    autocomplete="off" @keyup.enter="submitRegister">
            <template #suffix v-if="!hideLoginDomain">
              <div class="domain-picker" :class="{ 'domain-picker-open': domainPickerOpen }" @click.stop="domainPickerOpen = !domainPickerOpen" ref="domainPickerRef">
                <span class="domain-picker-label">{{ suffix || $t('select') }}</span>
                <Icon icon="mingcute:down-line" width="14" height="14" class="domain-picker-arrow" />
                <transition name="domain-picker-fade">
                  <div v-if="domainPickerOpen && show !== 'login'" class="domain-picker-dropdown">
                    <div
                      v-for="item in domainList"
                      :key="item"
                      class="domain-picker-option"
                      :class="{ active: suffix === item }"
                      @click.stop="suffix = item; domainPickerOpen = false"
                    >
                      {{ item }}
                      <Icon v-if="suffix === item" icon="mingcute:check-line" width="16" height="16" />
                    </div>
                  </div>
                </transition>
              </div>
            </template>
          </el-input>
          <el-input v-model="registerForm.password" :placeholder="$t('password')" type="password" autocomplete="off" @keyup.enter="submitRegister"/>
          <el-input v-model="registerForm.confirmPassword" :placeholder="$t('confirmPwd')" type="password"
                    autocomplete="off" @keyup.enter="submitRegister"/>
          <el-input v-if="settingStore.settings.regKey === 0" v-model="registerForm.code" :placeholder="$t('regKey')"
                    type="text" autocomplete="off" @keyup.enter="submitRegister"/>
          <el-input v-if="settingStore.settings.regKey === 2" v-model="registerForm.code"
                    :placeholder="$t('regKeyOptional')" type="text" autocomplete="off" @keyup.enter="submitRegister"/>
          <div v-show="verifyShow"
               class="register-turnstile"
               :data-sitekey="settingStore.settings.siteKey"
               data-callback="onTurnstileSuccess"
               data-error-callback="onTurnstileError"
               data-after-interactive-callback="loadAfter"
               data-before-interactive-callback="loadBefore"
          >
            <span style="font-size: 12px;color: #F56C6C" v-if="botJsError">{{ $t('verifyModuleFailed') }}</span>
          </div>
          <el-button class="btn" style="margin: 0" type="primary" @click="submitRegister" :loading="registerLoading"
          >{{ $t('regBtn') }}
          </el-button>
          <el-button v-if="settingStore.settings.linuxdoSwitch" class="btn" style="margin-top: 10px"  @click="linuxDoLogin">
            <el-avatar src="/image/linuxdo.webp" :size="18" style="margin-right: 10px" />LinuxDo
          </el-button>
          <el-button v-if="settingStore.settings.githubSwitch" class="btn" style="margin-top: 10px" @click="githubLogin">
            <Icon icon="mingcute:github-line" width="18" height="18" style="margin-right: 10px; color: var(--label)" />GitHub
          </el-button>
          <el-button v-if="settingStore.settings.googleSwitch" class="btn" style="margin-top: 10px" @click="googleLogin">
            <Icon icon="flat-color-icons:google" width="18" height="18" style="margin-right: 10px" />Google
          </el-button>
        </div>
        <template v-if="settingStore.settings.register === 0">
          <div class="switch" @click="show = 'register'" v-if="show === 'login'">{{ $t('noAccount') }}
            <span>{{ $t('regSwitch') }}</span></div>
          <div class="switch" @click="show = 'login'" v-else>{{ $t('hasAccount') }} <span>{{ $t('loginSwitch') }}</span>
          </div>
        </template>
      </div>
    </div>
    <el-dialog class="bind-dialog" v-model="showBindForm"  title="注册邮箱" >
      <div class="bind-container">
        <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="bindForm.email" type="text" :placeholder="$t('emailAccount')" autocomplete="off" @keyup.enter="bind">
          <template #suffix v-if="!hideLoginDomain">
              <div class="domain-picker" @click.stop="domainPickerOpen = !domainPickerOpen">
                <span class="domain-picker-label">{{ suffix || $t('select') }}</span>
                <Icon icon="mingcute:down-line" width="14" height="14" class="domain-picker-arrow" />
                <div v-if="domainPickerOpen && showBindForm" class="domain-picker-dropdown">
                  <div
                    v-for="item in domainList"
                    :key="item"
                    class="domain-picker-option"
                    :class="{ active: suffix === item }"
                    @click.stop="suffix = item; domainPickerOpen = false"
                  >
                    {{ item }}
                    <Icon v-if="suffix === item" icon="mingcute:check-line" width="16" height="16" />
                  </div>
                </div>
              </div>
            </template>
        </el-input>
        <el-input v-if="settingStore.settings.regKey === 0" v-model="bindForm.code" :placeholder="$t('regKey')"
                  type="text" autocomplete="off" @keyup.enter="bind"/>
        <el-input v-if="settingStore.settings.regKey === 2" v-model="bindForm.code"
                  :placeholder="$t('regKeyOptional')" type="text" autocomplete="off" @keyup.enter="bind"/>
        <el-button class="btn" type="primary" @click="bind" :loading="bindLoading"
        >绑定
        </el-button>
      </div>
    </el-dialog>
    <el-dialog v-model="qrShow" :title="$t('qrLogin')" width="300" class="qr-dialog" @closed="stopQrPoll">
      <div class="qr-box">
        <img v-if="qrImage" :src="qrImage" alt="QR" class="qr-image"/>
        <div v-if="qrStatus === 'expired'" class="qr-tip">{{ $t('qrExpired') }}</div>
        <div v-else class="qr-tip">{{ $t('qrScanTip') }}</div>
      </div>
    </el-dialog>

    <!-- 找回密码弹窗 -->
    <el-dialog v-model="forgotShow" :title="$t('forgotPassword')" width="360" class="forgot-dialog" append-to-body>
      <div class="forgot-box">
        <el-input v-model="forgotEmail" :placeholder="$t('emailAccount')" :disabled="forgotStep === 2" style="margin-bottom: 12px;"/>
        <template v-if="forgotStep === 1">
          <div class="forgot-tip" style="font-size: 13px; color: var(--text-color-secondary, #64748b); margin-bottom: 16px;">
            输入您的 OTSMail 邮箱账号，系统将向您绑定的安全辅助邮箱发送 6 位验证码。
          </div>
          <el-button type="primary" style="width: 100%;" :loading="forgotLoading" @click="handleSendForgotCode">
            获取验证码
          </el-button>
        </template>
        <template v-else>
          <div class="forgot-tip" style="font-size: 13px; color: var(--text-color-secondary, #64748b); margin-bottom: 12px;">
            验证码已发送至辅助邮箱 <strong style="color: #2563eb;">{{ maskedEmail }}</strong>，请查收（10 分钟内有效）。
          </div>
          <el-input v-model="forgotCode" maxlength="6" :placeholder="$t('verifyCode')" style="margin-bottom: 12px;"/>
          <el-input v-model="forgotNewPwd" type="password" :placeholder="$t('password')" style="margin-bottom: 12px;"/>
          <el-button type="primary" style="width: 100%;" :loading="forgotLoading" @click="handleConfirmForgot">
            确认重置密码
          </el-button>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import router from "@/router";
import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref} from "vue";
import {login} from "@/request/login.js";
import {register} from "@/request/login.js";
import {qrCreate, qrPoll, sendPasswordResetCode, confirmPasswordReset} from "@/request/login.js";
import QRCode from 'qrcode';
import {versionLatest} from "@/request/version.js";
import {ElNotification} from "element-plus";
import {websiteConfig} from "@/request/setting.js";
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useUserStore} from "@/store/user.js";
import {useUiStore} from "@/store/ui.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url} from "@/utils/convert.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import {useI18n} from "vue-i18n";
import {
  oauthBindUser,
  oauthLinuxDoLogin,
  oauthGithubLogin,
  oauthGoogleLogin,
  oauthBind,
  oauthOidcLogin,
  oidcConfig
} from "@/request/ouath.js";
import {setToken} from "@/utils/token-store.js";
import {createPkce, takePkce} from "@/utils/pkce.js";
import {normalizeLoginTheme, DEFAULT_LOGIN_THEME} from './themes.js';
import {applySkin, getSavedSkin, getStoredSkin, loginThemeForSkin} from '@/utils/appearance.js';

const {t} = useI18n();
const accountStore = useAccountStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const settingStore = useSettingStore();
const loginTheme = computed(() => {
  // 浏览器存过皮肤就用皮肤对应的登录页；没存过（新访客）才用后台“登录页皮肤”设置。
  const skin = getSavedSkin()
  return skin ? loginThemeForSkin(skin) : normalizeLoginTheme(settingStore.settings.loginTheme)
});
const hasProviderButtons = computed(() =>
    Boolean(settingStore.settings.linuxdoSwitch || settingStore.settings.githubSwitch || settingStore.settings.googleSwitch)
);
const hasAltLogin = computed(() => hasProviderButtons.value || oidcProviders.value.length > 0);
const loginLoading = ref(false)
const twoFactorShow = ref(false)
const twoFactorCode = ref('')
const bindLoading = ref(false)
const oauthLoading = ref(false);
const oidcProviders = computed(() => {
  const list = settingStore.settings.oidcProviders
  if (Array.isArray(list) && list.length > 0) return list
  // 兼容老后端：只有单条 oidc_* 配置
  return settingStore.settings.oidcSwitch
      ? [{id: '', name: settingStore.settings.oidcName || 'SSO'}]
      : []
})
function normalizeIcon(icon) {
  return String(icon || '').replace(/\\\//g, '/').replace(/\\:/g, ':').trim()
}
function isImageIcon(icon) {
  return /^(https?:\/\/|data:image\/|\/\/|\/)/i.test(normalizeIcon(icon))
}
const showBindForm = ref(false);
const show = ref('login')

const bindForm = reactive({
  email: '',
  oauthUserId: '',
  provider: '',
  code: '',
  bindToken: '',
  nonce: ''
})

const form = reactive({
  email: '',
  password: '',

});
const suffix = ref('')
const domainPickerOpen = ref(false)
const domainPickerRef = ref(null)

const handleClickOutside = (e) => {
  if (domainPickerRef.value && !domainPickerRef.value.contains(e.target)) {
    domainPickerOpen.value = false
  }
}

async function checkLatestVersion() {
  try {
    const data = await versionLatest()
    if (!data?.hasUpdate || !data.latest) return
    ElNotification({
      title: t('loginUpdateTitle'),
      message: t('loginUpdateMessage', { latest: data.latest }),
      type: 'info',
      duration: 8000,
      onClick: () => {
        if (data.url) window.open(data.url, '_blank', 'noopener')
      }
    })
  } catch {
    // 更新检查失败不能影响登录。
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  checkLatestVersion()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  stopQrPoll()
})

// 扫码登录：网页只负责展示二维码和轮询，App 用已登录会话确认。
const qrShow = ref(false)
const qrImage = ref('')
const qrStatus = ref('pending')
let qrTimer = null

function stopQrPoll() {
  if (qrTimer) {
    clearInterval(qrTimer)
    qrTimer = null
  }
}

async function openQr() {
  qrShow.value = true
  qrStatus.value = 'pending'
  qrImage.value = ''
  stopQrPoll()
  try {
    const res = await qrCreate()
    const payload = JSON.stringify({ type: 'otsmail-login', id: res.id })
    qrImage.value = await QRCode.toDataURL(payload, { margin: 1, width: 220 })
    qrTimer = setInterval(async () => {
      try {
        const poll = await qrPoll(res.id)
        if (poll.status === 'confirmed' && poll.token) {
          stopQrPoll()
          qrStatus.value = 'confirmed'
          qrShow.value = false
          await saveToken(poll.token)
        } else if (poll.status === 'expired') {
          stopQrPoll()
          qrStatus.value = 'expired'
        }
      } catch (e) {
        stopQrPoll()
        qrStatus.value = 'expired'
      }
    }, 2000)
  } catch (e) {
    qrStatus.value = 'expired'
  }
}

// 找回密码状态与逻辑
const forgotShow = ref(false)
const forgotStep = ref(1)
const forgotLoading = ref(false)
const forgotEmail = ref('')
const forgotCode = ref('')
const forgotNewPwd = ref('')
const maskedEmail = ref('')

// Passkey (WebAuthn) 免密登录
const supportsPasskey = computed(() => typeof window !== 'undefined' && !!window.PublicKeyCredential)
const passkeyLoading = ref(false)

async function passkeyLogin() {
  passkeyLoading.value = true
  try {
    const optRes = await fetch('/api/login/passkey/options', { method: 'POST' }).then(r => r.json())
    if (optRes.code !== 200) throw new Error(optRes.message || '获取登录凭证失败')

    const options = optRes.data
    options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

    const assertion = await navigator.credentials.get({ publicKey: options })
    const verifyData = {
      id: assertion.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
      type: assertion.type,
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
        signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature)))
      }
    }

    const verifyRes = await fetch('/api/login/passkey/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyData)
    }).then(r => r.json())

    if (verifyRes.code === 200 && verifyRes.data?.token) {
      ElNotification({ type: 'success', message: 'Passkey 登录成功！' })
      await saveToken(verifyRes.data.token)
    } else {
      throw new Error(verifyRes.message || 'Passkey 验证失败')
    }
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      ElNotification({ type: 'error', message: e.message || 'Passkey 登录失败' })
    }
  } finally {
    passkeyLoading.value = false
  }
}

function openForgotPwd() {
  forgotEmail.value = form.email ? getFullEmail(form.email) : ''
  forgotCode.value = ''
  forgotNewPwd.value = ''
  forgotStep.value = 1
  forgotShow.value = true
}

async function handleSendForgotCode() {
  if (!forgotEmail.value) {
    ElNotification({ type: 'warning', message: '请输入邮箱账号' })
    return
  }
  forgotLoading.value = true
  try {
    const res = await sendPasswordResetCode(forgotEmail.value)
    maskedEmail.value = res.maskedRecoveryEmail
    forgotStep.value = 2
    ElNotification({ type: 'success', message: '验证码已发送至辅助邮箱' })
  } catch (e) {
    ElNotification({ type: 'error', message: e.message || '获取验证码失败' })
  } finally {
    forgotLoading.value = false
  }
}

async function handleConfirmForgot() {
  if (!forgotCode.value || !forgotNewPwd.value) {
    ElNotification({ type: 'warning', message: '请输入验证码和新密码' })
    return
  }
  forgotLoading.value = true
  try {
    await confirmPasswordReset(forgotEmail.value, forgotCode.value, forgotNewPwd.value)
    ElNotification({ type: 'success', message: '密码重置成功，请使用新密码登录' })
    forgotShow.value = false
    form.password = ''
  } catch (e) {
    ElNotification({ type: 'error', message: e.message || '重置密码失败' })
  } finally {
    forgotLoading.value = false
  }
}

const registerForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  code: null
})
const domainList = settingStore.domainList;
const registerLoading = ref(false)
suffix.value = domainList[0]
const verifyShow = ref(false)
let verifyToken = ''
let turnstileId = null
let botJsError = ref(false)
let verifyErrorCount = 0

window.onTurnstileSuccess = (token) => {
  verifyToken = token;
};

window.onTurnstileError = (e) => {
  if (verifyErrorCount >= 4) {
    return
  }
  verifyErrorCount++
  console.warn('人机验加载失败', e)
  setTimeout(() => {
    nextTick(() => {
      if (!turnstileId) {
        turnstileId = window.turnstile.render('.register-turnstile')
      } else {
        window.turnstile.reset(turnstileId);
      }
    })
  }, 1500)
};

window.loadAfter = (e) => {
  console.log('loadAfter')
}

window.loadBefore = (e) => {
  console.log('loadBefore')
}

const loginOpacity = computed(() => {
  const opacity = settingStore.settings.loginOpacity
  return uiStore.dark ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`
})

// 玻璃卡片必须留出透光率：后台把不透明度拉到 1 时，纯白底会让 backdrop-filter 完全失效。
const loginGlass = computed(() => {
  const raw = Number(settingStore.settings.loginOpacity)
  const opacity = Math.min(Number.isFinite(raw) ? raw : 1, uiStore.dark ? 0.62 : 0.72)
  return uiStore.dark ? `rgba(12, 16, 24, ${opacity})` : `rgba(255, 255, 255, ${opacity})`
})

const hideLoginDomain = computed(() => settingStore.settings.loginDomain === 1)

const background = computed(() => {

  return settingStore.settings.background ? {
    'background-image': `url(${cvtR2Url(settingStore.settings.background)})`,
    'background-repeat': 'no-repeat',
    'background-size': 'cover',
    'background-position': 'center'
  } : ''
})

const getFullEmail = (email) => {
  return hideLoginDomain.value ? email : email + suffix.value
}

const getEmailName = (email) => {
  return email.split('@')[0]
}

function oauthNonce() {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `oauth_nonce=${nonce}; Path=/; SameSite=Lax${secure}`
  return nonce
}

function linuxDoLogin() {
  const clientId = settingStore.settings.linuxdoClientId
  const redirectUri = encodeURIComponent(settingStore.settings.linuxdoCallbackUrl)
  window.location.href =
      `https://connect.linux.do/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=linuxdo:${oauthNonce()}`
}

function githubLogin() {
  const clientId = settingStore.settings.githubClientId
  const redirectUri = encodeURIComponent(settingStore.settings.githubCallbackUrl)
  window.location.href =
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user&state=github:${oauthNonce()}`
}

function googleLogin() {
  const clientId = settingStore.settings.googleClientId
  const redirectUri = encodeURIComponent(settingStore.settings.googleCallbackUrl)
  window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&state=google:${oauthNonce()}`
}

async function oidcLogin(providerId) {
  // 授权端点由后端 discovery 取，后台改配置不用动前端
  try {
    const config = await oidcConfig(providerId)
    const nonce = oauthNonce()
    const state = (providerId ? 'oidc:' + providerId : 'oidc') + ':' + nonce
    const {challenge} = await createPkce(state)
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      response_type: 'code',
      scope: config.scope || 'openid profile email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    })
    window.location.href = config.authorizationEndpoint + '?' + params.toString()
  } catch (e) {
    ElMessage({message: e?.message || 'OIDC 配置读取失败', type: 'error', plain: true})
  }
}

oauthGetUser();

async function oauthGetUser() {

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const oauthError = params.get('error_description') || params.get('error')

  // Android App 用系统浏览器走 OIDC：IdP 只注册了网页回调，需在 takePkce 消费 code 前原样转回 App。
  // 网页 nonce 是纯 32 位 hex，只有 App 会拼 app 后缀，因此不会误伤网页登录。
  const bridgeNonce = (state || '').split(':').pop() || ''
  if (/^[0-9a-f]{32}app$/.test(bridgeNonce)) {
    const q = new URLSearchParams()
    if (code) q.set('code', code)
    if (state) q.set('state', state)
    if (oauthError) q.set('error_description', oauthError)
    const target = 'otsmail://oauth/callback?' + q.toString()
    try {
      window.location.replace(target)
    } catch (e) {
      // 浏览器拒绝自定义 scheme 时，下面给可点击链接兜底。
    }
    setTimeout(() => {
      if (document.getElementById('ots-app-bridge')) return
      const a = document.createElement('a')
      a.id = 'ots-app-bridge'
      a.href = target
      a.textContent = '返回 OTSMail 完成登录'
      a.style.cssText = 'display:block;margin:24px auto;padding:14px 22px;max-width:260px;' +
        'text-align:center;border-radius:10px;background:#111;color:#fff;' +
        'font:600 16px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;text-decoration:none'
      document.body.appendChild(a)
    }, 1200)
    return
  }

  if (!code && oauthError) {
    ElMessage({message: oauthError, type: 'error', plain: true, duration: 6000})
  }

  if (code) {
    const codeVerifier = takePkce(state || '')

    const providerMap = { github: oauthGithubLogin, google: oauthGoogleLogin, linuxdo: oauthLinuxDoLogin, oidc: oauthOidcLogin }
    // state 形如 github / oidc:<id>（登录）或 bind-github / bind-oidc:<id>（个人设置里绑定）
    const isBindState = (state || '').startsWith('bind')
    const rawProvider = isBindState ? state.replace(/^bind-/, '') : (state || '')
    const [provider, ...providerIdParts] = rawProvider.split(':')
    const nonce = providerIdParts.pop() || ''
    const providerId = providerIdParts.join(':')
    const loginFn = providerMap[provider] || oauthLinuxDoLogin
    // OIDC 需要 provider/codeVerifier；GitHub/Google/LinuxDo 只取 code/state/nonce。
    const runLogin = () => provider === 'oidc'
      ? loginFn(code, state, providerId, codeVerifier, nonce)
      : loginFn(code, state, nonce)

    oauthLoading.value = true

    // v1.3 登录态绑定（大网站模式）：state=bind 时已登录用户把 OAuth 授权绑到当前账号
    if (isBindState) {
      runLogin().then(data => {
        // 授权落库但未绑定 → 绑到当前登录账号；这里绝不能用返回的 token 换会话（那是别人的账号）
        oauthBind({ oauthUserId: data.userInfo.oauthUserId, provider: data.userInfo.provider, bindToken: data.bindToken, nonce }).then(() => {
          ElMessage({ message: '绑定成功', type: 'success', plain: true })
          router.replace('/settings')
        }).catch(() => {
          router.replace('/settings')
        }).finally(() => {
          oauthLoading.value = false
        })
      }).catch(() => {
        oauthLoading.value = false
        router.replace('/settings')
      })
      return
    }

    runLogin().then(data => {

      bindForm.oauthUserId = data.userInfo.oauthUserId;
      bindForm.provider = data.userInfo.provider;
      bindForm.bindToken = data.bindToken || '';
      bindForm.nonce = nonce;

      if (!data.token) {
        showBindForm.value = true
        oauthLoading.value = false
        ElMessage({
          message: '请注册绑定一个邮箱',
          type: 'warning',
          duration: 4000,
          plain: true,
        })
        return;
      }

      saveToken(data.token);
    }).catch(() => {
      oauthLoading.value = false
    })
  }

  const cleanUrl = window.location.origin + window.location.pathname
  window.history.replaceState({}, '', cleanUrl)
}

function bind() {

  if (bindLoading.value) return

  if (!bindForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }


  if (getEmailName(bindForm.email).length < settingStore.settings.minEmailPrefix) {
    ElMessage({
      message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}),
      type: 'error',
      plain: true,
    })
    return
  }

  let email = getFullEmail(bindForm.email);


  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (settingStore.settings.regKey === 0) {

    if (!bindForm.code) {

      ElMessage({
        message: t('emptyRegKeyMsg'),
        type: 'error',
        plain: true,
      })
      return
    }

  }

  const form = {email, oauthUserId: bindForm.oauthUserId, provider: bindForm.provider, code: bindForm.code, bindToken: bindForm.bindToken, nonce: bindForm.nonce}

  bindLoading.value = true
  oauthBindUser(form).then(data => {
    saveToken(data.token)
  }).catch(() => {
    bindLoading.value = false
  })
}

const submit = () => {

  if (loginLoading.value) return

  if (!form.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  let email = getFullEmail(form.email);

  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
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

  loginLoading.value = true
  login(email, form.password, twoFactorCode.value).then(async data => {
    await saveToken(data.token)
  }).catch(e => {
    if (e?.code === 428) {
      twoFactorShow.value = true
      twoFactorCode.value = ''
      ElMessage({
        message: e.message || t('twoFactorLoginHint'),
        type: 'warning',
        plain: true
      })
    }
  }).finally(() => {
    loginLoading.value = false
  })
}

async function saveToken(token) {
  setToken(token)
  refreshWebsiteConfig()
  const user = await loginUserInfo();
  accountStore.currentAccountId = user.account.accountId;
  accountStore.currentAccount = user.account;
  userStore.user = user;
  if (user.skin) applySkin(user.skin);
  const routers = permsToRouter(user.permKeys);
  routers.forEach(routerData => {
    router.addRoute('layout', routerData);
  });
  await router.replace({name: 'layout'})
  uiStore.showNotice()
  oauthLoading.value = false;
  bindLoading.value = false;
}

function refreshWebsiteConfig() {
  websiteConfig().then(setting => {
    settingStore.settings = setting
    settingStore.domainList = setting.domainList
    if (!suffix.value && setting.domainList.length > 0) {
      suffix.value = setting.domainList[0]
    }
    document.title = setting.title
  }).catch(e => {
    console.error(e)
  })
}


function submitRegister() {

  if (registerLoading.value) return

  if (!registerForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  console.log(registerForm.email)

  if (getEmailName(registerForm.email).length < settingStore.settings.minEmailPrefix) {
    ElMessage({
      message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}),
      type: 'error',
      plain: true,
    })
    return
  }

  const email = getFullEmail(registerForm.email);

  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!registerForm.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (registerForm.password.length < 6) {
    ElMessage({
      message: t('pwdLengthMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {

    ElMessage({
      message: t('confirmPwdFailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (settingStore.settings.regKey === 0) {

    if (!registerForm.code) {

      ElMessage({
        message: t('emptyRegKeyMsg'),
        type: 'error',
        plain: true,
      })
      return
    }

  }

  if (!verifyToken && (settingStore.settings.registerVerify === 0 || (settingStore.settings.registerVerify === 2 && settingStore.settings.regVerifyOpen))) {
    if (!verifyShow.value) {
      verifyShow.value = true
      nextTick(() => {
        if (!turnstileId) {
          try {
            turnstileId = window.turnstile.render('.register-turnstile')
          } catch (e) {
            botJsError.value = true
            console.log('人机验证js加载失败')
          }
        } else {
          window.turnstile.reset('.register-turnstile')
        }
      })
    } else if (!botJsError.value) {
      ElMessage({
        message: t('botVerifyMsg'),
        type: "error",
        plain: true
      })
    }
    return;
  }

  registerLoading.value = true

  const form = {
    email,
    password: registerForm.password,
    token: verifyToken,
    code: registerForm.code
  }

  register(form).then(({regVerifyOpen}) => {
    show.value = 'login'
    registerForm.email = ''
    registerForm.password = ''
    registerForm.confirmPassword = ''
    registerForm.code = ''
    registerLoading.value = false
    verifyToken = ''
    settingStore.settings.regVerifyOpen = regVerifyOpen
    verifyShow.value = false
    ElMessage({
      message: t('regSuccessMsg'),
      type: 'success',
      plain: true,
    })
  }).catch(res => {

    registerLoading.value = false

    if (res.code === 400) {
      verifyToken = ''
      settingStore.settings.regVerifyOpen = true
      if (turnstileId) {
        window.turnstile.reset(turnstileId)
      } else {
        nextTick(() => {
          turnstileId = window.turnstile.render('.register-turnstile')
        })
      }
      verifyShow.value = true

    }
  });
}

</script>


<style>
.el-select-dropdown__item {
  padding: 0 15px;
}

.no-autofill-pwd {
  .el-input__inner {
    -webkit-text-security: disc !important;
  }
}
</style>

<style lang="scss" scoped>

.form-wrapper {
  position: fixed;
  right: 0;
  height: 100%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  @media (max-width: 767px) {
    width: 100%;
  }
}

.container {
  background: v-bind(loginOpacity);
  padding-left: 40px;
  padding-right: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 450px;
  height: 100%;
  border-left: 1px solid var(--login-border);
  box-shadow: var(--el-box-shadow-light);
  @media (max-width: 1024px) {
    padding: 20px 18px;
    width: 384px;
    margin-left: 18px;
  }
  @media (max-width: 767px) {
    border: 1px solid var(--login-border);
    padding: 20px 18px;
    border-radius: 6px;
    height: fit-content;
    width: 100%;
    margin-right: 18px;
    margin-left: 18px;
  }

  .btn {
    height: 36px;
    width: 100%;
    border-radius: 6px;
  }

  .login-action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin: 4px 0 8px;

    .forgot-pwd-btn, .qr-login-btn {
      margin: 0 !important;
      padding: 0;
      font-size: 12px;
      color: var(--rd-muted) !important;
    }
  }

  .qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 4px 0 8px;
  }

  .qr-image {
    width: 220px;
    height: 220px;
    border-radius: 10px;
    background: #fff;
    padding: 6px;
  }

  .qr-tip {
    font-size: 12px;
    color: var(--rd-muted);
    text-align: center;
  }

  .oidc-provider-icon {
    width: 18px;
    height: 18px;
    margin-right: 10px;
    object-fit: contain;
    border-radius: 4px;
    vertical-align: middle;
  }

  .form-desc {
    margin-top: 5px;
    margin-bottom: 18px;
    color: var(--form-desc-color);
  }

  .two-factor-hint {
    margin: -8px 0 12px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--label-3, var(--form-desc-color));
  }

  .form-title {
    font-weight: bold;
    font-size: 22px !important;
  }

  .switch {
    margin-top: 20px;
    text-align: center;

    span {
      color: var(--login-switch-color);
      cursor: pointer;
    }
  }

  :deep(.el-input__wrapper) {
    border-radius: 6px;
    background: var(--el-bg-color);
  }

  .email-input :deep(.el-input__wrapper) {
    border-radius: 10px 0 0 10px;
    background: var(--fill-tertiary);
    border: none !important;
    box-shadow: none !important;
  }

  .el-input {
    height: 38px;
    width: 100%;
    margin-bottom: 18px;

    :deep(.el-input__inner) {
      height: 36px;
    }
  }
}

:deep(.el-select-dropdown__item) {
  padding: 0 10px;
}

:deep(.bind-dialog) {
  width: 400px !important;
  @media (max-width: 440px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

.bind-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
}

.setting-icon {
  position: relative;
  top: 6px;
}

:deep(.el-input-group__append) {
  padding: 0 !important;
  background: var(--fill-tertiary);
  border: none !important;
  border-radius: 0 10px 10px 0;
}

:deep(.el-button+.el-button) {
  margin: 0;
}

.register-turnstile {
  margin-bottom: 18px;
}

.custom-style {
  margin-bottom: 10px;
}

.custom-style .el-segmented {
  --el-border-radius-base: 6px;
  width: 180px;
}


.form-wrapper { right: 5%; width: 400px; }
.form-wrapper .container { width: min(420px, 100%); height: auto; padding: 36px; border-radius: 24px; background: rgba(255,255,255,.94) !important; box-shadow: 0 24px 70px rgba(15,23,42,.14), 0 2px 8px rgba(15,23,42,.06); }
.form-wrapper .form-title { font-size: 30px !important; letter-spacing: -.8px; }
@media (max-width: 900px) {
  .form-wrapper { right: 0; width: 100%; }
  .form-wrapper .container { width: min(420px, calc(100vw - 32px)); padding: 28px 24px; }
}
#login-box {
  background: #f4f6fb;
  font: 100% Arial, sans-serif;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: 1fr;
}


/* 自定义背景图与云层都要铺满整屏：flex 布局下子元素不会自动撑开 */
#background-wrap,
.login-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
#background-wrap { display: none !important; }
.login-bg { display: block !important; }

@keyframes animateCloud {
  0% {
    margin-left: -500px;
  }

  100% {
    margin-left: 100%;
  }
}

.x1 {
  animation: animateCloud 30s linear infinite;
  transform: scale(0.65);
}

.x2 {
  animation: animateCloud 15s linear infinite;
  transform: scale(0.3);
}

.x3 {
  animation: animateCloud 25s linear infinite;
  transform: scale(0.5);
}

.x4 {
  animation: animateCloud 13s linear infinite;
  transform: scale(0.4);
}

.x5 {
  animation: animateCloud 20s linear infinite;
  transform: scale(0.55);
}

.cloud {
  background: linear-gradient(to bottom, #fff 5%, #f1f1f1 100%);
  border-radius: 100px;
  box-shadow: 0 8px 5px rgba(0, 0, 0, 0.1);
  height: 120px;
  width: 350px;
  position: relative;
}

.cloud:after,
.cloud:before {
  content: "";
  position: absolute;
  background: #fff;
  z-index: -1;
}

.cloud:after {
  border-radius: 100px;
  height: 100px;
  left: 50px;
  top: -50px;
  width: 100px;
}

.cloud:before {
  border-radius: 200px;
  height: 180px;
  width: 180px;
  right: 50px;
  top: -90px;
}

/* 2026 商用登录：左品牌、右表单；移动端只保留表单 */
#login-box {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(420px, .85fr);
  background: #eef1f6;
  font-family: Inter, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.login-brand-panel {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px clamp(40px, 6vw, 88px);
  overflow: hidden;
  color: #f7f9fc;
  background:
    radial-gradient(circle at 78% 18%, rgba(36, 84, 214, .22), transparent 34%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 72px),
    #0b1424;
}
.login-brand-panel::after {
  content: "";
  position: absolute;
  right: -120px;
  bottom: -180px;
  width: 480px;
  height: 480px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 50%;
  box-shadow: 0 0 0 48px rgba(255,255,255,.025), 0 0 0 112px rgba(255,255,255,.018);
  pointer-events: none;
}
.brand-top { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
.brand-mark {
  width: 38px; height: 38px; border-radius: 11px;
  display: grid; place-items: center;
  background: #f7f9fc; color: #0b1424;
  font-size: 20px; font-weight: 850; letter-spacing: -.08em;
}
.brand-word { display: grid; gap: 2px; }
.brand-word b { font-size: 15px; letter-spacing: -.02em; }
.brand-word small { font-size: 9px; letter-spacing: .16em; color: rgba(247,249,252,.5); }
.brand-main { position: relative; z-index: 1; max-width: 620px; }
.brand-kicker {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10px; font-weight: 700; letter-spacing: .18em; color: #9db8ff;
}
.brand-kicker::before { content: ""; width: 24px; height: 1px; background: #9db8ff; }
.brand-main h1 {
  margin: 22px 0 18px;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", serif;
  font-size: clamp(38px, 3.8vw, 56px);
  line-height: 1.06;
  letter-spacing: -.045em;
  font-weight: 500;
}
.brand-main p {
  max-width: 470px;
  margin: 0;
  color: rgba(247,249,252,.62);
  font-size: 14px;
  line-height: 1.8;
}
.brand-main ul {
  display: flex; flex-wrap: wrap; gap: 10px 22px;
  margin: 34px 0 0; padding: 0; list-style: none;
  color: rgba(247,249,252,.76); font-size: 12px;
}
.brand-main li { display: inline-flex; align-items: center; gap: 7px; }
.brand-main li::before { content: ""; width: 4px; height: 4px; border-radius: 50%; background: #6f9bff; }
.brand-foot {
  display: flex; justify-content: space-between; gap: 16px;
  position: relative; z-index: 1;
  padding-top: 22px; border-top: 1px solid rgba(255,255,255,.1);
  color: rgba(247,249,252,.38); font-size: 10px; letter-spacing: .04em;
}

.form-wrapper {
  position: relative;
  right: auto;
  width: auto;
  height: 100%;
  min-height: 100dvh;
  padding: 40px 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.form-wrapper .container {
  width: min(410px, 100%);
  height: auto;
  padding: 38px 36px 32px;
  border: 1px solid #e3e8f0;
  border-radius: 18px;
  background: #fff !important;
  box-shadow: 0 24px 64px rgba(18,32,56,.09), 0 2px 8px rgba(18,32,56,.04);
}
.login-form-eyebrow {
  margin-bottom: 8px;
  color: #2454d6;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.form-wrapper .form-title {
  font-size: 27px !important;
  line-height: 1.2;
  letter-spacing: -.035em;
}
.form-wrapper .form-desc {
  margin: 7px 0 22px;
  font-size: 12px;
  line-height: 1.55;
  color: #7b8494;
}
.form-wrapper .container .el-input {
  height: 44px;
  margin-bottom: 13px;
}
.form-wrapper .container .el-input :deep(.el-input__inner) {
  height: 42px;
  font-size: 13px;
}
.form-wrapper .container :deep(.el-input__wrapper) {
  border-radius: 10px;
  background: #f6f8fb;
  box-shadow: inset 0 0 0 1px #e6eaf1;
}
.form-wrapper .container :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #2454d6, 0 0 0 3px rgba(36,84,214,.08);
}
.form-wrapper .container .btn {
  height: 44px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 650;
}
.form-wrapper .container .btn.el-button--primary {
  background: #2454d6;
  border-color: #2454d6;
  box-shadow: 0 8px 20px rgba(36,84,214,.18);
}
.form-wrapper .container .btn.el-button--primary:hover { background: #1f48bb; border-color: #1f48bb; }
.form-wrapper .container .btn + .btn { margin-top: 8px; }
.form-wrapper .container .switch {
  margin-top: 18px;
  color: #8a93a3;
  font-size: 12px;
}
.form-wrapper .container .switch span { color: #2454d6; font-weight: 650; }

@media (max-width: 900px) {
  #login-box { grid-template-columns: 1fr; min-height: 100dvh; }
  .login-brand-panel { display: none; }
  .form-wrapper {
    min-height: 100dvh;
    padding: 20px;
    background: #eef1f6;
  }
  .form-wrapper .container { padding: 30px 22px 26px; border-radius: 16px; }
  .form-wrapper .form-title { font-size: 24px !important; }
}

/* ---------- 登录页皮肤套件：Paper / Centered ---------- */
#login-box[data-login-theme="paper"] .login-bg { display: none !important; }
#login-box[data-login-theme="paper"] { background: #fbf9f4 !important; }
#login-box[data-login-theme="centered"] .login-bg { display: block !important; }
#login-box[data-login-theme="centered"] {
  display: block !important;
  grid-template-columns: none !important;
  background: radial-gradient(circle at 50% 0%, rgba(36,84,214,.07), transparent 34%), linear-gradient(180deg, #f4f6fb 0%, #eef2f8 100%) !important;
}
#login-box[data-login-theme="centered"] .login-bg {
  background-position: center !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
  /* 玻璃要有东西可糊：0.26 的底图几乎看不见，毛玻璃就成了白板。 */
  opacity: .62 !important;
  filter: none !important;
}
#login-box[data-login-theme="paper"] {
  --paper-ink: #0b1b2b;
  --paper-muted: #6f746f;
  --paper-line: #d4cec1;
  --paper-accent: #2452d8;
  --paper-rose: #ad5f38;
  grid-template-columns: minmax(0, 1.15fr) minmax(420px, .85fr);
  background: #fbf9f4;
}
#login-box[data-login-theme="paper"] .login-brand-panel {
  padding: 54px 64px 46px;
  color: #f4f0e6;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 120px),
    #0b1b2b;
}
#login-box[data-login-theme="paper"] .login-brand-panel::after { display: none; }
#login-box[data-login-theme="paper"] .brand-mark {
  width: 27px;
  height: 27px;
  border: 1px solid rgba(244,240,230,.36);
  border-radius: 0;
  background: transparent;
  color: #f4f0e6;
  font-size: 10px;
  letter-spacing: .05em;
}
#login-box[data-login-theme="paper"] .brand-top { gap: 11px; }
#login-box[data-login-theme="paper"] .brand-word b {
  font-size: 12px;
  letter-spacing: .24em;
  font-weight: 650;
}
#login-box[data-login-theme="paper"] .brand-word small {
  font-size: 8px;
  letter-spacing: .18em;
  color: #92a3a7;
}
#login-box[data-login-theme="paper"] .brand-main {
  margin-top: clamp(58px, 10vh, 108px);
  max-width: 650px;
}
#login-box[data-login-theme="paper"] .brand-kicker {
  display: flex;
  gap: 12px;
  color: #b7c5c9;
  font-size: 11px;
  letter-spacing: .14em;
  font-weight: 500;
}
#login-box[data-login-theme="paper"] .brand-kicker::before {
  width: 42px;
  background: var(--paper-rose);
}
#login-box[data-login-theme="paper"] .brand-main h1 {
  margin: 24px 0 26px;
  max-width: 650px;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "Noto Serif CJK SC", serif;
  font-size: clamp(54px, 6.2vw, 88px);
  font-weight: 400;
  line-height: .98;
  letter-spacing: -.045em;
}
#login-box[data-login-theme="paper"] .brand-main h1::first-line { color: #f4f0e6; }
#login-box[data-login-theme="paper"] .brand-main p {
  max-width: 380px;
  color: #b7c5c9;
  font-size: 14px;
  line-height: 1.8;
}
#login-box[data-login-theme="paper"] .brand-main ul { display: none; }
#login-box[data-login-theme="paper"] .brand-foot {
  border-top-color: rgba(244,240,230,.14);
  color: #92a3a7;
  font-size: 10px;
  letter-spacing: .08em;
}
#login-box[data-login-theme="paper"] .brand-foot span:last-child { display: none; }
#login-box[data-login-theme="paper"] .login-postmark {
  position: absolute;
  left: 64px;
  bottom: 132px;
  width: 108px;
  height: 108px;
  border: 1px solid rgba(244,240,230,.32);
  border-radius: 50%;
  transform: rotate(-11deg);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 2px;
  color: #92a3a7;
  z-index: 1;
  pointer-events: none;
}
#login-box[data-login-theme="paper"] .login-postmark::before {
  content: "";
  position: absolute;
  inset: 7px;
  border: 1px dashed rgba(244,240,230,.24);
  border-radius: 50%;
}
#login-box[data-login-theme="paper"] .login-postmark span {
  color: #f4f0e6;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif;
  font-size: 18px;
  letter-spacing: .02em;
}
#login-box[data-login-theme="paper"] .login-postmark small {
  font-size: 7px;
  line-height: 1.6;
  letter-spacing: .16em;
  text-align: center;
}
#login-box[data-login-theme="paper"] .login-letter-stack {
  position: absolute;
  right: 28px;
  bottom: 82px;
  width: 322px;
  height: 232px;
  z-index: 1;
  pointer-events: none;
}
#login-box[data-login-theme="paper"] .letter {
  position: absolute;
  inset: 0;
  padding: 22px 24px;
  border: 1px solid rgba(255,255,255,.4);
  background: #f4f0e6;
  color: #1b2b37;
  box-shadow: 0 24px 60px rgba(0,0,0,.18);
}
#login-box[data-login-theme="paper"] .letter.back {
  transform: rotate(7deg) translate(22px,18px);
  background: #b7c5c9;
  opacity: .35;
}
#login-box[data-login-theme="paper"] .letter.mid {
  transform: rotate(3deg) translate(10px,8px);
  background: #f4f0e6;
  opacity: .45;
}
#login-box[data-login-theme="paper"] .letter.front { transform: rotate(-2.5deg); }
#login-box[data-login-theme="paper"] .letter-head {
  display: flex;
  justify-content: space-between;
  padding-bottom: 13px;
  border-bottom: 1px solid #d5d0c4;
  color: #68716c;
  font-size: 8px;
  letter-spacing: .12em;
}
#login-box[data-login-theme="paper"] .letter-from {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
}
#login-box[data-login-theme="paper"] .letter-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #d7b7a2;
  color: #4d2e20;
  font-size: 9px;
  font-weight: 700;
}
#login-box[data-login-theme="paper"] .letter-from b { display: block; font-size: 11px; }
#login-box[data-login-theme="paper"] .letter-from small { display: block; margin-top: 2px; color: #68716c; font-size: 8px; }
#login-box[data-login-theme="paper"] .letter-from em { margin-left: auto; color: #68716c; font-size: 8px; font-style: normal; }
#login-box[data-login-theme="paper"] .letter-subject {
  margin: 16px 0 8px;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", serif;
  font-size: 21px;
  line-height: 1.18;
  letter-spacing: -.02em;
}
#login-box[data-login-theme="paper"] .letter-snippet { max-width: 270px; color: #68716c; font-size: 9px; line-height: 1.7; }
#login-box[data-login-theme="paper"] .form-wrapper {
  position: relative;
  right: auto;
  width: auto;
  min-height: 100dvh !important;
  padding: 52px clamp(40px, 5.2vw, 86px) 34px !important;
  display: flex;
  align-items: stretch;
  justify-content: center;
  background: #fbf9f4;
}
#login-box[data-login-theme="paper"] .form-wrapper .container {
  width: min(382px, 100%) !important;
  height: auto !important;
  min-height: calc(100dvh - 86px);
  max-height: none !important;
  overflow: visible !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
}
#login-box[data-login-theme="paper"] .login-centered-brand { display: none; }
#login-box[data-login-theme="paper"] .login-form-eyebrow {
  margin: 0 0 6px;
  color: var(--paper-ink);
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "Noto Serif CJK SC", serif;
  font-size: clamp(34px, 3vw, 43px);
  letter-spacing: -.03em;
  font-weight: 400;
  text-transform: none;
  line-height: 1.1;
}
#login-box[data-login-theme="paper"] .form-title { display: none; }
#login-box[data-login-theme="paper"] .form-desc {
  margin: 0 0 32px;
  color: var(--paper-muted);
  font-size: 13px;
  line-height: 1.7;
}
#login-box[data-login-theme="paper"] .container .el-input {
  height: 47px;
  margin-bottom: 18px;
}
#login-box[data-login-theme="paper"] .container :deep(.el-input__wrapper) {
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border-bottom: 1px solid var(--paper-line) !important;
}
#login-box[data-login-theme="paper"] .container :deep(.el-input__wrapper.is-focus) {
  background: transparent !important;
  box-shadow: 0 1px 0 var(--paper-accent) !important;
}
#login-box[data-login-theme="paper"] .container :deep(.el-input__inner) {
  height: 44px;
  font-size: 15px;
  background: transparent !important;
}
#login-box[data-login-theme="paper"] .container .email-input :deep(.el-input__wrapper) {
  border-radius: 0 !important;
  background: transparent !important;
  border-bottom: 1px solid var(--paper-line) !important;
}
#login-box[data-login-theme="paper"] .container .email-input :deep(.el-input-group__append) {
  background: transparent !important;
  background-color: transparent !important;
  border: 0 !important;
  border-bottom: 1px solid var(--paper-line) !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
#login-box[data-login-theme="paper"] .container .domain-picker {
  background: transparent !important;
  background-color: transparent !important;
}
#login-box[data-login-theme="paper"] .container .btn.el-button--primary {
  height: 50px;
  margin-top: 4px;
  border-radius: 3px;
  background: var(--paper-accent);
  border-color: var(--paper-accent);
  box-shadow: none;
  font-size: 14px;
  font-weight: 650;
}
#login-box[data-login-theme="paper"] .container .btn.el-button--primary:hover {
  background: #1f48bb;
  border-color: #1f48bb;
}
#login-box[data-login-theme="paper"] .login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 15px;
  color: var(--paper-muted);
  font-size: 10px;
  letter-spacing: .12em;
}
#login-box[data-login-theme="paper"] .login-divider::before,
#login-box[data-login-theme="paper"] .login-divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: var(--paper-line);
}
#login-box[data-login-theme="paper"] .switch {
  margin-top: 24px;
  color: var(--paper-muted);
  font-size: 12px;
}
#login-box[data-login-theme="paper"] .switch span { color: var(--paper-ink); font-weight: 650; }
#login-box[data-login-theme="paper"] .form-wrapper .container .switch { margin-top: 24px; }

/* 通用登录入口 */
.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 10px;
  color: #8a93a3;
  font-size: 10px;
  letter-spacing: .1em;
}
.login-divider::before,
.login-divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: #e3e8f0;
}
.social-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.social-row .el-button + .el-button { margin-left: 0; }
.provider-btn {
  width: 100%;
  height: 43px;
  margin: 0 !important;
  padding: 0 10px;
  border: 1px solid #dfe4ec;
  border-radius: 9px;
  background: transparent;
  color: #344054;
  font-size: 12px;
  font-weight: 550;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.provider-btn:hover {
  border-color: #b9c5d8;
  background: #f8fafc;
}
.provider-btn .el-avatar { flex: none; }
.sso-stack {
  display: grid;
  gap: 2px;
  margin-top: 6px;
}
.sso-btn {
  height: 38px;
  margin: 0 !important;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #7b8494;
  font-size: 11px;
  letter-spacing: .02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}
.sso-btn:hover { color: #2454d6; background: rgba(36,84,214,.04); }
.sso-btn .oidc-provider-icon { width: 16px; height: 16px; margin: 0; }

#login-box[data-login-theme="centered"] {
  display: block;
  min-height: 100dvh;
  background:
    radial-gradient(circle at 50% 0%, rgba(36,84,214,.07), transparent 34%),
    linear-gradient(180deg, #f4f6fb 0%, #eef2f8 100%);
  font-family: Inter, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
#login-box[data-login-theme="centered"] .login-brand-panel { display: none; }
#login-box[data-login-theme="centered"] .form-wrapper {
  position: relative;
  right: auto;
  width: 100% !important;
  min-height: 100dvh !important;
  padding: 36px 20px !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
}
#login-box[data-login-theme="centered"] .login-centered-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  color: #0b1b2b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .2em;
  text-transform: uppercase;
}
#login-box[data-login-theme="centered"] .centered-mark {
  width: 30px;
  height: 30px;
  border: 1px solid #cfd8e8;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #fff;
  color: #2454d6;
  font-size: 9px;
  letter-spacing: .04em;
}
#login-box[data-login-theme="centered"] .form-wrapper .container {
  width: min(420px, 100%) !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  padding: 34px 34px 28px !important;
  border: 1px solid #e2e7f0 !important;
  border-radius: 20px !important;
  background: v-bind(loginGlass) !important;
  /* 半透明底 + 背景模糊才是玻璃；只调透明度只会露出糊掉的背景图。 */
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  box-shadow: 0 24px 70px rgba(18,32,56,.1), 0 2px 8px rgba(18,32,56,.04) !important;
}
#login-box[data-login-theme="centered"] .form-title { font-size: 28px !important; letter-spacing: -.035em; }
#login-box[data-login-theme="centered"] .form-desc { margin-bottom: 22px; font-size: 12px; }
#login-box[data-login-theme="centered"] .container .el-input { height: 43px; margin-bottom: 13px; }
#login-box[data-login-theme="centered"] .container :deep(.el-input__wrapper) {
  border-radius: 9px;
  background: #f7f9fc;
  box-shadow: inset 0 0 0 1px #e6eaf1;
}
#login-box[data-login-theme="centered"] .container :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #2454d6, 0 0 0 3px rgba(36,84,214,.08);
}
#login-box[data-login-theme="centered"] .container .btn.el-button--primary {
  height: 45px;
  border-radius: 9px;
  background: #2454d6;
  border-color: #2454d6;
}
#login-box[data-login-theme="centered"] .container .btn + .btn { margin-top: 8px; }
#login-box[data-login-theme="centered"] .login-divider { margin-top: 20px; }
#login-box[data-login-theme="centered"] .switch { margin-top: 20px; }

@media (max-width: 900px) {
  #login-box[data-login-theme="paper"] {
    display: block;
    min-height: 100dvh;
    background: #fbf9f4;
  }
  #login-box[data-login-theme="paper"] .login-brand-panel {
    display: flex !important;
    min-height: 258px;
    padding: 28px 26px 24px;
  }
  #login-box[data-login-theme="paper"] .brand-main { margin-top: 38px; }
  #login-box[data-login-theme="paper"] .brand-main h1 { margin: 18px 0 0; font-size: clamp(42px, 11vw, 62px); }
  #login-box[data-login-theme="paper"] .brand-main p,
  #login-box[data-login-theme="paper"] .brand-main ul,
  #login-box[data-login-theme="paper"] .brand-foot,
  #login-box[data-login-theme="paper"] .login-postmark,
  #login-box[data-login-theme="paper"] .login-letter-stack { display: none; }
  #login-box[data-login-theme="paper"] .form-wrapper {
    min-height: calc(100dvh - 258px) !important;
    padding: 26px 22px 24px !important;
    display: block;
    background: #fbf9f4;
  }
  #login-box[data-login-theme="paper"] .form-wrapper .container { min-height: 0 !important; width: 100% !important; max-width: 382px; margin: 0 !important; justify-content: flex-start !important; }
  #login-box[data-login-theme="paper"] .form-desc { margin-bottom: 24px; }
  #login-box[data-login-theme="centered"] .form-wrapper { padding: 24px 16px !important; justify-content: center; }
  #login-box[data-login-theme="centered"] .container { padding: 28px 22px 24px !important; border-radius: 16px !important; }
}

/* ---------- Fresh：清晨薄荷 ---------- */
.login-fresh-art, .login-gala-rail { display: none; }
#login-box[data-login-theme="fresh"] {
  grid-template-columns: minmax(0, 46%) minmax(0, 54%);
  background: #f2faf6 !important;
  color: #123c31;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
#login-box[data-login-theme="fresh"] .login-bg { display: none !important; }
#login-box[data-login-theme="fresh"] .login-postmark,
#login-box[data-login-theme="fresh"] .login-letter-stack { display: none; }
#login-box[data-login-theme="fresh"] .login-brand-panel {
  padding: 52px clamp(36px, 5vw, 72px) 40px;
  background: #e5f6ee;
  color: #123c31;
}
#login-box[data-login-theme="fresh"] .login-brand-panel::after { display: none; }
#login-box[data-login-theme="fresh"] .brand-mark {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #0d6b55;
  color: #effff8;
  font-size: 15px;
  letter-spacing: -.05em;
}
#login-box[data-login-theme="fresh"] .brand-word b { font-size: 14px; letter-spacing: .01em; color: #123c31; }
#login-box[data-login-theme="fresh"] .brand-word small { color: #6c9486; font-size: 8px; letter-spacing: .12em; }
#login-box[data-login-theme="fresh"] .brand-main { margin-top: clamp(50px, 9vh, 94px); max-width: 470px; }
#login-box[data-login-theme="fresh"] .brand-kicker {
  color: #4a8c79;
  font-size: 10px;
  letter-spacing: .12em;
  font-weight: 650;
}
#login-box[data-login-theme="fresh"] .brand-kicker::before { width: 26px; background: #6fcbb1; }
#login-box[data-login-theme="fresh"] .brand-main h1 {
  margin: 22px 0 18px;
  max-width: 420px;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", sans-serif;
  font-size: clamp(38px, 3.8vw, 52px);
  font-weight: 550;
  line-height: 1.18;
  letter-spacing: -.045em;
  color: #103a30;
}
#login-box[data-login-theme="fresh"] .brand-main p {
  max-width: 350px;
  color: #54776c;
  font-size: 13px;
  line-height: 1.8;
}
#login-box[data-login-theme="fresh"] .brand-main ul { display: none; }
#login-box[data-login-theme="fresh"] .brand-foot {
  border-top-color: #c7e5d9;
  color: #6c9486;
  font-size: 9px;
  letter-spacing: .05em;
}
#login-box[data-login-theme="fresh"] .brand-foot span:last-child { display: none; }
#login-box[data-login-theme="fresh"] .login-fresh-art {
  display: block;
  position: absolute;
  right: 26px;
  bottom: 52px;
  width: 270px;
  height: 205px;
  color: #76b9a3;
  opacity: .78;
  z-index: 1;
  pointer-events: none;
}
#login-box[data-login-theme="fresh"] .login-fresh-art svg { width: 100%; height: 100%; }
#login-box[data-login-theme="fresh"] .form-wrapper {
  position: relative;
  right: auto;
  width: auto;
  min-height: 100dvh !important;
  padding: 48px clamp(32px, 5vw, 76px) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fbfdfb;
}
#login-box[data-login-theme="fresh"] .form-wrapper .container {
  width: min(392px, 100%) !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
}
#login-box[data-login-theme="fresh"] .login-form-eyebrow {
  margin: 0 0 10px;
  color: #2c9278;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}
#login-box[data-login-theme="fresh"] .form-title {
  display: block;
  font-size: 33px !important;
  font-weight: 650;
  letter-spacing: -.04em;
  color: #123c31;
}
#login-box[data-login-theme="fresh"] .form-desc {
  margin: 8px 0 28px;
  color: #6b8e82;
  font-size: 12px;
  line-height: 1.65;
}
#login-box[data-login-theme="fresh"] .container .el-input {
  height: 48px;
  margin-bottom: 14px;
}
#login-box[data-login-theme="fresh"] .container :deep(.el-input__wrapper) {
  height: 48px;
  padding: 0 15px !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  box-shadow: inset 0 0 0 1px #d9ece4 !important;
}
#login-box[data-login-theme="fresh"] .container :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #2b9b7f, 0 0 0 3px rgba(43,155,127,.1) !important;
}
#login-box[data-login-theme="fresh"] .container :deep(.el-input__inner) { height: 46px; font-size: 14px; }
#login-box[data-login-theme="fresh"] .container .email-input :deep(.el-input__wrapper) { border-radius: 12px 0 0 12px !important; }
#login-box[data-login-theme="fresh"] .container :deep(.el-input-group__append) {
  background: #edf9f4 !important;
  border: 0 !important;
  border-radius: 0 12px 12px 0 !important;
  box-shadow: inset 0 0 0 1px #d9ece4 !important;
}
#login-box[data-login-theme="fresh"] .container .btn.el-button--primary {
  height: 49px;
  margin-top: 4px;
  border: 0;
  border-radius: 12px;
  background: #0d6b55 !important;
  border-color: #0d6b55 !important;
  color: #fff !important;
  box-shadow: 0 10px 22px rgba(13,107,85,.16);
  font-size: 14px;
  font-weight: 650;
}
#login-box[data-login-theme="fresh"] .container .btn.el-button--primary:hover {
  background: #0a5b49 !important;
  border-color: #0a5b49 !important;
}
#login-box[data-login-theme="fresh"] .login-divider { margin: 21px 0 12px; color: #82a498; }
#login-box[data-login-theme="fresh"] .login-divider::before,
#login-box[data-login-theme="fresh"] .login-divider::after { background: #dcebe5; }
#login-box[data-login-theme="fresh"] .provider-btn {
  height: 43px;
  border-color: #d9ece4;
  border-radius: 11px;
  background: #fff;
  color: #285248;
}
#login-box[data-login-theme="fresh"] .provider-btn:hover { border-color: #a9d8c7; background: #f6fdf9; }
#login-box[data-login-theme="fresh"] .sso-btn { color: #719287; }
#login-box[data-login-theme="fresh"] .sso-btn:hover { color: #0d6b55; background: rgba(13,107,85,.05); }
#login-box[data-login-theme="fresh"] .switch { margin-top: 22px; color: #719287; font-size: 12px; }
#login-box[data-login-theme="fresh"] .switch span { color: #0d6b55; font-weight: 650; }

/* ---------- Gala：午夜歌剧 ---------- */
#login-box[data-login-theme="gala"] {
  grid-template-columns: minmax(0, 1.55fr) minmax(430px, .9fr);
  background: #170f10 !important;
  color: #f3e8d8;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
#login-box[data-login-theme="gala"] .login-bg { display: none !important; }
#login-box[data-login-theme="gala"] .login-brand-panel {
  padding: 58px clamp(40px, 6vw, 82px) 42px;
  background:
    radial-gradient(circle at 14% 12%, rgba(141,63,68,.34), transparent 30%),
    repeating-linear-gradient(90deg, rgba(200,163,90,.055) 0 1px, transparent 1px 104px),
    #170f10;
  color: #f3e8d8;
  overflow: hidden;
}
#login-box[data-login-theme="gala"] .login-brand-panel::after {
  content: "M";
  position: absolute;
  right: -2vw;
  bottom: -24vh;
  color: rgba(200,163,90,.055);
  font-family: "Bodoni MT", Didot, "Times New Roman", serif;
  font-size: 48vw;
  line-height: 1;
  pointer-events: none;
}
#login-box[data-login-theme="gala"] .brand-mark {
  width: 34px;
  height: 34px;
  border: 1px solid #c8a35a;
  border-radius: 0;
  background: transparent;
  color: #c8a35a;
  font-family: "Bodoni MT", Didot, serif;
  font-size: 15px;
  letter-spacing: 0;
}
#login-box[data-login-theme="gala"] .brand-word b {
  color: #f3e8d8;
  font-family: "Bodoni MT", Didot, "Times New Roman", serif;
  font-size: 17px;
  font-weight: 400;
  letter-spacing: .12em;
}
#login-box[data-login-theme="gala"] .brand-word small { color: #947b63; font-size: 8px; letter-spacing: .2em; }
#login-box[data-login-theme="gala"] .brand-main { margin-top: clamp(70px, 15vh, 150px); max-width: 730px; }
#login-box[data-login-theme="gala"] .brand-kicker {
  color: #c8a35a;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .2em;
}
#login-box[data-login-theme="gala"] .brand-kicker::before { width: 34px; background: #8d3f44; }
#login-box[data-login-theme="gala"] .brand-main h1 {
  margin: 28px 0 24px;
  max-width: 730px;
  font-family: "Bodoni MT", Didot, "Times New Roman", "Songti SC", serif;
  font-size: clamp(64px, 7.4vw, 108px);
  font-weight: 400;
  line-height: .93;
  letter-spacing: -.055em;
  color: #f3e8d8;
}
#login-box[data-login-theme="gala"] .brand-main p {
  max-width: 430px;
  color: #b9a692;
  font-size: 13px;
  line-height: 1.85;
}
#login-box[data-login-theme="gala"] .brand-main ul { display: none; }
#login-box[data-login-theme="gala"] .brand-foot {
  border-top: 1px solid rgba(200,163,90,.26);
  color: #947b63;
  font-size: 9px;
  letter-spacing: .12em;
}
#login-box[data-login-theme="gala"] .brand-foot span:last-child { color: #c8a35a; }
#login-box[data-login-theme="gala"] .login-gala-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  top: 68px;
  right: 32px;
  writing-mode: vertical-rl;
  color: #c8a35a;
  font-family: "Bodoni MT", Didot, serif;
  font-size: 9px;
  letter-spacing: .24em;
  z-index: 2;
  pointer-events: none;
}
#login-box[data-login-theme="gala"] .login-gala-rail span:first-child { color: #806d59; }
#login-box[data-login-theme="gala"] .login-postmark,
#login-box[data-login-theme="gala"] .login-letter-stack,
#login-box[data-login-theme="gala"] .login-fresh-art { display: none; }
#login-box[data-login-theme="gala"] .form-wrapper {
  position: relative;
  right: auto;
  width: auto;
  min-height: 100dvh !important;
  padding: 58px clamp(38px, 5vw, 78px) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4ede3 !important;
}
#login-box[data-login-theme="gala"] .form-wrapper .container {
  width: min(430px, 100%) !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  padding: 0 0 0 38px !important;
  border: 0 !important;
  border-left: 1px solid #d7c2a5 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
}
#login-box[data-login-theme="gala"] .login-form-eyebrow {
  margin: 0 0 12px;
  color: #8d3f44;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}
#login-box[data-login-theme="gala"] .form-title {
  display: block;
  font-family: "Bodoni MT", Didot, "Times New Roman", "Songti SC", serif;
  font-size: clamp(40px, 3.8vw, 55px) !important;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -.045em;
  color: #261512 !important;
}
#login-box[data-login-theme="gala"] .form-desc {
  margin: 12px 0 30px;
  color: #7e6a59;
  font-size: 12px;
  line-height: 1.7;
}
#login-box[data-login-theme="gala"] .container .el-input {
  height: 49px;
  margin-bottom: 18px;
}
#login-box[data-login-theme="gala"] .container :deep(.el-input__wrapper) {
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border-bottom: 1px solid #c5ab88 !important;
}
#login-box[data-login-theme="gala"] .container :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 1px 0 #8d3f44 !important;
}
#login-box[data-login-theme="gala"] .container :deep(.el-input__inner) {
  height: 46px;
  font-size: 15px;
  color: #261512;
  background: transparent !important;
}
#login-box[data-login-theme="gala"] .container .email-input :deep(.el-input__wrapper) {
  border-radius: 0 !important;
  background: transparent !important;
  border-bottom: 1px solid #c5ab88 !important;
}
#login-box[data-login-theme="gala"] .container :deep(.el-input-group__append) {
  background: transparent !important;
  border: 0 !important;
  border-bottom: 1px solid #c5ab88 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
#login-box[data-login-theme="gala"] .container .btn.el-button--primary {
  height: 52px;
  margin-top: 4px;
  border: 0;
  border-radius: 0;
  background: #c8a35a !important;
  border-color: #c8a35a !important;
  color: #201310 !important;
  box-shadow: none;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: .04em;
}
#login-box[data-login-theme="gala"] .container .btn.el-button--primary:hover {
  background: #b58f46 !important;
  border-color: #b58f46 !important;
}
#login-box[data-login-theme="gala"] .login-divider { margin: 23px 0 12px; color: #9b8876; }
#login-box[data-login-theme="gala"] .login-divider::before,
#login-box[data-login-theme="gala"] .login-divider::after { background: #d7c2a5; }
#login-box[data-login-theme="gala"] .provider-btn {
  height: 43px;
  border: 1px solid #d2bda1;
  border-radius: 0;
  background: transparent;
  color: #38221d;
}
#login-box[data-login-theme="gala"] .provider-btn:hover { border-color: #8d3f44; background: rgba(141,63,68,.04); }
#login-box[data-login-theme="gala"] .sso-btn { color: #886f5a; }
#login-box[data-login-theme="gala"] .sso-btn:hover { color: #8d3f44; background: rgba(141,63,68,.04); }
#login-box[data-login-theme="gala"] .switch { margin-top: 22px; color: #7e6a59; font-size: 12px; }
#login-box[data-login-theme="gala"] .switch span { color: #8d3f44; font-weight: 650; }

@media (max-width: 900px) {
  #login-box[data-login-theme="fresh"] { display: block; background: #eef9f4 !important; }
  #login-box[data-login-theme="fresh"] .login-brand-panel { display: none; }
  #login-box[data-login-theme="fresh"] .form-wrapper {
    min-height: 100dvh !important;
    padding: 22px 18px !important;
    background: #eef9f4;
  }
  #login-box[data-login-theme="fresh"] .form-wrapper .container {
    padding: 28px 22px !important;
    border-radius: 20px !important;
    background: #fbfdfb !important;
    box-shadow: 0 22px 55px rgba(28,87,70,.09) !important;
  }
  #login-box[data-login-theme="gala"] { display: block; background: #170f10 !important; }
  #login-box[data-login-theme="gala"] .login-brand-panel { display: none; }
  #login-box[data-login-theme="gala"] .form-wrapper {
    min-height: 100dvh !important;
    padding: 22px 18px !important;
    background: #f4ede3;
  }
  #login-box[data-login-theme="gala"] .form-wrapper .container {
    padding: 30px 22px !important;
    border: 1px solid #d7c2a5 !important;
    border-radius: 0 !important;
    background: rgba(250,246,239,.82) !important;
  }
  #login-box[data-login-theme="gala"] .form-title { font-size: 40px !important; }
}

/* 账号输入：域名选择放在输入行内右侧。方框只给 centered/fresh，paper/gala 保持横线输入。 */
#login-box[data-login-theme] .container .email-input {
  position: relative;
  z-index: 10;
}
#login-box[data-login-theme="centered"] .container .email-input :deep(.el-input__wrapper),
#login-box[data-login-theme="fresh"] .container .email-input :deep(.el-input__wrapper) {
  background: #fff !important;
  border: 0 !important;
  border-radius: 10px !important;
  box-shadow: inset 0 0 0 1px var(--rd-line) !important;
  overflow: visible !important;
}
#login-box[data-login-theme="paper"] .container .email-input :deep(.el-input__wrapper),
#login-box[data-login-theme="gala"] .container .email-input :deep(.el-input__wrapper) {
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}
#login-box[data-login-theme="paper"] .container .email-input :deep(.el-input__wrapper) {
  border-bottom: 1px solid var(--paper-line) !important;
}
#login-box[data-login-theme="gala"] .container .email-input :deep(.el-input__wrapper) {
  border-bottom: 1px solid #c5ab88 !important;
}
#login-box[data-login-theme] .container .email-input :deep(.el-input__inner) {
  padding-right: 116px !important;
}
#login-box[data-login-theme] .container .email-input :deep(.el-input__suffix) {
  padding-right: 8px;
  pointer-events: auto;
}
#login-box[data-login-theme] .container .email-input :deep(.domain-picker) {
  height: auto !important;
  min-width: 104px;
  max-width: 108px;
  padding: 0 2px !important;
  background: transparent !important;
  border-radius: 0 !important;
  color: var(--rd-text) !important;
  font-size: 11px !important;
}
#login-box[data-login-theme] .container .email-input :deep(.domain-picker:hover) {
  background: transparent !important;
  color: var(--rd-accent) !important;
}
#login-box[data-login-theme] .container .domain-picker-label {
  flex: 1;
  min-width: 0;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#login-box[data-login-theme] .container .email-input :deep(.domain-picker-arrow) {
  flex: 0 0 14px;
  color: var(--rd-muted) !important;
  opacity: 1 !important;
}
@media (max-width: 767px) {
  #login-box[data-login-theme] .container .email-input :deep(.el-input__inner) {
    padding-right: 102px !important;
  }
  #login-box[data-login-theme] .container .domain-picker {
    min-width: 94px;
    max-width: 94px;
  }
  #login-box[data-login-theme] .container .domain-picker-label {
    max-width: 72px;
    font-size: 10px !important;
  }
  #login-box[data-login-theme] .container .email-input :deep(.domain-picker-arrow) {
    flex: 0 0 12px;
  }
}
#login-box[data-login-theme] .container .domain-picker-dropdown {
  width: max-content;
  min-width: 150px;
  max-width: min(420px, calc(100vw - 48px));
}
#login-box[data-login-theme] .container .domain-picker-option {
  white-space: nowrap;
}
</style>

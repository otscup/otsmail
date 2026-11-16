<template>
  <div class="settings-container">
    <settingsTabs/>
    <div class="loading" :class="firstLoading ? 'loading-show' : 'loading-hide'">
      <loading/>
    </div>
    <el-scrollbar class="scroll" v-if="!firstLoading">
      <div class="scroll-body">
        <div class="card-grid">
          <!-- Website Settings Card -->
          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('websiteSetting') }}</div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>登录标题</span></div>
                <div><el-input v-model="setting.title" style="width:140px" @change="editSetting({title: setting.title})"/></div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('websiteReg') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.register"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('loginDomain') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="1" :inactive-value="0"
                             v-model="setting.loginDomain"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>找回密码功能</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="1" :inactive-value="0"
                             v-model="setting.passwordResetSwitch"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>系统发信邮箱</span></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <el-input size="small" style="width: 180px;" v-model="setting.systemSenderEmail" placeholder="例如 noreply@otscup.com" @change="change"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('regKey') }}</span></div>
                <div>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ?  100 : 80 }px;`"
                      v-model="setting.regKey"
                      placeholder="Select"
                  >
                    <el-option
                        v-for="item in regKeyOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('addAccount') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.addEmail"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('multipleEmail') }}</span>
                  <el-tooltip effect="dark" :content="$t('multipleEmailDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.manyEmail"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('syncDelete') }}</span>
                  <el-tooltip effect="dark" :content="$t('syncDeleteDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.syncDelete"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('emailPrefix') }}</span>
                </div>
                <div class="forward">
                  <el-button class="opt-button" size="small" type="primary" @click="openEmailPrefix">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Personalization Settings Card -->
          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('customization') }}</div>
            <div class="card-content">
              <div class="setting-item">
                <div class="title-item"><span>{{ $t('loginBoxOpacity') }}</span></div>
                <div>
                  <el-input-number size="small" v-model="loginOpacity" @change="opacityChange" :precision="2"
                                   :step="0.01" :max="1" :min="0"/>
                </div>
              </div>
              <div class="setting-item">
                <div class="title-item"><span>{{ $t('showSenderAvatar') }}</span></div>
                <div>
                  <el-switch v-model="setting.showAvatar" :active-value="1" :inactive-value="0" @change="saveShowAvatar"/>
                </div>
              </div>
              <div class="setting-item personalized">
                <div><span>{{ $t('loginBackground') }}</span></div>
                <div>
                  <el-image
                      class="background"
                      :src="cvtR2Url(setting.background)"
                      :preview-src-list="[cvtR2Url(setting.background)]"
                      show-progress
                      fit="cover"
                  >
                    <template #error>
                      <div class="error-image">
                        <Icon icon="ph:image" width="24" height="24"/>
                      </div>
                    </template>
                  </el-image>
                  <div class="background-btn">
                    <el-button class="opt-button" size="small" type="primary" @click="openSetBackground('background')">
                      <Icon icon="lsicon:edit-outline" width="16" height="16"/>
                    </el-button>
                    <el-button class="opt-button" size="small" type="primary" @click="delBackground('background')">
                      <Icon icon="material-symbols:delete-outline-rounded" width="16" height="16"/>
                    </el-button>
                  </div>
                </div>
              </div>
              <div class="setting-item login-theme-item">
                <div>
                  <span>{{ $t('loginTheme') }}</span>
                </div>
                <div>
                  <el-select :model-value="setting.loginTheme || 'paper'" style="width:190px"
                             @change="value => changeField('loginTheme', value)">
                    <el-option :label="$t('loginThemePaper')" value="paper"/>
                    <el-option :label="$t('loginThemeCentered')" value="centered"/>
                    <el-option :label="$t('loginThemeFresh')" value="fresh"/>
                    <el-option :label="$t('loginThemeGala')" value="gala"/>
                  </el-select>
                </div>
              </div>
            </div>
          </div>

          <!-- Email Sending Settings Card -->
          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('emailSetting') }}</div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('receiveEmail') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.receive"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('autoRefresh') }}</span>
                  <el-tooltip effect="dark" :content="$t('autoRefreshDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ? 100 : 80 }px;`"
                      v-model="setting.autoRefresh"
                      placeholder="Select"
                  >
                    <el-option
                        v-for="item in authRefreshOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('countRefreshMinutes') }}</span></div>
                <div>
                  <el-input-number v-model="setting.countRefreshMinutes" :min="1" :max="60" size="small"
                                   @change="changeField('countRefreshMinutes', $event)"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('sendEmail') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.send"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('noRecipientTitle') }}</span>
                  <el-tooltip effect="dark" :content="$t('noRecipientDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.noRecipient"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('senderProviders') }}</span>
                  <el-tooltip effect="dark" :content="$t('senderProvidersDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-button class="opt-button" style="margin-top: 0" @click="openSenderProviders" size="small"
                             type="primary">
                    <Icon icon="fluent:settings-48-regular" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('blackList') }}</span></div>
                <div>
                  <el-button class="opt-button" style="margin-top: 0" @click="openBlackListForm" size="small"
                             type="primary">
                    <Icon icon="fluent:settings-48-regular" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>邮件过滤器</span></div>
                <div>
                  <el-button class="opt-button" style="margin-top: 0" @click="openFilterForm" size="small"
                             type="primary">
                    <Icon icon="mdi:filter-outline" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Object Storage Card -->
          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('oss') }}</div>
            <div class="card-content">
              <div class="r2domain-item">
                <div>
                  <span>{{ $t('osDomain') }}</span>
                  <el-tooltip effect="dark" :content="$t('ossDomainDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div class="r2domain">
                  <span>{{ setting.r2Domain || '' }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="r2DomainShow = true">
                    <Icon icon="lsicon:edit-outline" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('s3Configuration') }}</span>
                </div>
                <div class="r2domain">
                  <el-button class="opt-button" size="small" type="primary" @click="addS3Show = true">
                    <Icon icon="fluent:settings-48-regular" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('storageType') }}</span>
                </div>
                <div class="r2domain">
                  <div class="storage-type">
                    <el-tag>{{ setting.storageType }}</el-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('emailPush') }}</div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('tgBot') }}</span></div>
                <div class="forward">
                  <span>{{ setting.tgBotStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openTgSetting">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('otherEmail') }}</span></div>
                <div class="forward">
                  <span>{{ setting.forwardStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openThirdEmailSetting">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('forwardingRules') }}</span></div>
                <div class="forward">
                  <span>{{ setting.ruleType === 0 ? $t('forwardAll') : $t('rules') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openForwardRules">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>Webhook 通知</span></div>
                <div class="forward">
                  <span>{{ setting.webhookStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openWebhook">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>自动清理</span></div>
                <div class="forward">
                  <span>{{ setting.autoCleanDays > 0 ? ('保留 ' + setting.autoCleanDays + ' 天') : $t('disabled') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openAutoClean">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>企业登录（OIDC）</span></div>
                <div class="forward">
                  <span>{{ enabledOidcCount > 0 ? (enabledOidcCount + ' 个服务商') : $t('disabled') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openOidc">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Turnstile Verification Card -->
          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('turnstileSetting') }}</div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('signUpVerification') }}</span></div>
                <div>
                  <el-button class="opt-button" size="small" type="primary" @click="openRegVerifyCount">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ? 100 : 80 }px;`"
                      v-model="setting.registerVerify"
                      placeholder="Select"
                      class="bot-verify-select"
                  >
                    <el-option key="1" :value="0" :label="$t('enable')"/>
                    <el-option key="1" :value="1" :label="$t('disable')"/>
                    <el-option key="1" :value="2" :label="$t('rulesVerify')"/>
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('addEmailVerification') }}</span></div>
                <div>
                  <el-button class="opt-button" size="small" type="primary" @click="openAddVerifyCount">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ? 100 : 80 }px;`"
                      v-model="setting.addEmailVerify"
                      placeholder="Select"
                      class="bot-verify-select"
                  >
                    <el-option key="1" :value="0" :label="$t('enable')"/>
                    <el-option key="1" :value="1" :label="$t('disable')"/>
                    <el-option key="1" :value="2" :label="$t('rulesVerify')"/>
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>Site Key</span></div>
                <div class="bot-verify">
                  <span>{{ setting.siteKey }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="turnstileShow = true">
                    <Icon icon="lsicon:edit-outline" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>Secret Key</span></div>
                <div class="bot-verify">
                  <span> {{ setting.secretKey }} </span>
                  <el-button class="opt-button" size="small" type="primary" @click="turnstileShow = true">
                    <Icon icon="lsicon:edit-outline" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <div class="card-title" @click="toggleCard">{{ $t('noticeTitle') }}</div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('noticePopup') }}</span></div>
                <div class="forward">
                  <span>{{ setting.notice === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openNoticePopupSetting">
                    <Icon icon="fluent:settings-48-regular" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('popUp') }}</span></div>
                <div class="forward">
                  <el-button class="opt-button" size="small" type="primary" @click="openNoticePopup">
                    <Icon icon="mynaui:click-solid" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <div class="card-title" @click="toggleCard">翻译（DeepL）</div>
            <div class="card-content">
              <div class="setting-item">
                <div>
                  <span>DeepL API Key</span>
                  <el-tooltip effect="dark" content="填入后邮件翻译优先走 DeepL；留空则回退 Workers AI">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div class="bot-verify">
                  <span>{{ setting.deeplKey || '未配置' }}</span>
                  <el-button class="opt-button" size="small" type="primary" @click="openDeepL">
                    <Icon icon="lsicon:edit-outline" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-card ai-settings-card">
            <div class="card-title" @click="toggleCard">AI 接口（OpenAI 兼容）</div>
            <div class="card-content">
              <div class="setting-item">
                <div>
                  <span>接口地址</span>
                  <el-tooltip effect="dark" content="填到 /v1 为止，例如 https://api.openai.com/v1；留空则回退 Workers AI">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <el-input v-model="setting.aiBaseUrl" placeholder="https://api.openai.com/v1"
                          style="width: 320px" @change="onAiFieldChange('aiBaseUrl', $event)"/>
              </div>
              <div class="setting-item">
                <div><span>API Key</span></div>
                <el-input v-model="setting.aiApiKey" type="password" show-password placeholder="sk-..."
                          style="width: 320px" @change="onAiFieldChange('aiApiKey', $event)"/>
              </div>
              <div class="setting-item">
                <div><span>模型</span></div>
                <div class="ai-model-inline-row" style="display: flex; align-items: center; gap: 8px; width: 100%;">
                  <el-select v-model="setting.aiModel" filterable allow-create clearable placeholder="先拉取模型"
                             style="flex: 1;" @change="changeField('aiModel', $event)">
                    <el-option v-for="item in aiModelList" :key="item" :label="item" :value="item"/>
                  </el-select>
                  <el-button :loading="aiModelsLoading" @click="fetchAiModels" style="flex: none; min-width: 88px;">
                    {{ aiModelsLoading ? '拉取中…' : '拉取模型' }}
                  </el-button>
                </div>
              </div>
              <div class="ai-setting-tip">保存后立即生效；已配置接口时优先走该接口，留空回退 Workers AI。</div>

              <!-- AI 收件分类与 AI 摘要在一排并列展示 -->
              <div class="ai-double-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="setting-item" style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span>AI 收件分类</span>
                    <el-tooltip effect="dark" content="关闭时只按本地规则分类；自动模式收信时调用模型；手动模式只在你点按钮时分类最近 20 封。">
                      <Icon class="warning" icon="fe:warning" width="16" height="16"/>
                    </el-tooltip>
                  </div>
                  <div class="ai-classify-row" style="width: 100%; display: flex; gap: 6px;">
                    <el-select v-model="setting.aiClassifyMode" style="flex: 1;"
                               @change="changeField('aiClassifyMode', $event)">
                      <el-option label="关闭（本地规则）" value="off"/>
                      <el-option label="自动 AI 分类" value="auto"/>
                      <el-option label="手动 AI 分类" value="manual"/>
                    </el-select>
                    <el-button v-if="setting.aiClassifyMode === 'manual'" :loading="aiClassifyLoading"
                               @click="classifyNow" size="small" style="padding: 0 8px;">分类</el-button>
                  </div>
                </div>

                <div class="setting-item" style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span>AI 摘要</span>
                    <el-tooltip effect="dark" content="手动：点开邮件后按 AI Brief 生成；自动：打开邮件时自动生成。">
                      <Icon class="warning" icon="fe:warning" width="16" height="16"/>
                    </el-tooltip>
                  </div>
                  <div style="width: 100%;">
                    <el-select v-model="setting.aiSummaryMode" style="width: 100%;"
                               @change="changeField('aiSummaryMode', $event)">
                      <el-option label="手动生成摘要" value="manual"/>
                      <el-option label="自动生成摘要" value="auto"/>
                    </el-select>
                  </div>
                </div>
              </div>

              <!-- 验证码识别、规则与 Telegram 每日摘要整合在一排 -->
              <div class="ai-controls-bar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px; background: var(--fill-quaternary, rgba(0,0,0,0.03)); border-radius: 8px; margin-top: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 13px;">{{ $t('codeRecognition') }}</span>
                  <el-switch @change="changeField('aiCode', $event)" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.aiCode"/>
                  <el-button class="opt-button" size="small" type="primary" @click="openAiCodeFilter" title="设置识别规则" style="margin-left: 4px;">
                    <Icon icon="fluent:settings-48-regular" width="16" height="16"/>
                  </el-button>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 13px;">{{ $t('telegramDigest') }}</span>
                  <el-tooltip effect="dark" :content="$t('telegramDigestDesc')">
                    <Icon class="warning" icon="fe:warning" width="16" height="16"/>
                  </el-tooltip>
                  <el-switch v-model="setting.tgDigest" :active-value="1" :inactive-value="0"
                             @change="changeField('tgDigest', $event)"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-card version-card">
        <div class="title">{{ $t('aboutVersion') }}</div>
        <div class="card-content">
          <div class="setting-item">
            <div><span>{{ $t('currentVersion') }}</span></div>
            <div class="version-line">
              <strong>{{ currentVersionInfo.version || '-' }}</strong>
              <span v-if="currentVersionInfo.deployedAt">{{ $t('deployedAt') }} {{ formatVersionTime(currentVersionInfo.deployedAt) }}</span>
              <el-button size="small" :loading="updateChecking" @click="checkForUpdate">{{ $t('checkUpdate') }}</el-button>
            </div>
          </div>
          <div v-if="updateInfo" class="version-result">
            <span v-if="updateInfo.status === 'channelMissing'" class="version-muted">{{ $t('updateChannelMissing') }}</span>
            <span v-else-if="updateInfo.status === 'upstreamError'" class="version-error">{{ $t('updateUpstreamError') }}</span>
            <span v-else-if="updateInfo.status === 'unknownCurrent'" class="version-muted">{{ $t('updateUnknownCurrent') }}</span>
            <span v-else-if="updateInfo.hasUpdate">
              {{ $t('updateAvailable') }} <b>{{ updateInfo.latest }}</b>
              <a v-if="updateInfo.url" :href="updateInfo.url" target="_blank" rel="noopener">{{ $t('viewRelease') }}</a>
            </span>
            <span v-else class="version-ok">{{ $t('upToDate') }}</span>
            <pre v-if="updateInfo.hasUpdate && updateInfo.notes" class="version-notes">{{ updateInfo.notes }}</pre>
          </div>
        </div>
      </div>

      <!-- Dialogs remain the same -->
      <el-dialog v-model="r2DomainShow" :title="$t('addOsDomain')" width="340"
                 @closed="r2DomainInput = setting.r2Domain">
        <form @submit.prevent>
          <el-input type="text" :placeholder="$t('domainDesc')" v-model="r2DomainInput" @keyup.enter="saveR2domain"/>
          <el-button type="primary" :loading="settingLoading" @click="saveR2domain">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="turnstileShow" :title="$t('addTurnstileSecret')" width="340"
                 @closed="turnstileForm.secretKey = '';turnstileForm.siteKey = ''">
        <form @submit.prevent>
          <el-input type="text" placeholder="Site Key" v-model="turnstileForm.siteKey" @keyup.enter="saveTurnstileKey"/>
          <el-input type="text" style="margin-top: 15px" placeholder="Secret Key" v-model="turnstileForm.secretKey" @keyup.enter="saveTurnstileKey"/>
          <el-button type="primary" :loading="settingLoading" @click="saveTurnstileKey">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog
          v-model="showSetBackground"
          class="cut-dialog"
          @closed="closedSetBackground"
      >
        <template #header>
          <span style="font-size: 18px">
            {{ backgroundTarget === 'chatBackground' ? $t('chatBackground') : $t('loginBackground') }}
            <el-tooltip>
              <template #content>
                <span>{{ $t('backgroundWarning') }}</span>
              </template>
              <Icon class="title-icon  warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </span>
        </template>
        <el-input :placeholder="$t('backgroundUrlDesc')" v-model="backgroundUrl" v-if="!localUpShow"
                  class="background-url" @keyup.enter="saveBackground"/>
        <el-image
            v-if="localUpShow"
            :preview-src-list="[backgroundImage]"
            show-progress
            class="cropper"
            fit="cover"
            :src="backgroundImage"
        ></el-image>
        <div class="cut-button">
          <el-button type="primary" link @click="openCut" v-if="!localUpShow">
            {{ $t('localUpload') }}
          </el-button>
          <el-button type="primary" link @click="localUpShow = false" v-if="localUpShow">
            {{ $t('imageLink') }}
          </el-button>
          <el-button type="primary" :loading="settingLoading" @click="saveBackground">{{ $t('save') }}</el-button>
        </div>
      </el-dialog>
      <el-dialog
          v-model="tgSettingShow"
          class="forward-dialog"
      >
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('tgBot') }}</span>
            <el-tooltip effect="dark" :content="$t('tgBotDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <div class="forward-set-body">
          <el-input :placeholder="setting.tgBotToken || $t('tgBotToken')" v-model="tgBotToken" @keyup.enter="tgBotSave"></el-input>
          <el-input-tag tag-type="warning" :placeholder="$t('toBotTokenDesc')" v-model="tgChatId"
                        @add-tag="addChatTag"></el-input-tag>
          <el-input tag-type="warning" :placeholder="$t('customDomainDesc')" v-model="customDomain" @keyup.enter="tgBotSave"></el-input>
          <div class="tg-bind-tip">通知和 AI 指令共用这个 Bot；点“绑定 AI 指令”会自动保存并设置 Webhook，之后可直接在 Telegram 对话里操作邮箱。</div>
          <div class="tg-msg-label">
            <span>{{t('from')}}</span>
            <el-select  v-model="tgMsgFrom" >
              <el-option
                  v-for="item in tgMsgFromOption"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </div>
          <div class="tg-msg-label">
            <span>{{t('recipient')}}</span>
            <el-select  v-model="tgMsgTo" >
              <el-option
                  v-for="item in tgMsgToOption"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </div>
          <div class="tg-msg-label">
            <span>{{t('emailText')}}</span>
            <el-select  v-model="tgMsgText" >
              <el-option
                  v-for="item in tgMsgTextOption"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-switch v-model="tgBotStatus" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                       :inactive-text="$t('disable')"/>
            <el-button :loading="tgBindLoading" @click="bindTelegram">绑定 AI 指令</el-button>
            <el-button :loading="settingLoading" type="primary" @click="tgBotSave">
              {{ $t('save') }}
            </el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog
          v-model="thirdEmailShow"
          class="forward-dialog"
      >
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('otherEmail') }}</span>
            <el-tooltip effect="dark" :content="$t('otherEmailDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <div class="forward-set-body">
          <el-input-tag tag-type="warning" :placeholder="$t('otherEmailInputDesc')" v-model="forwardEmail"
                        @add-tag="emailAddTag"></el-input-tag>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-switch v-model="forwardStatus" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                       :inactive-text="$t('disable')"/>
            <el-button :loading="settingLoading" type="primary" @click="forwardEmailSave">
              {{ $t('save') }}
            </el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog
          v-model="webhookShow"
          class="forward-dialog"
      >
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">Webhook 通知</span>
            <el-tooltip effect="dark" content="收到新邮件时向该 URL 发送 POST 请求（JSON）">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <div class="forward-set-body">
          <el-input v-model="webhookUrl" placeholder="https://your-webhook-url.com/notify"/>
          <div class="forward-set-row">
            <span>开启</span>
            <el-switch v-model="webhookStatus" :active-value="0" :inactive-value="1"/>
          </div>
          <div class="forward-set-row">
            <span>失败重试次数</span>
            <el-input-number v-model="webhookRetry" :min="0" :max="5"/>
          </div>
          <div class="forward-set-row">
            <span>签名密钥(可选)</span>
            <el-input v-model="webhookSecret" placeholder="Bearer Token，留空不校验" type="password" show-password/>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button :loading="webhookTesting" @click="testWebhook">{{ webhookTesting ? '测试中…' : '发送测试' }}</el-button>
            <el-button :loading="settingLoading" type="primary" @click="saveWebhook">{{ $t('save') }}</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="deeplShow" title="DeepL API Key" width="460px">
        <div class="forward-set-body">
          <el-input v-model="deeplKey" placeholder="DeepL-Auth-Key，例如 xxxx:fx" type="password" show-password/>
          <div class="oidc-hint">
            免费版 key 一般以 <code>:fx</code> 结尾，会自动走 api-free.deepl.com；付费版走 api.deepl.com。
            留空保存不会覆盖已保存的 key；接口只回显前 8 位。
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="deeplShow = false">{{ $t('cancel') }}</el-button>
            <el-button :loading="settingLoading" type="primary" @click="saveDeepL">{{ $t('save') }}</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog
          v-model="autoCleanShow"
          class="forward-dialog"
      >
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">自动清理</span>
            <el-tooltip effect="dark" content="自动删除超过指定天数的邮件，0 表示关闭">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <div class="forward-set-body">
          <div class="forward-set-row">
            <span>保留天数</span>
            <el-input-number v-model="autoCleanDays" :min="0" :max="3650"/>
          </div>
          <el-input-tag tag-type="warning" placeholder="排除的用户邮箱（不清理），逗号分隔" v-model="autoCleanExclude"
                        @add-tag="autoCleanExcludeAddTag"/>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button :loading="settingLoading" type="primary" @click="saveAutoClean">{{ $t('save') }}</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog
          v-model="oidcShow"
          class="forward-dialog oidc-dialog"
          width="640px"
      >
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">企业登录（OIDC）</span>
            <el-tooltip effect="dark" content="可添加多个标准 OIDC 服务商（Keycloak、Azure AD、Okta、Authentik、Auth0 等），登录页会各显示一个按钮">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <div class="forward-set-body">
          <div class="oidc-empty" v-if="oidcProviders.length === 0">
            还没有 OIDC 服务商，点下方「新增服务商」开始配置。
          </div>
          <el-collapse v-model="oidcOpenIds">
            <el-collapse-item v-for="(provider, index) in oidcProviders" :key="provider.id" :name="provider.id">
              <template #title>
                <div class="oidc-item-title">
                  <span class="oidc-item-name">{{ provider.name || '未命名服务商' }}</span>
                  <el-tag size="small" :type="provider.enabled ? 'success' : 'info'" round>
                    {{ provider.enabled ? '已启用' : '已停用' }}
                  </el-tag>
                </div>
              </template>

              <div class="forward-set-row">
                <span>启用</span>
                <el-switch v-model="provider.enabled" @click.stop/>
              </div>

              <div class="oidc-field">
                <span>显示名称</span>
                <el-input v-model="provider.name" placeholder="SSO"/>
                <div class="oidc-hint">登录页按钮上显示的文字，例如「企业登录」「公司 SSO」</div>
              </div>

              <div class="oidc-field">
                <span>图标</span>
                <el-input v-model="provider.icon" placeholder="mdi:shield-key-outline 或 https://.../logo.png"/>
                <div class="oidc-hint">可填 Iconify 图标名或图片 URL；留空使用默认盾牌图标</div>
              </div>

              <div class="oidc-field">
                <span>Issuer 地址</span>
                <el-input v-model="provider.issuer" placeholder="https://idp.example.com/realms/company"/>
                <div class="oidc-hint">
                  身份提供方（IdP）的 Issuer，不要带结尾斜杠。系统会自动请求
                  <code>/.well-known/openid-configuration</code> 取授权、令牌、用户信息端点。
                  微软 Entra ID 形如 https://login.microsoftonline.com/{租户ID}/v2.0
                </div>
              </div>

              <div class="oidc-field">
                <span>Client ID</span>
                <el-input v-model="provider.clientId" placeholder="在 IdP 创建的 Web 应用 Client ID"/>
              </div>

              <div class="oidc-field">
                <span>Client Secret</span>
                <el-input v-model="provider.clientSecret" type="password" show-password
                          :placeholder="provider.hasSecret ? '已保存，留空不修改' : '留空则不修改已保存的密钥'"/>
                <div class="oidc-hint">只存服务端，后台接口不回显明文；留空保存不会覆盖原密钥</div>
              </div>

              <div class="oidc-field">
                <span>Scope</span>
                <el-input v-model="provider.scope" placeholder="openid profile email"/>
                <div class="oidc-hint">默认 openid profile email；不需要额外权限就别改</div>
              </div>

              <div class="oidc-field">
                <span>回调地址</span>
                <el-input v-model="provider.callbackUrl" :placeholder="defaultOidcCallback"/>
                <div class="oidc-hint">
                  与 Google / GitHub 一样填「站点 + /login」：<span class="oidc-code">{{ defaultOidcCallback }}</span>
                  <br>
                  这个值必须和 IdP 应用里登记的 Redirect URI 完全一致（含结尾斜杠），否则 IdP 会拒绝回调。
                </div>
              </div>

              <el-button link type="danger" @click.stop="removeOidc(index)">删除此服务商</el-button>
            </el-collapse-item>
          </el-collapse>

          <el-button class="oidc-add" plain @click="addOidc">+ 新增服务商</el-button>

          <div class="oidc-hint oidc-note">
            IdP 应用类型请选「Web 应用 / 机密客户端」并开启授权码模式（Authorization Code）。
            登录时仅当 IdP 返回 email_verified=true 才自动关联已有账号，否则要求用户绑定。
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="oidcShow = false">{{ $t('cancel') }}</el-button>
            <el-button :loading="settingLoading" type="primary" @click="saveOidc">{{ $t('save') }}</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog
          v-model="forwardRulesShow"
          class="forward-dialog"
      >
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('forwardingRules') }}</span>
            <el-tooltip effect="dark" :content="$t('forwardingRulesDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <div class="forward-set-body">
          <el-input-tag :placeholder="$t('ruleEmailsInputDesc')" tag-type="success" v-model="ruleEmail"
                        @add-tag="ruleEmailAddTag"/>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-radio-group v-model="ruleType">
              <el-radio :value="0">{{ $t('forwardAll') }}</el-radio>
              <el-radio :value="1">{{ $t('rules') }}</el-radio>
            </el-radio-group>
            <el-button :loading="settingLoading" type="primary" @click="ruleEmailSave">
              {{ $t('save') }}
            </el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="regVerifyCountShow" :title="$t('rulesVerifyTitle',{count: regVerifyCount})"
                 @closed="regVerifyCount = setting.regVerifyCount">
        <form @submit.prevent>
          <el-input-number type="text" v-model="regVerifyCount" :min="1" @keyup.enter="saveRegVerifyCount">
          </el-input-number>
          <el-button type="primary" :loading="settingLoading" @click="saveRegVerifyCount">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="addVerifyCountShow" :title="$t('rulesVerifyTitle',{count: addVerifyCount})"
                 @closed="addVerifyCount = setting.addVerifyCount">
        <form @submit.prevent>
          <el-input-number type="text" v-model="addVerifyCount" :min="1" @keyup.enter="saveAddVerifyCount"/>
          <el-button type="primary" :loading="settingLoading" @click="saveAddVerifyCount">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog top="5vh" v-model="noticePopupShow" :title="$t('noticePopup')" class="notice-popup"
                 @closed="resetNoticeForm">
        <form @submit.prevent>
          <el-input v-model="noticeForm.noticeTitle" :placeholder="t('titleDesc')" @keyup.enter="saveNoticePopup"/>
          <div class="notice-line-item">
            <el-select v-model="noticeForm.noticeType">
              <template #prefix>
                <span style="margin-right: 10px">{{ $t('icon') }}</span>
              </template>
              <el-option key="none" label="None" value="none"/>
              <el-option key="primary" label="Primary" value="primary"/>
              <el-option key="success" label="Success" value="success"/>
              <el-option key="warning" label="Warning" value="warning"/>
              <el-option key="info" label="Info" value="info"/>
            </el-select>
            <el-select v-model="noticeForm.noticePosition">
              <template #prefix>
                <span style="margin-right: 10px">{{ $t('position') }}</span>
              </template>
              <el-option key="top-left" :label="t('topLeft')" value="top-left"/>
              <el-option key="top-right" :label="t('topRight')" value="top-right"/>
              <el-option key="bottom-left" :label="t('bottomLeft')" value="bottom-left"/>
              <el-option key="bottom-right" :label="t('bottomRight')" value="bottom-right"/>
            </el-select>
            <el-input-number v-model="noticeForm.noticeWidth">
              <template #prefix>
                {{ $t('width') }}
              </template>
              <template #suffix>
                px
              </template>
            </el-input-number>
            <el-input-number v-model="noticeForm.noticeOffset">
              <template #prefix>
                {{ $t('offset') }}
              </template>
              <template #suffix>
                px
              </template>
            </el-input-number>
            <el-input-number v-model="noticeForm.noticeDuration">
              <template #prefix>
                {{ $t('duration') }}
              </template>
              <template #suffix>
                ms
              </template>
            </el-input-number>
          </div>
          <div class="notice-popup-item">
            <el-input
                v-model="noticeForm.noticeContent"
                :autosize="{ minRows: 15, maxRows: 25 }"
                type="textarea"
                :placeholder="t('noticeContentDesc')"
            />
          </div>
        </form>
        <template #footer>
          <div class="dialog-footer">
            <el-switch v-model="noticeForm.notice" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                       :inactive-text="$t('disable')"/>
            <div>
              <el-button @click="previewNoticePopup">
                {{ $t('preview') }}
              </el-button>
              <el-button :loading="settingLoading" type="primary" @click="saveNoticePopup">
                {{ $t('save') }}
              </el-button>
            </div>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="addS3Show" :title="t('s3Configuration')" width="340" @closed="resetAddS3Form">
        <form @submit.prevent>
          <el-input class="dialog-input" type="text" placeholder="Bucket" v-model="s3.bucket" @keyup.enter="saveS3"/>
          <el-input class="dialog-input" type="text" placeholder="Endpoint" v-model="s3.endpoint" @keyup.enter="saveS3"/>
          <el-input class="dialog-input" type="text" placeholder="Region" v-model="s3.region" @keyup.enter="saveS3"/>
          <el-input class="dialog-input" type="text" :placeholder="setting.s3AccessKey || 'Access Key'"
                    v-model="s3.s3AccessKey" @keyup.enter="saveS3"/>
          <el-input style="margin-bottom: 10px" type="text" :placeholder="setting.s3SecretKey || 'Secret Key'" v-model="s3.s3SecretKey" @keyup.enter="saveS3"/>
          <div class="force-path-style">
            <div class="force-path-style-left">
              <span>ForcePathStyle</span>
              <el-tooltip effect="dark" :content="$t('forcePathStyleDesc')">
                <Icon class="warning" icon="fe:warning" width="18" height="18"/>
              </el-tooltip>
            </div>
            <el-switch :before-change="beforeChange" :active-value="0" :inactive-value="1"
                       v-model="s3.forcePathStyle"/>
          </div>
          <div class="s3-button">
            <el-button :loading="clearS3Loading" @click="clearS3">{{ t('clear') }}</el-button>
            <el-button type="primary" :loading="settingLoading && !clearS3Loading" @click="saveS3">{{ t('save') }}</el-button>
          </div>
        </form>
      </el-dialog>
      <el-dialog v-model="emailPrefixShow" :title="t('emailPrefix')"  @closed="resetEmailPrefix"  >
        <div class="email-prefix">
          <div>{{ t('atLeast') }}</div>
          <el-input-number v-model="minEmailPrefix" :min="1" :max="20" style="width: 150px" @keyup.enter="saveEmailPrefix" >
            <template #suffix>
              <span>{{ t('character') }}</span>
            </template>
          </el-input-number>
        </div>
        <div class="prefix-filter">
          <div style="margin-bottom: 10px;">{{ t('mustNotContain') }}</div>
          <el-input-tag style="margin-bottom: 10px;" v-model="emailPrefixFilter"  />
        </div>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveEmailPrefix">{{ $t('save') }}</el-button>
      </el-dialog>
      <el-dialog v-model="blackFormShow" class="forward-dialog" @closed="resetBlackList">
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('blackList') }}</span>
            <el-tooltip effect="dark" :content="$t('blackListDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <el-form>
          <el-form-item :label="t('blackFromDesc')" label-position="top">
            <el-input-tag v-model="blackListForm.blackFrom" @add-tag="banEmailAddTag"  />
          </el-form-item>
          <el-form-item :label="t('blackSubjectDesc')" label-position="top">
            <el-input-tag v-model="blackListForm.blackSubject"/>
          </el-form-item>
          <el-form-item :label="t('blackContentDesc')" label-position="top">
            <el-input-tag v-model="blackListForm.blackContent"/>
          </el-form-item>
        </el-form>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveBlackList">{{ $t('save') }}</el-button>
      </el-dialog>
      <el-dialog v-model="filterFormShow" title="邮件过滤器" width="640px" class="filter-dialog">
        <div class="filter-tip">收信时从上到下匹配；命中后按分类归档，不再走 AI 分类。</div>
        <div v-for="(rule, index) in filterRules" :key="index" class="filter-rule-row">
          <el-select v-model="rule.field" style="width: 92px">
            <el-option label="任意" value="any"/>
            <el-option label="发件人" value="from"/>
            <el-option label="主题" value="subject"/>
            <el-option label="收件人" value="to"/>
          </el-select>
          <el-select v-model="rule.op" style="width: 88px">
            <el-option label="包含" value="contains"/>
            <el-option label="等于" value="equals"/>
          </el-select>
          <el-input v-model="rule.value" placeholder="关键词或地址" style="flex: 1"/>
          <el-select v-model="rule.category" style="width: 100px">
            <el-option label="主要" value="primary"/>
            <el-option label="社交" value="social"/>
            <el-option label="推广" value="promotion"/>
            <el-option label="动态" value="updates"/>
            <el-option label="广告" value="ads"/>
            <el-option label="垃圾邮件" value="spam"/>
          </el-select>
          <el-button text type="danger" @click="filterRules.splice(index, 1)">删除</el-button>
        </div>
        <el-button style="width: 100%; margin-top: 10px" @click="addFilterRule">添加规则</el-button>
        <template #footer>
          <el-button @click="filterFormShow = false">{{ $t('cancel') }}</el-button>
          <el-button type="primary" :loading="settingLoading" @click="saveFilters">{{ $t('save') }}</el-button>
        </template>
      </el-dialog>
      <el-dialog v-model="aiCodeFilterShow" class="forward-dialog" @closed="resetAiCodeFilter">
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('codeRecognitionRules') }}</span>
            <el-tooltip effect="dark" :content="$t('codeRecognitionRulesDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <el-form>
          <el-form-item :label="t('senderRules')" label-position="top">
            <el-input-tag v-model="aiCodeFilter" @add-tag="aiCodeFilterAddTag"/>
          </el-form-item>
        </el-form>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveAiCodeFilter">{{ $t('save') }}</el-button>
      </el-dialog>
      <el-dialog v-model="senderProvidersShow" :title="$t('senderProviders')" width="880px"
                 class="provider-dialog" @open="loadSenderProviders">
        <!-- 不用 v-loading：全局把 loading 蒙层改成 rgba(0,0,0,.3)，打开瞬间会闪一层灰底 -->
        <div class="provider-wrap">
          <div class="provider-tip">{{ $t('senderProvidersDesc') }}</div>
          <el-alert v-if="senderProvidersInfo.hasCloudflareEmail" :title="$t('senderCfEmailTip')" type="info"
                    :closable="false" show-icon class="provider-alert"/>

          <div class="provider-summary">
            <div class="provider-stat">
              <span class="provider-stat-value">
                {{ providerSummary.synced }}<i>/{{ providerSummary.total }}</i>
              </span>
              <span class="provider-stat-label">{{ $t('channelSynced') }}</span>
            </div>
            <div class="provider-stat">
              <span class="provider-stat-value">
                {{ providerSummary.routable }}<i>/{{ providerSummary.synced }}</i>
              </span>
              <span class="provider-stat-label">{{ $t('channelRoutable') }}</span>
            </div>
            <div class="provider-stat">
              <span class="provider-stat-value">{{ providerSummary.remaining.day }}</span>
              <span class="provider-stat-label">
                {{ $t('channelDailyRemaining') }} · {{ providerSummary.usage.day }}/{{ providerSummary.limits.day }}
              </span>
            </div>
            <div class="provider-stat">
              <span class="provider-stat-value">{{ providerSummary.remaining.month }}</span>
              <span class="provider-stat-label">
                {{ $t('channelMonthlyRemaining') }} · {{ providerSummary.usage.month }}/{{ providerSummary.limits.month }}
              </span>
            </div>
          </div>
          <div class="provider-quota-note">{{ $t('channelQuotaScope') }}</div>
          <div class="provider-quota-note">{{ $t('channelQuotaLocal') }}</div>
          <div v-if="senderProvidersLoading && !senderProviderRows.length" class="provider-loading">
            {{ $t('loadingText') }}
          </div>

          <div v-for="row in senderProviderRows" :key="row.id" class="provider-card"
               :class="{ 'is-open': row.expanded }">
            <div class="provider-head" @click="toggleProvider(row)">
              <span class="provider-caret" :class="{ open: row.expanded }">▸</span>
              <span class="provider-name">{{ row.name }}</span>
              <el-tag size="small" effect="plain" :type="row.configured ? 'success' : 'info'">
                {{ row.configured ? $t('channelSyncedTag') : $t('channelNotConfigured') }}
              </el-tag>
              <el-tag v-if="row.cooling" type="warning" size="small">{{ $t('providerCooling') }}</el-tag>
              <div class="provider-head-actions" @click.stop>
                <el-button v-if="row.meta.signupUrl" link type="primary" size="small" @click="openProviderSignup(row)">
                  {{ $t('registerProvider') }}
                </el-button>
                <span class="provider-label">{{ $t('priority') }}</span>
                <el-input-number v-model="row.order" :min="1" :max="99" size="small"
                                 controls-position="right" class="provider-order"/>
                <el-switch v-model="row.enabled"/>
              </div>
            </div>

            <!-- 折叠态：只留一行额度摘要，一眼看清每个渠道的情况 -->
            <div v-if="!row.expanded" class="provider-brief">
              <span>{{ $t('channelDailyCap') }} {{ row.dailyLimit }}</span>
              <span>{{ $t('todaySent') }} {{ row.usage.day }}</span>
              <span>{{ $t('channelRemaining') }} <b>{{ row.remaining.day }}</b></span>
              <span>{{ $t('channelMonthlyRemaining') }} <b>{{ row.remaining.month }}</b></span>
            </div>

            <div v-show="row.expanded" class="provider-body">
              <div class="provider-usage">
                <div class="provider-usage-item">
                  <div class="provider-usage-text">
                    <span>{{ $t('channelDailyCap') }} {{ row.dailyLimit }}</span>
                    <span>{{ $t('todaySent') }} {{ row.usage.day }}</span>
                    <span class="provider-remaining">
                      {{ $t('channelRemaining') }} <b>{{ row.remaining.day }}</b>
                    </span>
                  </div>
                  <el-progress :percentage="usagePercent(row, 'day')" :stroke-width="6" :show-text="false"
                               :color="usageColor(usagePercent(row, 'day'))"/>
                </div>
                <div class="provider-usage-item">
                  <div class="provider-usage-text">
                    <span>{{ $t('monthlyLimit') }} {{ row.monthlyLimit }}</span>
                    <span>{{ $t('monthSent') }} {{ row.usage.month }}</span>
                    <span class="provider-remaining">
                      {{ $t('channelRemaining') }} <b>{{ row.remaining.month }}</b>
                    </span>
                  </div>
                  <el-progress :percentage="usagePercent(row, 'month')" :stroke-width="6" :show-text="false"
                               :color="usageColor(usagePercent(row, 'month'))"/>
                </div>
              </div>

              <div class="provider-accounts">
                <div class="provider-accounts-head">
                  <span>{{ $t('sendAccounts') }}</span>
                  <el-button size="small" text type="primary" @click="addProviderAccount(row)">
                    + {{ $t('addSendAccount') }}
                  </el-button>
                </div>
                <div v-for="(account, index) in row.accounts" :key="index" class="provider-account-row">
                  <el-select v-model="account.domain" class="account-domain" size="small" filterable allow-create clearable
                             default-first-option :placeholder="$t('sendDomain')">
                    <el-option v-for="domain in providerDomainOptions" :key="domain" :label="domain" :value="domain"/>
                  </el-select>
                  <el-input v-model="account.apiKey" class="account-key" size="small" show-password
                            :placeholder="$t('apiKeyPlaceholder')"/>
                  <el-input v-if="row.meta.keyFields.includes('secret')" v-model="account.secret" class="account-secret"
                            size="small" show-password :placeholder="$t('apiSecret')"/>
                  <el-button size="small" :loading="account.testing" @click="testProviderAccount(row, account)">
                    {{ $t('testSend') }}
                  </el-button>
                  <el-button size="small" type="danger" text @click="removeProviderAccount(row, index)">
                    {{ $t('delete') }}
                  </el-button>
                </div>
                <div v-if="!row.accounts.length" class="provider-accounts-empty">{{ $t('noSendAccount') }}</div>
              </div>

              <div class="provider-form">
                <div class="provider-field">
                  <span>{{ $t('dailyLimit') }}</span>
                  <el-input-number v-model="row.dailyLimit" :min="1" :max="100000" size="small"
                                   controls-position="right" @change="onProviderLimitChange(row, 'day')"/>
                  <span class="provider-field-hint">
                    {{ row.dailyLimitManual
                        ? $t('channelLimitHintManual', {value: row.defaultDailyLimit})
                        : $t('channelLimitHintDefault', {value: row.defaultDailyLimit}) }}
                  </span>
                  <el-button v-if="row.dailyLimitManual" link size="small" class="provider-limit-reset"
                             @click="resetProviderLimit(row, 'day')">
                    {{ $t('channelLimitReset') }}
                  </el-button>
                </div>
                <div class="provider-field">
                  <span>{{ $t('monthlyLimit') }}</span>
                  <el-input-number v-model="row.monthlyLimit" :min="1" :max="3000000" size="small"
                                   controls-position="right" @change="onProviderLimitChange(row, 'month')"/>
                  <span class="provider-field-hint">
                    {{ row.monthlyLimitManual
                        ? $t('channelLimitHintManual', {value: row.defaultMonthlyLimit})
                        : $t('channelLimitHintDefault', {value: row.defaultMonthlyLimit}) }}
                  </span>
                  <el-button v-if="row.monthlyLimitManual" link size="small" class="provider-limit-reset"
                             @click="resetProviderLimit(row, 'month')">
                    {{ $t('channelLimitReset') }}
                  </el-button>
                </div>
                <div class="provider-field provider-field-action">
                  <el-button size="small" :loading="row.testing" @click="testSenderProvider(row)">
                    {{ $t('testSend') }}
                  </el-button>
                </div>
              </div>

              <div class="provider-note">{{ row.meta.note }}</div>
              <div class="provider-dns">
                <div class="provider-dns-title">{{ $t('dnsRecords') }}</div>
                <div v-for="dns in dnsRows(row)" :key="dns.key" class="dns-row">
                  <span class="dns-name">{{ dns.type }} {{ dns.key }}</span>
                  <el-input v-model="row.dnsRecords[dns.key]" size="small" class="dns-value"
                            :placeholder="$t('dnsValuePlaceholder')"/>
                  <el-tag size="small" class="dns-status" :type="dnsStatusType(dns.status)">{{ $t(dnsStatusKey(dns.status)) }}</el-tag>
                </div>
                <div v-if="row.meta.spfInclude" class="dns-row">
                  <span class="dns-name">TXT @ (include:{{ row.meta.spfInclude }})</span>
                  <span class="dns-hint">{{ $t('spfMergeHint') }}</span>
                  <el-tag size="small" class="dns-status" :type="dnsStatusType(spfStatus(row).status)">
                    {{ $t(dnsStatusKey(spfStatus(row).status)) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
          <el-button size="small" class="provider-check" :loading="senderDnsLoading" @click="checkSenderDns">
            {{ $t('checkDns') }}
          </el-button>
        </div>
        <template #footer>
          <el-button @click="senderProvidersShow = false">{{ $t('cancel') }}</el-button>
          <el-button type="primary" :loading="senderProvidersSaving" @click="saveSenderProviders">
            {{ $t('save') }}
          </el-button>
        </template>
      </el-dialog>
    </el-scrollbar>
  </div>
</template>

<script setup>
import {computed, defineOptions, nextTick, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {aiModels, deleteBackground, setBackground, setBlackList, settingQuery, settingSet, tgWebhook, webhookTest, senderProvidersQuery, senderProvidersSave, senderProvidersTest, senderProvidersDns} from "@/request/setting.js";
import {aiClassify} from "@/request/ai.js";
import {versionCheck, versionInfo} from "@/request/version.js";
import {telegramBindTicket} from "@/request/my.js";
import {useSettingStore} from "@/store/setting.js";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useAccountStore} from "@/store/account.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url} from "@/utils/convert.js";
import {storeToRefs} from "pinia";
import {debounce} from 'lodash-es'
import {isDomain, isEmail} from "@/utils/verify-utils.js";
import loading from "@/components/loading/index.vue";
import {fileToBase64} from "@/utils/file-utils.js"
import {useI18n} from 'vue-i18n';
import {useRouter} from 'vue-router';

defineOptions({
  name: 'sys-setting'
})

const {t, locale} = useI18n();
const router = useRouter()

function toggleCard(e) {
  e.currentTarget.parentElement?.classList.toggle('collapsed')
};
const ADMIN_EN = {
  '网站设置':'Website', '个性化设置':'Personalization', '邮件设置':'Mail settings', '对象存储':'Object storage',
  '邮件推送':'Mail delivery', 'Turnstile 人机验证':'Turnstile', '网站公告':'Announcement',
  '用户注册':'User sign-up', '隐藏登录域名':'Hide login domain', '注册码':'Registration code',
  '添加邮箱':'Add mailbox', '多号模式':'Multi-account', '同步删除':'Sync delete', '邮箱前缀':'Mailbox prefix',
  '登录透明':'Login opacity', '显示发件人头像':'Show sender avatars', '登录背景':'Login background',
  '邮件接收':'Receive mail', '自动刷新':'Auto refresh', '邮件发送':'Send mail', '无人收件':'No-recipient mail',
  'Resend Token':'Resend Token', '邮件黑名单':'Mail blacklist', '邮件过滤器':'Mail filters',
  '访问域名':'Access domain', 'Telegram 机器人':'Telegram bot', '注册验证':'Registration verification',
  '企业登录（OIDC）':'Enterprise sign-in (OIDC)', 'AI 接口（OpenAI 兼容）':'AI API (OpenAI compatible)',
  'AI 收件分类':'AI inbox classification', 'AI 摘要':'AI summary', '翻译（DeepL）':'Translation (DeepL)',
  'S3 配置':'S3 configuration', 'Webhook 通知':'Webhook notifications', '存储类型':'Storage type',
  '第三方邮箱':'Third-party mailbox', '全部转发':'Forward all', '转发规则':'Forwarding rules',
  '识别规则':'Detection rules', '识别验证码':'Detect verification codes', '添加验证':'Add verification',
  '自动清理':'Auto cleanup', '关闭':'Off', '启用':'On', '已关闭':'Off', '已启用':'On',
  '关闭（本地规则）':'Off (local rules)', '手动生成摘要':'Manual summary', '先拉取模型':'Fetch models',
  '拉取模型':'Fetch models', '接口地址':'Endpoint', '模型':'Model', '弹出':'Popup', '登录弹窗':'Login dialog',
  '保存后立即生效；已配置接口时优先走该接口，留空回退 Workers AI。':'Takes effect immediately; falls back to Workers AI when empty.',
  '系统设置':'System settings', '写邮件':'Compose', '中':'中',
  '个人信息':'Personal info', '头像':'Avatar', '修改头像':'Change avatar',
  '用户名':'Username', '修改':'Edit', '邮箱':'Email', '密码':'Password', '修改密码':'Change password',
  '两步验证':'Two-step verification', '启用':'Enable', '已关闭':'Off', '已绑定':'Bound', '未绑定':'Not bound',
  '密码登录强制两步验证':'Require 2FA for password login',
  '开启后，每次使用密码登录都必须输入验证码；第三方登录不受影响':'Require a code on every password login; third-party sign-in is unaffected.',
  '浏览器通知':'Browser notifications', '新邮件到达时在系统通知里提醒':'Notify on new mail',
  '第三方账号绑定':'Third-party accounts', '绑定':'Bind', '解绑':'Unbind', '当前账号':'Current account'
}
let adminObserver
function translateAdminDom() {
  if (locale.value !== 'en') return
  const root = document.querySelector('.scroll-body')
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim()
    if (ADMIN_EN[text]) node.textContent = node.textContent.replace(text, ADMIN_EN[text])
    else if (/^\d+\s*个服务商$/.test(text)) node.textContent = text.replace(/^(\d+)\s*个服务商$/, '$1 providers')
  }
}
onMounted(() => {
  nextTick(translateAdminDom)
  setTimeout(translateAdminDom, 600)
  adminObserver = new MutationObserver(() => translateAdminDom())
  adminObserver.observe(document.body, {childList:true, subtree:true})
})
onUnmounted(() => adminObserver?.disconnect())
watch(locale, () => nextTick(translateAdminDom))

const firstLoading = ref(true)
const settingReady = ref(false)
const backgroundImage = ref('')
const localUpShow = ref(false)
const accountStore = useAccountStore();
const userStore = useUserStore();
const editTitleShow = ref(false)
const blackFormShow = ref(false)
const filterFormShow = ref(false)
const filterRules = ref([])
const aiCodeFilterShow = ref(false)
const aiModelList = ref([])
const aiModelsLoading = ref(false)
const aiClassifyLoading = ref(false)
const tgBindLoading = ref(false)
const r2DomainShow = ref(false)
const turnstileShow = ref(false)
const tgSettingShow = ref(false)
const noticePopupShow = ref(false)
const thirdEmailShow = ref(false)
const forwardRulesShow = ref(false)
const webhookShow = ref(false)
const webhookUrl = ref('')
const webhookStatus = ref(1)
const webhookRetry = ref(0)
const webhookSecret = ref('')
const webhookTesting = ref(false)
const deeplShow = ref(false)
const deeplKey = ref('')
const autoCleanShow = ref(false)
const autoCleanDays = ref(0)
const autoCleanExclude = ref([])
const oidcShow = ref(false)
const oidcProviders = ref([])
const oidcOpenIds = ref([])
// 与 Google / GitHub 一致：回调落在登录页，由登录页拿 code 换 token
const defaultOidcCallback = window.location.origin + '/login'
const enabledOidcCount = computed(() => {
  const fromDialog = oidcProviders.value.filter(item => item.enabled).length
  if (fromDialog > 0) return fromDialog
  const saved = Array.isArray(setting.value.oidcProviders) ? setting.value.oidcProviders : []
  if (saved.length > 0) return saved.filter(item => item.enabled === true || item.enabled === 1).length
  return setting.value.oidcSwitch === 1 ? 1 : 0
})
const emailPrefixShow = ref(false)
// 多渠道发信
const senderProvidersShow = ref(false)
const senderProvidersLoading = ref(false)
const senderProvidersSaving = ref(false)
const senderDnsLoading = ref(false)
const senderProviderRows = ref([])
const senderProvidersInfo = ref({adminEmail: '', hasCloudflareEmail: false})
const senderDnsResult = ref(null)

/** 汇总口径由服务端算好（synced=凭据填全，routable=已启用且未冷却），前端不再重复算一遍 */
const emptyProviderSummary = {
  total: 0, synced: 0, enabled: 0, routable: 0,
  limits: {day: 0, month: 0},
  usage: {day: 0, month: 0},
  remaining: {day: 0, month: 0}
}
const providerSummary = computed(() => senderProvidersInfo.value.summary || emptyProviderSummary)

function usagePercent(row, period) {
  const limit = Number(period === 'day' ? row.dailyLimit : row.monthlyLimit) || 0
  const used = Number(row.usage?.[period]) || 0
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function usageColor(percent) {
  if (percent >= 90) return '#f56c6c'
  if (percent >= 70) return '#e6a23c'
  return '#34c759'
}
const settingStore = useSettingStore();
const uiStore = useUiStore();
const {settings: setting} = storeToRefs(settingStore);
const editTitle = ref('')
const editSubtitle = ref('')
const settingLoading = ref(false)
const clearS3Loading = ref(false)
const currentVersionInfo = ref({ version: '-', deployedAt: null })
const updateInfo = ref(null)
const versionLoading = ref(false)
const updateChecking = ref(false)
const r2DomainInput = ref('')
const loginOpacity = ref(0)
const chatOpacity = ref(0.88)
const backgroundTarget = ref('background')
const minEmailPrefix = ref(0)
const emailPrefixFilter = ref([])

async function loadVersionInfo() {
  if (versionLoading.value) return
  versionLoading.value = true
  try {
    const res = await versionInfo()
    currentVersionInfo.value = res || {version: '-'}
  } catch (e) {
    currentVersionInfo.value = {version: 'unknown'}
  } finally {
    versionLoading.value = false
  }
}

async function checkForUpdate() {
  if (updateChecking.value) return
  updateChecking.value = true
  try {
    const res = await versionCheck()
    updateInfo.value = res
  } catch (e) {
    updateInfo.value = {status: 'upstreamError'}
  } finally {
    updateChecking.value = false
  }
}

function formatVersionTime(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (e) {
    return value
  }
}

onMounted(loadVersionInfo)
const backgroundUrl = ref('')
let backgroundFile = {}
const showSetBackground = ref(false)
let regVerifyCount = ref(1)
let addVerifyCount = ref(1)
let backup = '{}'
const addS3Show = ref(false)
const addVerifyCountShow = ref(false)
const regVerifyCountShow = ref(false)
const turnstileForm = reactive({
  siteKey: '',
  secretKey: ''
})

const s3 = reactive({
  bucket: '',
  endpoint: '',
  region: '',
  s3AccessKey: '',
  s3SecretKey: '',
  forcePathStyle: 1
})

const noticeForm = reactive({
  noticeTitle: '',
  noticeContent: '',
  noticeType: '',
  noticeDuration: '',
  noticePosition: '',
  noticeOffset: 0,
  notice: 0,
  noticeWidth: 0
})

const regKeyOptions = computed(() => [
  {label: t('enable'), value: 0},
  {label: t('disable'), value: 1},
  {label: t('optional'), value: 2},
])

const blackListForm = ref({
  blackSubject: [],
  blackContent: [],
  blackFrom: []
})
const aiCodeFilter = ref([])

const authRefreshOptions = computed(() => [
  {label: t('disable'), value: 0},
  {label: '3s', value: 3},
  {label: '5s', value: 5},
  {label: '10s', value: 10},
  {label: '15s', value: 15},
  {label: '20s', value: 20},
])

const tgChatId = ref([])
const customDomain = ref('')
const tgBotStatus = ref(0)
const tgBotToken = ref('')
const forwardEmail = ref([])
const forwardStatus = ref(0)
const ruleType = ref(0)
const ruleEmail = ref([])
const tgMsgFrom = ref('')
const tgMsgTo = ref('')
const tgMsgText = ref('')

const tgMsgFromOption = [{label: t('show'), value: 'show'}, {label: t('hide'), value: 'hide'}, {label: t('onlyName'), value:'only-name'}]
const tgMsgToOption = [{label: t('show'), value: 'show'}, {label: t('hide'), value: 'hide'}]
const tgMsgTextOption = [{label: t('show'), value: 'show'}, {label: t('hide'), value: 'hide'}]
const tgMsgLabelWidth = computed(() => locale.value === 'en' ? '120px' : '100px');

getSettings()

function getSettings() {
  settingReady.value = false
  settingQuery().then(settingData => {
    setting.value = settingData
    setting.value.aiClassifyMode = setting.value.aiClassifyMode || 'off'
    setting.value.aiSummaryMode = setting.value.aiSummaryMode || 'manual'
    setting.value.countRefreshMinutes = setting.value.countRefreshMinutes || 10
    aiModelList.value = setting.value.aiModel ? [setting.value.aiModel] : []
    settingStore.domainList = settingData.domainList;
    settingStore.settings.showAvatar = settingData.showAvatar ?? 0;
    loginOpacity.value = setting.value.loginOpacity
    chatOpacity.value = setting.value.chatOpacity ?? 0.88
    minEmailPrefix.value = setting.value.minEmailPrefix
    firstLoading.value = false
    backgroundUrl.value = setting.value.background?.startsWith('http') ? setting.value.background : ''
    editTitle.value = setting.value.title
    r2DomainInput.value = setting.value.r2Domain
    addVerifyCount.value = setting.value.addVerifyCount
    regVerifyCount.value = setting.value.regVerifyCount
    resetNoticeForm()
    resetAddS3Form()
    resetEmailPrefix()
    resetBlackList()
    resetAiCodeFilter()
    nextTick(() => {
      settingReady.value = true
    })
  })
}


function openNoticePopup() {
  uiStore.showNotice()
}

function openAddVerifyCount() {
  if (settingLoading.value) return
  addVerifyCountShow.value = true
}

function openRegVerifyCount() {
  if (settingLoading.value) return
  regVerifyCountShow.value = true
}

function resetAddS3Form() {
  s3.bucket = setting.value.bucket
  s3.endpoint = setting.value.endpoint
  s3.region = setting.value.region
  s3.s3AccessKey = ''
  s3.s3SecretKey = ''
  s3.forcePathStyle = setting.value.forcePathStyle
}

function saveAddVerifyCount() {
  if (!addVerifyCount.value) {
    addVerifyCount.value = 1
  }
  editSetting({addVerifyCount: addVerifyCount.value})
}

function saveRegVerifyCount() {
  if (!regVerifyCount.value) {
    regVerifyCount.value = 1
  }
  editSetting({regVerifyCount: regVerifyCount.value})
}

function openWebhook() {
  webhookUrl.value = setting.value.webhookUrl || ''
  webhookStatus.value = setting.value.webhookStatus === undefined ? 1 : setting.value.webhookStatus
  webhookRetry.value = setting.value.webhookRetry || 0
  webhookSecret.value = setting.value.webhookSecret || ''
  webhookShow.value = true
}

function saveWebhook() {
  editSetting({
    webhookUrl: webhookUrl.value,
    webhookStatus: webhookStatus.value,
    webhookRetry: webhookRetry.value,
    webhookSecret: webhookSecret.value
  }, true)
}

function openAutoClean() {
  autoCleanDays.value = setting.value.autoCleanDays || 0
  autoCleanExclude.value = setting.value.autoCleanExclude
      ? setting.value.autoCleanExclude.split(',').filter(Boolean)
      : []
  autoCleanShow.value = true
}

function saveAutoClean() {
  editSetting({
    autoCleanDays: autoCleanDays.value,
    autoCleanExclude: autoCleanExclude.value.join(',')
  }, true)
}

function openOidc() {
  const list = Array.isArray(setting.value.oidcProviders) ? setting.value.oidcProviders : []
  oidcProviders.value = list.map(item => ({
    id: item.id,
    name: item.name || 'SSO',
    icon: item.icon || '',
    issuer: item.issuer || '',
    clientId: item.clientId || '',
    clientSecret: '',
    hasSecret: !!item.hasSecret,
    scope: item.scope || 'openid profile email',
    callbackUrl: item.callbackUrl || defaultOidcCallback,
    enabled: item.enabled === true || item.enabled === 1
  }))
  // 老库只有单条 oidc_* 配置时也展示出来，保存后即转成列表
  if (oidcProviders.value.length === 0 && setting.value.oidcIssuer && setting.value.oidcClientId) {
    oidcProviders.value.push({
      id: 'legacy',
      name: setting.value.oidcName || 'SSO',
      issuer: setting.value.oidcIssuer,
      clientId: setting.value.oidcClientId,
      clientSecret: '',
      hasSecret: !!setting.value.oidcClientSecret,
      scope: setting.value.oidcScope || 'openid profile email',
      callbackUrl: setting.value.oidcCallbackUrl || defaultOidcCallback,
      enabled: setting.value.oidcSwitch === 1
    })
  }
  // 打开时全部折叠，先看到服务商列表；保存后也会自动收起
  oidcOpenIds.value = []
  oidcShow.value = true
}

function addOidc() {
  const id = 'oidc-' + Date.now().toString(36)
  oidcProviders.value.push({
    id,
    name: 'SSO',
    icon: '',
    issuer: '',
    clientId: '',
    clientSecret: '',
    hasSecret: false,
    scope: 'openid profile email',
    callbackUrl: defaultOidcCallback,
    enabled: true
  })
  oidcOpenIds.value.push(id)
}

function removeOidc(index) {
  const [removed] = oidcProviders.value.splice(index, 1)
  oidcOpenIds.value = oidcOpenIds.value.filter(id => id !== removed?.id)
}

function saveOidc() {
  const list = oidcProviders.value
  if (list.some(item => item.enabled && (!item.issuer.trim() || !item.clientId.trim() || !item.callbackUrl.trim()))) {
    ElMessage({message: '启用的服务商必须填写 Issuer、Client ID 和回调地址', type: 'error', plain: true})
    return
  }
  const form = {
    oidcProviders: list.map(item => ({
      id: item.id,
      name: item.name || 'SSO',
      icon: (item.icon || '').replace(/\\\//g, '/').replace(/\\:/g, ':').trim(),
      issuer: item.issuer.trim().replace(/\/+$/, ''),
      clientId: item.clientId.trim(),
      clientSecret: item.clientSecret || '',
      scope: item.scope || 'openid profile email',
      callbackUrl: item.callbackUrl.trim(),
      enabled: !!item.enabled
    }))
  }
  editSetting(form, true)
  oidcOpenIds.value = []
}

function openDeepL() {
  deeplKey.value = ''
  deeplShow.value = true
}

function saveDeepL() {
  if (!deeplKey.value.trim()) {
    deeplShow.value = false
    return
  }
  editSetting({deeplKey: deeplKey.value.trim()}, true)
  deeplShow.value = false
}

async function testWebhook() {
  if (webhookTesting.value) return
  if (!webhookUrl.value.trim()) {
    ElMessage({message: '请先填写 Webhook URL', type: 'error', plain: true})
    return
  }
  webhookTesting.value = true
  try {
    const res = await webhookTest({
      url: webhookUrl.value.trim(),
      secret: webhookSecret.value.includes('******') ? '' : webhookSecret.value
    })
    ElMessage({
      message: `${res.message}（HTTP ${res.status || '-'}，${res.latencyMs}ms）`,
      type: res.ok ? 'success' : 'error',
      plain: true
    })
  } finally {
    webhookTesting.value = false
  }
}

function autoCleanExcludeAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));
  autoCleanExclude.value.splice(autoCleanExclude.value.length - 1, 1)
  emails.forEach(email => {
    if (isEmail(email) && !autoCleanExclude.value.includes(email)) {
      autoCleanExclude.value.push(email)
    }
  })
}

function closedSetBackground() {
  backgroundImage.value = ''
  localUpShow.value = false
  backgroundUrl.value = setting.value.background?.startsWith('http') ? setting.value.background : ''
}

function openTgSetting() {
  tgBotStatus.value = setting.value.tgBotStatus
  tgBotToken.value = ''
  customDomain.value = setting.value.customDomain
  tgMsgFrom.value = setting.value.tgMsgFrom
  tgMsgText.value = setting.value.tgMsgText
  tgMsgTo.value = setting.value.tgMsgTo
  tgChatId.value = []
  if (setting.value.tgChatId) {
    const list = setting.value.tgChatId.split(',')
    tgChatId.value.push(...list)
  }
  tgSettingShow.value = true
}

function openNoticePopupSetting() {
  noticePopupShow.value = true
}

function resetNoticeForm() {
  noticeForm.notice = setting.value.notice
  noticeForm.noticeContent = setting.value.noticeContent
  noticeForm.noticeDuration = setting.value.noticeDuration
  noticeForm.noticeTitle = setting.value.noticeTitle
  noticeForm.noticePosition = setting.value.noticePosition
  noticeForm.noticeType = setting.value.noticeType
  noticeForm.noticeOffset = setting.value.noticeOffset
  noticeForm.noticeWidth = setting.value.noticeWidth
}

function saveNoticePopup() {
  noticeForm.noticeOffset = noticeForm.noticeOffset || 0
  noticeForm.noticeWidth = noticeForm.noticeWidth || 0
  noticeForm.noticeDuration = noticeForm.noticeDuration || 0
  editSetting({...noticeForm})
}

function previewNoticePopup() {
  uiStore.previewNotice({...noticeForm})
}

function openThirdEmailSetting() {
  forwardEmail.value = []
  forwardStatus.value = setting.value.forwardStatus
  if (setting.value.forwardEmail) {
    const list = setting.value.forwardEmail.split(',')
    forwardEmail.value.push(...list)
  }
  thirdEmailShow.value = true
}

function openEmailPrefix() {
  emailPrefixShow.value = true
}

function openForwardRules() {
  ruleType.value = setting.value.ruleType
  ruleEmail.value = []
  if (setting.value.ruleEmail) {
    const list = setting.value.ruleEmail.split(',')
    ruleEmail.value.push(...list)
  }
  forwardRulesShow.value = true
}

function emailAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  forwardEmail.value.splice(forwardEmail.value.length - 1, 1)

  emails.forEach(email => {
    if (isEmail(email) && !forwardEmail.value.includes(email)) {
      forwardEmail.value.push(email)
    }
  })
}

function ruleEmailAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  ruleEmail.value.splice(ruleEmail.value.length - 1, 1)

  emails.forEach(email => {
    if (isEmail(email) && !ruleEmail.value.includes(email)) {
      ruleEmail.value.push(email)
    }
  })
}

function addChatTag(val) {

  const chatIds = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  tgChatId.value.splice(tgChatId.value.length - 1, 1)

  chatIds.forEach(id => {
    if (!isNaN(Number(id))) {
      tgChatId.value.push(id)
    }
  })
}

function clearS3() {

  const form = {
    bucket: '',
    endpoint: '',
    region: '',
    s3AccessKey: '',
    s3SecretKey: '',
    forcePathStyle: 1
  }
  clearS3Loading.value = true
  editSetting(form)
}

function saveS3() {

  const form = {
    bucket: s3.bucket,
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: s3.forcePathStyle
  }

  if (s3.s3AccessKey) form.s3AccessKey = s3.s3AccessKey
  if (s3.s3SecretKey) form.s3SecretKey = s3.s3SecretKey

  editSetting(form)
}

async function tgBotSave() {
  const form = {
    customDomain: customDomain.value,
    tgBotStatus: tgBotStatus.value,
    tgChatId: tgChatId.value + '',
    tgMsgFrom: tgMsgFrom.value,
    tgMsgText: tgMsgText.value,
    tgMsgTo: tgMsgTo.value
  }
  if (tgBotToken.value) form.tgBotToken = tgBotToken.value
  const ok = await editSetting(form)
  if (ok && tgBotStatus.value === 0) {
    try {
      const data = await tgWebhook({})
      ElMessage({message: `Telegram 已绑定：${data.url}`, type: 'success', plain: true})
    } catch (e) {
      ElMessage({message: e?.response?.data?.msg || e.message || 'Telegram Webhook 设置失败，请检查 Bot Token', type: 'warning', plain: true})
    }
  }
  return ok
}

async function bindTelegram() {
  if (tgBindLoading.value) return
  tgBindLoading.value = true
  const bindWindow = window.open('', '_blank')
  try {
    const {ticket} = await telegramBindTicket()
    await tgBotSave()
    if (bindWindow) bindWindow.location.href = `/telegram/bind?ticket=${encodeURIComponent(ticket)}`
  } catch (e) {
    bindWindow?.close()
    ElMessage({message: e?.response?.data?.msg || e.message || 'Telegram 绑定失败', type: 'error', plain: true})
  } finally {
    tgBindLoading.value = false
  }
}

function forwardEmailSave() {
  const form = {
    forwardStatus: forwardStatus.value,
    forwardEmail: forwardEmail.value + ''
  }
  editSetting(form)
}


function ruleEmailSave() {
  const form = {
    ruleEmail: ruleEmail.value + '',
    ruleType: ruleType.value
  }
  editSetting(form)
}

function doOpacityChange() {
  if (!settingReady.value) return
  const form = {}
  form.loginOpacity = loginOpacity.value
  editSetting(form, true)
}

function resetEmailPrefix() {
  minEmailPrefix.value = setting.value.minEmailPrefix
  emailPrefixFilter.value = setting.value.emailPrefixFilter
}

function resetBlackList() {
  blackListForm.value.blackFrom = setting.value.blackFrom ? setting.value.blackFrom.split(',') : []
  blackListForm.value.blackContent = setting.value.blackContent ? setting.value.blackContent.split(',') : []
  blackListForm.value.blackSubject = setting.value.blackSubject ? setting.value.blackSubject.split(',') : []
}

function resetAiCodeFilter() {
  aiCodeFilter.value = setting.value.aiCodeFilter ? setting.value.aiCodeFilter.split(',') : []
}

function saveEmailPrefix() {
  const form = {}
  form.minEmailPrefix = minEmailPrefix.value
  form.emailPrefixFilter = emailPrefixFilter.value
  editSetting(form, true)
}

function saveAiCodeFilter() {
  editSetting({aiCodeFilter: aiCodeFilter.value + ''})
}

const opacityChange = debounce(doOpacityChange, 1000, {
  leading: false,
  trailing: true
})

function saveBlackList() {

  let form = {
    blackContent: blackListForm.value.blackContent + '',
    blackSubject: blackListForm.value.blackSubject + '',
    blackFrom: blackListForm.value.blackFrom + ''
  }

  settingLoading.value = true

  setBlackList(form).then(() => {
    getSettings()
    ElMessage({
      message: t('setSuccess'),
      type: "success",
      plain: true
    })
    blackFormShow.value = false;
  }).finally(() => {
    settingLoading.value = false;
  })
}

function banEmailAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  blackListForm.value.blackFrom.splice(blackListForm.value.blackFrom.length - 1, 1)

  emails.forEach(email => {
    if ((isEmail(email) || isDomain(email)) && !blackListForm.value.blackFrom.includes(email)) {
      blackListForm.value.blackFrom.push(email)
    }
  })
}

function aiCodeFilterAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  aiCodeFilter.value.splice(aiCodeFilter.value.length - 1, 1)

  emails.forEach(email => {
    if ((isEmail(email) || isDomain(email)) && !aiCodeFilter.value.includes(email)) {
      aiCodeFilter.value.push(email)
    }
  })
}


async function saveChatOpacity() {
  if (!settingReady.value) return
  editSetting({chatOpacity: chatOpacity.value}, true)
}

async function saveShowAvatar(value) {
  if (!settingReady.value) return
  editSetting({showAvatar: value ? 1 : 0}, true)
}

function delBackground(target = 'background') {
  ElMessageBox.confirm(t('delBackgroundConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    deleteBackground(target).then(() => {
      backgroundUrl.value = ''
      setting.value[target] = null
      ElMessage({
        message: t('delSuccessMsg'),
        type: "success",
        plain: true
      })
    })
  })
}

function saveTurnstileKey() {
  const settingForm = {}
  settingForm.siteKey = turnstileForm.siteKey
  settingForm.secretKey = turnstileForm.secretKey
  editSetting(settingForm)
}

async function saveBackground() {

  if (settingLoading.value) return

  let image = ''

  if (localUpShow.value) {
    image = await fileToBase64(backgroundFile, true);
  } else {
    if (backgroundUrl.value && !backgroundUrl.value.startsWith('http')) {
      ElMessage({
        message: t('imageLinkErrorMsg'),
        type: "error",
        plain: true
      })
      return
    }
    image = backgroundUrl.value
  }
  settingLoading.value = true

  setBackground(image, backgroundTarget.value).then(key => {
    setting.value[backgroundTarget.value] = key
    showSetBackground.value = false
    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
    localUpShow.value = false
    backgroundImage.value = ''
  }).finally(() => {
    settingLoading.value = false
  })

}

function openSetBackground(target = 'background') {
  backgroundTarget.value = target
  backgroundUrl.value = setting.value[target]?.startsWith('http') ? setting.value[target] : ''
  localUpShow.value = false
  backgroundImage.value = ''
  showSetBackground.value = true
}

function openCut() {
  const doc = document.createElement('input')
  doc.setAttribute('type', 'file')
  doc.setAttribute('accept', 'image/*')
  doc.click()
  doc.onchange = async (e) => {
    backgroundFile = e.target.files[0]
    backgroundImage.value = URL.createObjectURL(e.target.files[0])
    localUpShow.value = true
  }
}

function saveR2domain() {
  const settingForm = {r2Domain: r2DomainInput.value}
  editSetting(settingForm)
}

function openBlackListForm() {
  blackFormShow.value = true
}

function openFilterForm() {
  try {
    filterRules.value = JSON.parse(setting.value.emailFilters || '[]')
  } catch (e) {
    filterRules.value = []
  }
  if (!Array.isArray(filterRules.value)) filterRules.value = []
  filterFormShow.value = true
}

function addFilterRule() {
  filterRules.value.push({field: 'from', op: 'contains', value: '', category: 'social'})
}

function saveFilters() {
  const rules = filterRules.value
    .filter(rule => String(rule.value || '').trim())
    .map(rule => ({...rule, value: String(rule.value).trim()}))
  editSetting({emailFilters: JSON.stringify(rules)}, true)
  filterFormShow.value = false
}

function openAiCodeFilter() {
  aiCodeFilterShow.value = true
}

function openSenderProviders() {
  senderProvidersShow.value = true
}

function openProviderSignup(row) {
  const url = row?.meta?.signupUrl
  if (url) window.open(url, '_blank', 'noopener')
}

function toggleProvider(row) {
  row.expanded = !row.expanded
}

/** 手填上限优先；点「恢复默认」写回目录默认值，保存后服务端按默认值计算 */
function resetProviderLimit(row, period) {
  if (period === 'day') {
    row.dailyLimit = row.defaultDailyLimit
    row.dailyLimitManual = false
  } else {
    row.monthlyLimit = row.defaultMonthlyLimit
    row.monthlyLimitManual = false
  }
  syncRowRemaining(row)
}

function onProviderLimitChange(row, period) {
  if (period === 'day') {
    row.dailyLimitManual = Number(row.dailyLimit) !== Number(row.defaultDailyLimit)
  } else {
    row.monthlyLimitManual = Number(row.monthlyLimit) !== Number(row.defaultMonthlyLimit)
  }
  syncRowRemaining(row)
}

function syncRowRemaining(row) {
  const dailyLimit = Number(row.dailyLimit) || 0
  const monthlyLimit = Number(row.monthlyLimit) || 0
  row.remaining = {
    day: Math.max(0, dailyLimit - (Number(row.usage?.day) || 0)),
    month: Math.max(0, monthlyLimit - (Number(row.usage?.month) || 0))
  }
}

function fillSenderProviderRows(data) {
  senderProvidersInfo.value = data || {adminEmail: '', hasCloudflareEmail: false}
  // 保存后重新拉取时保留用户已展开的卡片，避免每次都全部折叠
  const expandedIds = new Set(senderProviderRows.value.filter(row => row.expanded).map(row => row.id))
  senderProviderRows.value = (data?.providers || []).map(row => {
    const usage = row.usage || {day: 0, month: 0}
    const accounts = (Array.isArray(row.accounts) && row.accounts.length
      ? row.accounts
      : (row.apiKey || row.secret ? [{domain: '', apiKey: row.apiKey, secret: row.secret}] : [])
    ).map(account => ({
      domain: account.domain || '',
      apiKey: account.apiKey || '',
      secret: account.secret || '',
      testing: false
    }))
    return {
      ...row,
      accounts,
      usage,
      expanded: expandedIds.has(row.id),
      dailyLimitManual: !!row.dailyLimitManual,
      monthlyLimitManual: !!row.monthlyLimitManual,
      defaultDailyLimit: Number(row.defaultDailyLimit) || Number(row.dailyLimit) || 0,
      defaultMonthlyLimit: Number(row.defaultMonthlyLimit) || Number(row.monthlyLimit) || 0,
      remaining: row.remaining || {
        day: Math.max(0, (Number(row.dailyLimit) || 0) - (Number(usage.day) || 0)),
        month: Math.max(0, (Number(row.monthlyLimit) || 0) - (Number(usage.month) || 0))
      },
      dnsRecords: {...(row.dnsRecords || {})},
      testing: false
    }
  })
}

async function loadSenderProviders() {
  senderProvidersLoading.value = true
  try {
    fillSenderProviderRows(await senderProvidersQuery())
    await checkSenderDns()
  } catch (e) {
  } finally {
    senderProvidersLoading.value = false
  }
}

async function saveSenderProviders() {
  senderProvidersSaving.value = true
  try {
    const senderProviders = {}
    for (const row of senderProviderRows.value) {
      senderProviders[row.id] = {
        enabled: row.enabled,
        order: row.order,
        accounts: (row.accounts || []).map(account => ({
          domain: account.domain || '',
          apiKey: account.apiKey || '',
          secret: account.secret || ''
        })),
        dailyLimit: row.dailyLimit,
        monthlyLimit: row.monthlyLimit,
        dnsRecords: row.dnsRecords
      }
    }
    fillSenderProviderRows(await senderProvidersSave({senderProviders}))
    ElMessage({message: t('saveSuccessMsg'), type: 'success', plain: true})
    await checkSenderDns()
  } catch (e) {
  } finally {
    senderProvidersSaving.value = false
  }
}

const providerDomainOptions = computed(() => (settingStore.domainList || [])
  .map(domain => String(domain || '').replace(/^@/, ''))
  .filter(Boolean))

function addProviderAccount(row) {
  row.accounts.push({domain: '', apiKey: '', secret: '', testing: false})
}

function removeProviderAccount(row, index) {
  row.accounts.splice(index, 1)
}

async function testProviderAccount(row, account) {
  account.testing = true
  try {
    const data = await senderProvidersTest({provider: row.id, domain: account.domain || ''})
    ElMessage({
      message: `${data.provider || row.name} · ${account.domain || t('sendDomain')} → ${data.to}`,
      type: 'success',
      plain: true,
      duration: 6000
    })
  } catch (e) {
  } finally {
    account.testing = false
  }
}

async function testSenderProvider(row) {
  row.testing = true
  try {
    const data = await senderProvidersTest({provider: row.id})
    ElMessage({
      message: `${data.provider || row.name} · ${data.id || '-'} → ${data.to}`,
      type: 'success',
      plain: true,
      duration: 6000
    })
  } catch (e) {
  } finally {
    row.testing = false
  }
}

async function checkSenderDns() {
  senderDnsLoading.value = true
  try {
    senderDnsResult.value = await senderProvidersDns({})
  } catch (e) {
  } finally {
    senderDnsLoading.value = false
  }
}

function dnsRows(row) {
  const domain = senderDnsResult.value?.domain || ''
  const checked = senderDnsResult.value?.providers?.[row.id]?.records || []
  return (row.meta?.dnsRecords || []).map(template => {
    const key = Object.keys(row.dnsRecords || {}).find(name => name === template.name || name === `${template.name}.${domain}`) || template.name
    const fqdn = key.includes(domain) && domain ? key : (domain ? `${key}.${domain}` : key)
    const hit = checked.find(item => item.name === fqdn)
    return {key, type: template.type, status: hit?.status || 'unverified'}
  })
}

function spfStatus(row) {
  if (!row.meta?.spfInclude) return {status: 'notRequired'}
  return senderDnsResult.value?.providers?.[row.id]?.spf || {status: 'unverified'}
}

function dnsStatusKey(status) {
  return {
    ok: 'dnsOk',
    missing: 'dnsMissing',
    mismatch: 'dnsMismatch',
    error: 'dnsError',
    notRequired: 'dnsNotRequired',
    not_required: 'dnsNotRequired'
  }[status] || 'dnsUnverified'
}

function dnsStatusType(status) {
  return {
    ok: 'success',
    missing: 'warning',
    mismatch: 'danger',
    error: 'danger',
    notRequired: 'info',
    not_required: 'info'
  }[status] || 'info'
}

function backupSetting() {
  const settingForm = {...setting.value}
  delete settingForm.resendTokens
  delete settingForm.siteKey
  delete settingForm.secretKey
  backup = JSON.stringify(setting.value)
}

function beforeChange() {
  if (!settingReady.value || settingLoading.value) return false
  backupSetting()
  return true
}

function change(e) {
  if (!settingReady.value) return
  const settingForm = {...setting.value}
  delete settingForm.siteKey
  delete settingForm.secretKey
  delete settingForm.s3AccessKey
  delete settingForm.s3SecretKey
  delete settingForm.tgBotToken
  delete settingForm.resendTokens
  editSetting(settingForm, false)
}

function changeField(key, value) {
  if (!settingReady.value) return Promise.resolve(false)
  setting.value[key] = value
  if (key === 'aiSummaryMode') settingStore.settings.aiSummaryMode = value
  return editSetting({[key]: value}, false)
}

async function onAiFieldChange(key, value) {
  const saved = await changeField(key, value)
  if (saved !== false && setting.value.aiBaseUrl && setting.value.aiApiKey) {
    await fetchAiModels()
  }
}

async function classifyNow() {
  if (aiClassifyLoading.value) return
  aiClassifyLoading.value = true
  try {
    const data = await aiClassify()
    ElMessage({
      message: `已扫描 ${data.scanned} 封，更新 ${data.changed} 封分类`,
      type: 'success',
      plain: true
    })
  } catch (e) {
    ElMessage({message: e?.response?.data?.msg || e.message || 'AI 分类失败', type: 'error', plain: true})
  } finally {
    aiClassifyLoading.value = false
  }
}

async function fetchAiModels() {
  if (aiModelsLoading.value) return
  aiModelsLoading.value = true
  try {
    const data = await aiModels({baseUrl: setting.value.aiBaseUrl, apiKey: setting.value.aiApiKey})
    aiModelList.value = data.models || []
    if (aiModelList.value.length === 0) {
      ElMessage({message: '接口没有返回模型', type: 'warning', plain: true})
    } else if (!aiModelList.value.includes(setting.value.aiModel)) {
      changeField('aiModel', aiModelList.value[0])
    }
  } catch (e) {
    ElMessage({message: e?.response?.data?.msg || e.message || '拉取模型失败', type: 'error', plain: true})
  } finally {
    aiModelsLoading.value = false
  }
}

// v1.3 登录态绑定（大网站模式）：设置页把当前 GitHub/Google/LinuxDo 授权绑到当前账号
// 走 state=bind → 回调后 oauthGetUser 分支调 PUT /oauth/bind（login/index.vue 已实现）
function oauthNonce() {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `oauth_nonce=${nonce}; Path=/; SameSite=Lax${secure}`
  return nonce
}

function bindGithub() {
  const clientId = setting.value.githubClientId
  const redirectUri = encodeURIComponent(setting.value.githubCallbackUrl)
  window.location.href =
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user&state=bind-github:${oauthNonce()}`
}

function bindGoogle() {
  const clientId = setting.value.googleClientId
  const redirectUri = encodeURIComponent(setting.value.googleCallbackUrl)
  window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&state=bind-google:${oauthNonce()}`
}

function bindLinuxDo() {
  const clientId = setting.value.linuxdoClientId
  const redirectUri = encodeURIComponent(setting.value.linuxdoCallbackUrl)
  window.location.href =
      `https://connect.linux.do/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=bind-linuxdo:${oauthNonce()}`
}

function saveTitle() {
  editSetting({title: editTitle.value, subtitle: editSubtitle.value})
}

function editSetting(settingForm, refreshStatus = true) {
  if (settingLoading.value) return Promise.resolve(false)
  settingLoading.value = true

  return settingSet(settingForm).then(() => {
    settingLoading.value = false
    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
    if (setting.value.manyEmail === 1) {
      accountStore.currentAccountId = userStore.user.account.accountId;
    }
    if (refreshStatus) {
      getSettings()
    }
    editTitleShow.value = false
    r2DomainShow.value = false
    turnstileShow.value = false
    tgSettingShow.value = false
    thirdEmailShow.value = false
    forwardRulesShow.value = false
    addVerifyCountShow.value = false
    regVerifyCountShow.value = false
    noticePopupShow.value = false
    addS3Show.value = false
    emailPrefixShow.value = false
    aiCodeFilterShow.value = false
    oidcShow.value = false
    deeplShow.value = false
    return true
  }).catch((e) => {
    loginOpacity.value = setting.value.loginOpacity
    chatOpacity.value = setting.value.chatOpacity ?? 0.88
    setting.value = {...setting.value, ...JSON.parse(backup)}
    return false
  }).finally(() => {
    settingLoading.value = false
    clearS3Loading.value = false
  })
}
</script>

<style scoped lang="scss">
.settings-container {
  height: 100%;
  overflow: hidden;
  background: var(--extra-light-fill) !important;
  position: relative;

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    z-index: 2;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  .loading-show {
    transition: all 200ms ease 200ms;
    opacity: 1;
  }

  .loading-hide {
    transition: var(--loading-hide-transition);
    pointer-events: none;
    opacity: 0;
  }
}

.scroll {
  width: 100%;
  min-height: 100%;

  :deep(.el-scrollbar__view) {
    height: 100%;
  }

  .scroll-body {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
}

.card-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  gap: 20px;
  @media (max-width: 1023px) {
    gap: 15px;
    padding: 15px;
  }
}

.background {
  width: 249px;
  height: 140px;
  border-radius: 4px;
  border: 1px solid var(--light-border);
  @media (max-width: 500px) {
    width: 160px;
    height: 90px;
  }
}

.background-btn {
  display: flex;
  gap: 10px;
  flex-direction: column;
}

.bot-verify-select {
  margin-left: 10px;
}

.ai-settings-card {
  grid-column: 1 / -1;

  :deep(.setting-item > div:first-child) {
    white-space: nowrap;
  }

  :deep(.setting-item > div:last-child) {
    min-width: 0;
  }

  :deep(.el-input),
  :deep(.el-select) {
    max-width: 320px;
  }
}

.settings-card {
  background-color: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  transition: all 300ms;
  overflow: hidden;
  max-width: 900px;
  width: 100%;
}


.card-title {
  font-size: 15px;
  font-weight: bold;
  padding: 15px 20px 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.card-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  font-weight: normal;

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  > div:last-child {
    display: grid;
    grid-template-columns: 1fr auto;
    justify-items: flex-end;
    font-weight: normal;
  }
}

.ai-model-row,
.ai-classify-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;

  .el-button {
    flex: 0 0 auto;
    width: auto !important;
    min-width: 88px !important;
    padding: 0 14px !important;
    white-space: nowrap;
  }
}

.ai-setting-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-left: 2px;
}

.r2domain-item {
  display: flex;
  gap: 10px;
  > div:first-child {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  > div:last-child {
    flex: 1;
    text-align: right;
  }
}

.title-icon.warning {
  position: relative;
  top: 2px;
  cursor: pointer;
  margin-left: 2px;
}

.warning {
  margin-left: 2px;
  color: grey;
  cursor: pointer;
}

.cropper {
  border-radius: 4px;
  border: 1px solid #D4D7DE;
  height: 397px;
  width: 705px;
  @media (max-width: 767px) {
    width: calc(100vw - 60px);
    height: calc((100vw - 60px) * 9 / 16);
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
}

.notice-popup-item {
  margin-top: 15px;
}

.notice-line-item {
  margin-top: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;

  > * {
    width: 100%;
  }

  @media (max-width: 840px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 580px) {
    grid-template-columns: 1fr;
  }
}

.background-url {
  width: min(calc(100vw - 70px), 500px);
}


:deep(.el-dialog) {
  width: 400px !important;
  @media (max-width: 440px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.resend-table.el-dialog) {
  min-height: 300px;
  width: 500px !important;
  @media (max-width: 540px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.notice-popup.el-dialog) {
  min-height: 300px;
  width: 820px !important;
  @media (max-width: 860px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.resend-table .el-dialog__header) {
  padding-bottom: 5px;
}

:deep(.el-table__inner-wrapper:before) {
  background: var(--el-bg-color);
}

:deep(.cut-dialog.el-dialog) {
  width: fit-content !important;
  height: fit-content !important;
}


:deep(.oidc-dialog.el-dialog) {
  width: 640px !important;
  @media (max-width: 700px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.forward-dialog.el-dialog) {
  width: 500px !important;
  @media (max-width: 540px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

.forward-dialog {
  // 字段多的设置弹窗（OIDC）内容内部滚动，页脚保存键始终可见
  .forward-set-body {
    max-height: 62vh;
    overflow-y: auto;
    padding-right: 4px;
  }

  .forward-head {
    display: flex;
    align-items: center;

    .forward-set-title {
      top: 1px;
      padding-right: 5px;
      position: relative;
      font-size: 16px;
      font-weight: bold;;
    }
  }
}

.error-image {
  background: var(--light-ill);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cut-button {
  padding-top: 15px;
  width: 100%;
  display: flex;
  justify-content: space-between;

  .el-button {
    width: fit-content;
  }
}

.bot-verify {
  display: grid;
  grid-template-columns: 1fr auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  span {
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .el-button {
    width: 48px;
    margin: 0 0 0 10px;
  }
}

.forward-set-body {
  display: flex;
  flex-direction: column;

  .el-switch {
    align-self: end;
  }

  > *:nth-child(-n+2) {
    margin-bottom: 15px;
  }

  .tg-msg-label {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    .el-select {
      width: v-bind(tgMsgLabelWidth);
    }
  }

  .tg-bind-tip {
    margin-top: 10px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
  }

  // 设置弹窗里「标签 + 控件」的一行（Webhook / 自动清理 / OIDC 共用）
  .forward-set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .oidc-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;

    > span {
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }

  .oidc-hint {
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      word-break: break-all;
    }
  }

  .oidc-code {
    display: inline-block;
    color: var(--el-color-primary);
    word-break: break-all;
  }

  .oidc-note {
    margin-top: 16px;
    padding: 10px 12px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
  }

  .oidc-empty {
    padding: 22px 12px;
    text-align: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
    border-radius: 10px;
  }

  .oidc-item-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .oidc-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .oidc-add {
    margin-top: 12px;
    width: 100%;
  }

  :deep(.el-collapse) {
    border: none;
  }

  :deep(.el-collapse-item__header),
  :deep(.el-collapse-item__wrap) {
    background: transparent;
  }
}

.forward {
  span {
    display: flex;
    align-items: center;
  }

  .el-button {
    width: 48px;
    margin: 0 0 0 10px;
  }
}

.opt-button {
  width: fit-content !important;
}

.email-prefix {
  display: flex;
  justify-content: space-between;
}

.prefix-filter {
  display: flex;
  flex-direction: column;
}

.s3-button {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 15px;

  .el-button {
    margin-left: 0;
  }
}

.r2domain {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  .storage-type {
    margin-right: 3px;
  }

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .el-button {
    width: 48px;
    margin: 0 0 0 10px;
  }
}

.personalized {
  align-items: start;

  > div:last-child {
    display: flex;
    justify-content: end;

    .el-button {
      margin-left: 10px;
      margin-top: 0;
    }
  }
}

.dialog-input {
  margin-bottom: 15px;
}

.force-path-style {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  .force-path-style-left {
    padding-left: 2px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }
}

.concerning-item {
  display: flex;
  align-items: center;

  .community {
    display: flex;
    row-gap: 10px;
    flex-wrap: wrap;
  }

  :deep(.el-button) {
    padding: 0 10px;
    font-weight: normal;

    i {
      font-size: 22px;
    }
  }

  > span:first-child {
    font-weight: normal;
    padding-right: 20px;
    white-space: nowrap;
  }
}

.email-title {
  font-weight: normal !important;
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr auto;
  align-items: center;

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .el-button {
    margin-top: 0;
  }
}

.token-item {
  padding-top: 0;

  div:last-child {
    font-weight: normal;
  }
}

form .el-button {
  margin-top: 10px;
  width: 100%;
}

.el-switch {
  height: 28px;
}


:deep(.el-button--small) {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
  height: 24px;
}

:deep(.el-select__wrapper) {
  min-height: 28px;
}

.filter-tip {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 12px;
}

.filter-rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

@media (max-width: 640px) {
  .filter-rule-row {
    flex-wrap: wrap;
  }

  .filter-rule-row :deep(.el-input) {
    flex-basis: 100%;
  }
}

.settings-back { position:fixed; right:16px; top:72px; z-index:60; border:1px solid var(--rd-line, #e5e7eb); border-radius:999px; background:var(--rd-panel,#fff); color:var(--rd-text,#111827); padding:7px 14px; font-size:12px; font-weight:650; cursor:pointer; box-shadow:0 6px 18px rgba(15,23,42,.08); }
.settings-back:hover { background:var(--rd-panel-2,#f7f9fd); }
</style>

<style>
.el-popper.is-dark {
}

/* v12 settings: aligned label column, collapsible cards, one-column AI */
.settings-links { display:flex; gap:8px; align-items:center; justify-content:flex-end; padding:10px 24px 0; flex-wrap:wrap; }
.settings-links button { height:32px; display:inline-flex; align-items:center; gap:6px; padding:0 12px; border:1px solid var(--el-border-color); border-radius:8px; background:var(--el-bg-color); color:var(--el-text-color-primary); cursor:pointer; font-size:12px; }
.settings-links button:hover { border-color:var(--el-color-primary); color:var(--el-color-primary); }
.settings-card .card-title { cursor:pointer; display:flex; align-items:center; justify-content:space-between; }
.settings-card .card-title::after { content:'\2304'; opacity:.55; transition:transform .2s; }
.settings-card.collapsed .card-title::after { transform:rotate(-90deg); }
.settings-card.collapsed .card-content { display:none; }
.setting-item { grid-template-columns: 180px minmax(0,1fr) !important; }
/* 卡片只有一列宽，180px 标签 + 190px 下拉会互相压住；这一行改成上下排。 */
.setting-item.login-theme-item { grid-template-columns: minmax(0,1fr) !important; }
.setting-item.login-theme-item > div:last-child { grid-template-columns: minmax(0,1fr) !important; justify-items: stretch; }
.setting-item.login-theme-item :deep(.el-select) { width: 100% !important; }
.ai-settings-card {
  width: 100%;
  max-width: none;
}
.ai-settings-card .card-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.ai-settings-card .setting-item {
  grid-template-columns: 1fr !important;
  align-items: start;
}
.ai-settings-card .setting-item > div:last-child {
  justify-self: stretch !important;
  width: 100% !important;
  grid-template-columns: minmax(0, 1fr) !important;
  justify-items: stretch;
}
.ai-settings-card .setting-item input {
  width: 100% !important;
}
.ai-settings-card .el-input,
.ai-settings-card .el-select {
  width: 100% !important;
  max-width: none;
}
.ai-settings-card .ai-model-row,
.ai-settings-card .ai-classify-row {
  width: 100%;
  justify-content: flex-start;
  flex-wrap: wrap;
}
@media (max-width: 1100px) {
  .ai-settings-card .card-content { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .setting-item { grid-template-columns: 1fr !important; }
  .setting-item > div:last-child { justify-self:start; }
  .ai-settings-card { max-width: none; }
}
/* 发信渠道：内容样式。
   注意：el-dialog 会被 teleport 到 body，Vue 的 scoped 作用域不会跟进 teleport 内的 .el-dialog，
   所以 .el-dialog.provider-dialog / __body / __footer 这些外壳规则放在 styles/redesign.css 里。 */
.provider-wrap { min-width: 0; }
.provider-loading { color: #94a3b8; font-size: 12px; padding: 12px 0; }
.provider-tip { color: #64748b; font-size: 12px; margin-bottom: 10px; }
.provider-alert { margin-bottom: 12px; }
.provider-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
.provider-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f7fa;
}
.provider-stat-value { font-size: 18px; font-weight: 600; color: #1f2937; line-height: 1.2; }
.provider-stat-value i { font-style: normal; font-size: 12px; font-weight: 500; color: #94a3b8; }
.provider-stat-label { font-size: 11px; color: #64748b; line-height: 1.4; word-break: break-word; }
.provider-quota-note { color: #94a3b8; font-size: 11px; line-height: 1.5; margin-bottom: 8px; }
.provider-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; min-width: 0; }
.provider-card.is-open { border-color: #bfdbfe; }
.provider-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; cursor: pointer; }
.provider-caret {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1;
  transition: transform .15s ease;
}
.provider-caret.open { transform: rotate(90deg); }
.provider-name { font-weight: 600; }
.provider-label { color: #64748b; font-size: 12px; }
.provider-head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.provider-order { width: 90px !important; }
.provider-brief {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 8px;
  color: #475569;
  font-size: 12px;
  min-width: 0;
}
.provider-brief b { color: #1f2937; }
.provider-body { min-width: 0; }
.provider-usage { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.provider-usage-item { min-width: 0; padding: 8px; border-radius: 6px; background: #f8fafc; }
.provider-usage-text {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 10px;
  margin-bottom: 6px;
  color: #475569;
  font-size: 12px;
}
.provider-remaining b { color: #1f2937; }
.provider-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
  gap: 10px;
  margin-top: 10px;
}
.provider-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 12px; color: #64748b; }
.provider-field .el-input,
.provider-field .el-input-number { width: 100% !important; }
.provider-field-hint { color: #94a3b8; font-size: 11px; line-height: 1.4; }
.provider-limit-reset { align-self: flex-start; padding: 0; height: auto; }
.provider-field-action { justify-content: flex-end; }
.provider-accounts { margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
.provider-accounts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #475569;
  margin-bottom: 6px;
}
.provider-account-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.provider-account-row .account-domain { width: 170px; }
.provider-account-row .account-key { flex: 1 1 220px; min-width: 160px; }
.provider-account-row .account-secret { flex: 1 1 160px; min-width: 140px; }
.provider-accounts-empty { font-size: 12px; color: #94a3b8; }
.provider-note { color: #94a3b8; font-size: 12px; margin-top: 8px; line-height: 1.5; }
.provider-dns { margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
.provider-dns-title { font-size: 12px; color: #475569; margin-bottom: 6px; }
/* DNS 行改成可换行的 flex：窄屏时输入框独占一行，不会再被挤成几像素宽 */
.dns-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  min-width: 0;
}
.dns-name {
  flex: 0 1 220px;
  min-width: 120px;
  font-family: monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
  color: #334155;
}
.dns-hint { flex: 1 1 160px; min-width: 0; font-size: 12px; color: #94a3b8; }
.dns-row .el-input { flex: 1 1 220px; min-width: 0; width: auto !important; }
.dns-row .dns-status { flex: 0 0 auto; white-space: nowrap; }
.provider-check { margin-bottom: 4px; }

@media (max-width: 768px) {
  .provider-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .provider-head { align-items: flex-start; }
  .provider-head-actions { margin-left: 0; width: 100%; justify-content: space-between; }
  .provider-usage { grid-template-columns: minmax(0, 1fr); }
  .provider-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .provider-field-action { grid-column: 1 / -1; justify-content: stretch; }
  .provider-field-action .el-button { width: 100%; }
  .provider-account-row > * { flex: 1 1 100%; width: 100% !important; }
  .dns-name { flex: 1 1 100%; }
  .dns-row .el-input { flex: 1 1 100%; }
  .dns-hint { flex: 1 1 100%; }
}
</style>
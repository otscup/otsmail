<template>
  <div v-if="analysisLoading" class="analysis-loading">
    <loading/>
  </div>
  <el-scrollbar v-else style="height: 100%;">
    <div class="analysis" :key="boxKey">
      <settingsTabs/>
      <div class="number">
        <div class="number-item">
          <div class="top">
            <div class="left">
              <div>{{ $t('totalReceived') }}</div>
              <div>
                <el-statistic :formatter="value => Math.round(value)" :value="receiveData"/>
              </div>
            </div>
            <div class="right">
              <div class="count-icon">
                <Icon icon="hugeicons:mailbox-01" width="25" height="25"></Icon>
              </div>
            </div>
          </div>
          <div class="delete-ratio">
            <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalReceiveTotal }}</span></div>
            <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delReceiveTotal }}</span></div>
          </div>
        </div>
        <div class="number-item">
          <div class="top">
            <div class="left">
              <div>{{ $t('totalSent') }}</div>
              <div>
                <el-statistic :formatter="value => Math.round(value)" :value="sendData"/>
              </div>
            </div>
            <div class="right">
              <div class="count-icon">
                <Icon icon="cil:send" width="25" height="25"></Icon>
              </div>
            </div>
          </div>
          <div class="delete-ratio">
            <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalSendTotal }}</span></div>
            <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delSendTotal }}</span></div>
          </div>
        </div>
        <div class="number-item">
          <div class="top">
            <div class="left">
              <div>{{ $t('totalMailboxes') }}</div>
              <div>
                <el-statistic :formatter="value => Math.round(value)" :value="accountData"/>
              </div>
            </div>
            <div class="right">
              <div class="count-icon">
                <Icon icon="lets-icons:e-mail" width="23" height="23"></Icon>
              </div>
            </div>
          </div>
          <div class="delete-ratio">
            <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalAccountTotal }}</span></div>
            <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delAccountTotal }}</span></div>
          </div>
        </div>
        <div class="number-item">
          <div class="top">
            <div class="left">
              <div>{{ $t('totalUsers') }}</div>
              <div>
                <el-statistic :formatter="value => Math.round(value)" :value="userData"/>
              </div>
            </div>
            <div class="right">
              <div class="count-icon">
                <Icon icon="iconoir:user" width="25" height="25"></Icon>
              </div>
            </div>
          </div>
          <div class="delete-ratio">
            <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalUserTotal }}</span></div>
            <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delUserTotal }}</span></div>
          </div>
        </div>
      </div>
      <div class="infra-panel">
        <div class="infra-title">{{ $t('infra') }}</div>
        <div class="infra-grid">
          <div class="infra-item">
            <span>{{ $t('usageEmails') }}</span>
            <strong>{{ usage.emails }}</strong>
            <small>{{ $t('receivedTotal') }} {{ usage.receivedTotal }} · {{ $t('totalSent') }} {{ usage.sentTotal }}</small>
          </div>
          <div class="infra-item">
            <span>{{ $t('usageStorage') }}</span>
            <strong>{{ formatBytes(usage.attachmentBytes) }}</strong>
            <small>{{ usage.attachments }} 个附件</small>
          </div>
          <div class="infra-item">
            <span>{{ $t('usageReceived24h') }} / {{ $t('usageSent24h') }}</span>
            <strong>{{ usage.received24h }} / {{ usage.sent24h }}</strong>
            <small>{{ $t('usageFailed') }} {{ usage.failed }}</small>
          </div>
          <div class="infra-item">
            <span>{{ $t('d1Rows') }}</span>
            <strong>{{ usage.d1Rows }}</strong>
            <small>{{ $t('d1RowsDesc') }}</small>
          </div>
          <div class="infra-item">
            <span>{{ $t('doRealtime') }}</span>
            <strong>{{ usage.doEnabled ? $t('enabled') : $t('disabled') }}</strong>
            <small>{{ $t('doRealtimeDesc') }}</small>
          </div>
        </div>
      </div>
      <div class="cf-panel">
        <div class="cf-head">
          <div class="cf-title">
            <span class="cf-logo"><Icon icon="simple-icons:cloudflare" width="20" height="20"/></span>
            {{ $t('cfAccountUsage') }}
            <span class="cf-period" v-if="cfPeriodLabel">{{ cfPeriodLabel }}</span>
            <span class="cf-plan" v-if="cloudflare.plan">{{ cloudflare.plan === 'paid' ? $t('cfPaid') : $t('cfFree') }}</span>
          </div>
          <span class="cf-status" v-if="cloudflare.configured === false">{{ $t('cfNotConfigured') }}</span>
          <span class="cf-updated" v-else-if="fetchedAtText">{{ $t('cfUpdatedAt') }} {{ fetchedAtText }} · {{ $t('cfCacheHint') }}</span>
        </div>
        <div v-if="cloudflare.configured === false" class="cf-empty">
          {{ $t('cfNotConfiguredDesc') }}
        </div>
        <div v-else-if="cloudflare.error" class="cf-empty cf-error">
          {{ $t('cfRequestFailed') }}: {{ cloudflare.error }}
        </div>
        <div v-else-if="cloudflare.configured" class="cf-body">
          <div class="cf-totals">
            <div class="cf-total">
              <span class="cf-total-icon"><Icon icon="mdi:chart-line" width="18"/></span>
              <div>
                <small>{{ requestsLabel }}</small>
                <strong>{{ formatNumber(workersUsed) }}</strong>
                <em>{{ quotaText(workersUsed, workersLimit) }}</em>
              </div>
            </div>
            <div class="cf-total">
              <span class="cf-total-icon"><Icon icon="mdi:alert-circle-outline" width="18"/></span>
              <div><small>{{ errorsLabel }}</small><strong>{{ formatNumber(errorsUsed) }}</strong></div>
            </div>
            <div class="cf-total">
              <span class="cf-total-icon"><Icon icon="mdi:database-outline" width="18"/></span>
              <div>
                <small>{{ d1Label }}</small>
                <strong>{{ d1TotalUsed }}</strong>
                <em>{{ d1QuotaText }}</em>
              </div>
            </div>
            <div class="cf-total">
              <span class="cf-total-icon"><Icon icon="mdi:cloud-outline" width="18"/></span>
              <div>
                <small>{{ $t('cfR2Storage') }}</small>
                <strong>{{ cloudflare.r2 ? formatBytes(cloudflare.r2.bytes) : '—' }}</strong>
                <em>{{ r2QuotaText }}</em>
              </div>
            </div>
            <div class="cf-total">
              <span class="cf-total-icon"><Icon icon="mdi:memory" width="18"/></span>
              <div>
                <small>{{ doLabel }}</small>
                <strong>{{ doWindow ? formatNumber(doUsed) : '—' }}</strong>
                <em v-if="doWindow">{{ doQuotaText }} · {{ $t('cfDoCpu') }} {{ formatDuration(doWindow.cpuTime) }}</em>
                <em v-else-if="cloudflare.doError" class="cf-quota-error">{{ cloudflare.doError }}</em>
              </div>
            </div>
          </div>

          <div class="cf-viz-grid">
            <section class="cf-viz-card">
              <div class="cf-viz-head"><span>{{ $t('cfD1Breakdown') }}</span><small>{{ $t('cfToday') }}</small></div>
              <div v-if="cfD1Items.length" class="cf-donut-wrap">
                <div ref="cfD1El" class="cf-donut"></div>
                <div class="cf-legend">
                  <div v-for="item in cfD1Items" :key="item.key" class="cf-legend-item" :title="item.sub || item.name">
                    <i :style="{background:item.color}"></i>
                    <span class="cf-legend-name">{{ item.name }}<small v-if="item.sub">{{ item.sub }}</small></span>
                    <strong>{{ formatCompact(item.value) }}</strong>
                    <em>{{ item.shareText }}</em>
                  </div>
                </div>
              </div>
              <div v-else class="cf-viz-empty">{{ $t('cfNoData') }}</div>
            </section>

            <section class="cf-viz-card">
              <div class="cf-viz-head"><span>{{ $t('cfDoBreakdown') }}</span><small>{{ $t('cfToday') }}</small></div>
              <div v-if="cfDoItems.length" class="cf-donut-wrap">
                <div ref="cfDoEl" class="cf-donut"></div>
                <div class="cf-legend">
                  <div v-for="item in cfDoItems" :key="item.key" class="cf-legend-item" :title="item.name">
                    <i :style="{background:item.color}"></i>
                    <span class="cf-legend-name">{{ item.name }}</span>
                    <strong>{{ formatCompact(item.value) }}</strong>
                    <em>{{ item.shareText }}</em>
                  </div>
                </div>
              </div>
              <div v-else class="cf-viz-empty">{{ $t('cfNoData') }}</div>
            </section>

            <section class="cf-viz-card cf-kv-card">
              <div class="cf-viz-head"><span>{{ $t('cfKvUsage') }}</span><small>{{ $t('cfToday') }}</small></div>
              <div class="cf-kv-actions" v-if="cloudflare.kv">
                <div v-for="action in kvActions" :key="action.key">
                  <span>{{ action.label }}</span>
                  <strong>{{ formatNumber(action.used) }}</strong>
                  <em>{{ action.percentText }}</em>
                </div>
              </div>
              <div v-if="cfKvItems.length" class="cf-donut-wrap cf-kv-donut-wrap">
                <div ref="cfKvEl" class="cf-donut"></div>
                <div class="cf-legend">
                  <div v-for="item in cfKvItems" :key="item.key" class="cf-legend-item" :title="item.sub || item.name">
                    <i :style="{background:item.color}"></i>
                    <span class="cf-legend-name">{{ item.name }}<small v-if="item.sub">{{ item.sub }}</small></span>
                    <strong>{{ formatCompact(item.value) }}</strong>
                    <em>{{ item.shareText }}</em>
                  </div>
                </div>
              </div>
              <div v-else class="cf-viz-empty">{{ $t('cfNoData') }}</div>
            </section>

            <section class="cf-viz-card cf-apps-card">
              <div class="cf-viz-head"><span>{{ $t('cfApps') }}</span><small>{{ $t('cfMonthAccumulated') }}</small></div>
              <div class="cf-app-list">
                <div v-for="app in cfTopApps" :key="app.key" class="cf-app-row">
                  <span class="cf-app-icon" :class="{primary: app.otsmail}">
                    <Icon :icon="app.otsmail ? 'hugeicons:mail-01' : 'mdi:application-outline'" width="17"/>
                  </span>
                  <span class="cf-app-name" :title="app.name">{{ app.name }}</span>
                  <strong>{{ formatNumber(app.requests) }}</strong>
                  <em>{{ app.shareText }}</em>
                  <div class="cf-app-bar"><span :style="{width: app.barPct + '%'}"></span></div>
                </div>
              </div>
            </section>
          </div>
        </div>
        <div v-else class="cf-empty">{{ $t('cfLoading') }}</div>
      </div>
      <div class="picture">
        <div class="picture-item">
          <div class="title" style="display: flex;justify-content: space-between;">
            <span>{{ $t('emailSource') }}</span>
            <span class="source-button" v-if="false">
              <el-radio-group v-model="checkedSourceType">
                <el-radio-button label="发件人" value="sender"/>
                <el-radio-button label="邮箱" value="email"/>
              </el-radio-group>
            </span>
          </div>
          <div class="sender-pie">

          </div>
        </div>
        <div class="picture-item">
          <div class="title">{{ $t('userGrowth') }}</div>
          <div class="increase-line">

          </div>
        </div>
      </div>
      <div class="picture-cs">
        <div class="picture-cs-item">
          <div class="title">{{ $t('emailGrowth') }}</div>
          <div class="email-column"></div>
        </div>
        <div class="picture-cs-item">
          <div class="title">{{ $t('sentToday') }}</div>
          <div class="send-count"></div>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<script setup>
import settingsTabs from "@/components/settings-tabs/index.vue";
import {Icon} from "@iconify/vue";
import {useTransition} from "@vueuse/core";
import {defineOptions, onActivated, onDeactivated, onMounted, reactive, ref, watch, computed} from "vue";
import echarts from "@/echarts/index.js";
import dayjs from "dayjs";
import {analysisCloudflare, analysisEcharts, analysisUsage} from "@/request/analysis.js";
import {formatBytes} from "@/utils/file-utils.js";
import {useUiStore} from "@/store/ui.js";
import {debounce} from "lodash-es";
import loading from "@/components/loading/index.vue";
import {useRoute} from "vue-router";
import {useI18n} from 'vue-i18n';

defineOptions({
  name: 'analysis'
})

const {t} = useI18n();
const route = useRoute();
const uiStore = useUiStore()
const checkedSourceType = ref('sender')
const receiveTotal = ref(0)
const sendTotal = ref(0)
const accountTotal = ref(0)
const userTotal = ref(0)
const analysisLoading = ref(true)
const usage = reactive({
  emails: 0,
  receivedTotal: 0,
  sentTotal: 0,
  attachments: 0,
  attachmentBytes: 0,
  received24h: 0,
  sent24h: 0,
  failed: 0,
  d1Rows: 0,
  doEnabled: false
})

const cloudflare = reactive({
  configured: null,
  period: '',
  plan: 'free',
  limits: {},
  totalRequests: 0,
  totalErrors: 0,
  todayErrors: 0,
  workersToday: 0,
  todayApps: [],
  apps: [],
  d1: null,
  d1Today: null,
  do: null,
  doToday: null,
  doError: '',
  kv: null,
  kvError: '',
  r2: null,
  fetchedAt: '',
  error: ''
})

const CF_COLORS = ['#3CB2FF', '#13DEB9', '#FBBF24', '#FF7F50', '#BAE6FD', '#C084FC']
const cfD1El = ref(null)
const cfDoEl = ref(null)
const cfKvEl = ref(null)

const isPaid = computed(() => cloudflare.plan === 'paid')
const workersUsed = computed(() =>
  isPaid.value ? cloudflare.totalRequests : (cloudflare.workersToday || 0)
)
const errorsUsed = computed(() =>
  isPaid.value ? cloudflare.totalErrors : (cloudflare.todayErrors || 0)
)
const requestsLabel = computed(() => t(isPaid.value ? 'cfRequestsMonth' : 'cfRequestsToday'))
const errorsLabel = computed(() => t(isPaid.value ? 'cfErrorsMonth' : 'cfErrorsToday'))
const d1Label = computed(() => t(isPaid.value ? 'cfD1RowsMonth' : 'cfD1RowsToday'))
const doLabel = computed(() => t(isPaid.value ? 'cfDoRequestsMonth' : 'cfDoRequestsToday'))
const d1Window = computed(() => isPaid.value ? cloudflare.d1 : cloudflare.d1Today)
const doWindow = computed(() => isPaid.value ? cloudflare.do : cloudflare.doToday)
const errorApps = computed(() => {
  const apps = isPaid.value ? cloudflare.apps : cloudflare.todayApps;
  return (apps || []).filter(app => Number(app.errors || 0) > 0).sort((a, b) => b.errors - a.errors);
})
const fetchedAtText = computed(() => {
  if (!cloudflare.fetchedAt) return '';
  return new Date(cloudflare.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
})
const cfPeriodLabel = computed(() =>
  isPaid.value ? cloudflare.period : `${new Date().toISOString().slice(0, 10)} UTC`
)
const workersLimit = computed(() =>
  cloudflare.plan === 'paid'
    ? cloudflare.limits?.workersMonthlyRequests
    : cloudflare.limits?.workersDailyRequests
)
const d1TotalUsed = computed(() => {
  const value = cloudflare.plan === 'paid' ? cloudflare.d1 : cloudflare.d1Today
  return value ? `${formatNumber(value.rowsRead)} / ${formatNumber(value.rowsWritten)}` : '—'
})
const d1QuotaText = computed(() => {
  const value = cloudflare.plan === 'paid' ? cloudflare.d1 : cloudflare.d1Today
  const read = cloudflare.plan === 'paid'
    ? cloudflare.limits?.d1MonthlyRowsRead
    : cloudflare.limits?.d1DailyRowsRead
  const write = cloudflare.plan === 'paid'
    ? cloudflare.limits?.d1MonthlyRowsWritten
    : cloudflare.limits?.d1DailyRowsWritten
  if (!value || !read) return ''
  return `${t('cfRead')} ${formatNumber(value.rowsRead)} / ${formatNumber(read)} · ${t('cfWrite')} ${formatNumber(value.rowsWritten)} / ${formatNumber(write)}`
})
const r2QuotaText = computed(() => cloudflare.r2
  ? `${formatBytes(cloudflare.r2.bytes)} / ${formatBytes(cloudflare.limits?.r2StorageBytes || 0)}`
  : '')
const doUsed = computed(() =>
  cloudflare.plan === 'paid' ? (cloudflare.do?.requests || 0) : (cloudflare.doToday?.requests || 0)
)
const doLimit = computed(() =>
  cloudflare.plan === 'paid'
    ? cloudflare.limits?.durableObjectMonthlyRequests
    : cloudflare.limits?.durableObjectDailyRequests
)
const doQuotaText = computed(() => doLimit.value ? quotaText(doUsed.value, doLimit.value) : '')

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function quotaText(used, limit) {
  if (!limit) return ''
  return `${formatNumber(used)} / ${formatNumber(limit)}`
}

function formatDuration(microseconds) {
  const seconds = Number(microseconds || 0) / 1e6
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${(seconds / 60).toFixed(1)}min`
}

function appShare(app) {
  if (!cloudflare.totalRequests) return 0
  return Math.max(1, Math.round((app.requests / cloudflare.totalRequests) * 100))
}

function dbShare(db) {
  return Math.max(db?.share ? 1 : 0, Math.round(Number(db?.share || 0) * 100))
}

function doScriptShare(script) {
  return Math.max(script?.share ? 1 : 0, Math.round(Number(script?.share || 0) * 100))
}

function nsReadShare(ns) {
  const max = Math.max(...(cloudflare.kv?.namespaces || []).map(item => Number(item.read || 0)), 1)
  return Math.max(ns.read ? 1 : 0, Math.round((Number(ns.read || 0) / max) * 100))
}

function chartPct(value) {
  const number = Number(value || 0)
  return number <= 0 ? 2 : Math.min(100, Math.max(6, number))
}

function formatCompact(value) {
  const number = Number(value || 0)
  if (number >= 1e9) return (number / 1e9).toFixed(1).replace('.0', '') + 'B'
  if (number >= 1e6) return (number / 1e6).toFixed(1).replace('.0', '') + 'M'
  if (number >= 1e3) return (number / 1e3).toFixed(1).replace('.0', '') + 'K'
  return String(number)
}

function kvLimit(key) {
  const limit = cloudflare.limits?.[key]
  const map = { kvDailyRead: 'read', kvDailyWrite: 'write', kvDailyDelete: 'delete', kvDailyList: 'list' }
  const used = cloudflare.kv?.[map[key]] || 0
  return limit ? quotaText(used, limit) : ''
}

const kvActions = computed(() => {
  const items = [
    ['read', 'cfKvRead', 'kvDailyRead'],
    ['write', 'cfKvWrite', 'kvDailyWrite'],
    ['delete', 'cfKvDelete', 'kvDailyDelete'],
    ['list', 'cfKvList', 'kvDailyList']
  ]
  return items.map(([key, label, limitKey]) => {
    const used = Number(cloudflare.kv?.[key] || 0)
    const limit = Number(cloudflare.limits?.[limitKey] || 0)
    return { key, label: t(label), used, limit, percentText: shareText(used, limit) }
  })
})

function shareText(value, total) {
  const pct = Number(total) > 0 ? (Number(value) / Number(total)) * 100 : 0
  if (pct > 0 && pct < 0.1) return '<0.1%'
  return `${pct.toFixed(1)}%`
}

function donutItems(rows, total) {
  const list = rows.filter(row => Number(row.value || 0) > 0)
  const visible = list.slice(0, 6)
  const rest = list.slice(6)
  if (rest.length) {
    visible.push({
      key: 'other',
      name: t('cfOther'),
      value: rest.reduce((sumValue, row) => sumValue + Number(row.value || 0), 0)
    })
  }
  return visible.map((row, index) => ({
    ...row,
    color: row.key === 'other' ? '#9CA3AF' : CF_COLORS[index % CF_COLORS.length],
    shareText: shareText(row.value, total)
  }))
}

const cfD1Total = computed(() =>
  (d1Window.value?.databases || []).reduce((sumValue, db) => sumValue + Number(db.rowsRead || 0) + Number(db.rowsWritten || 0), 0))
const cfD1Items = computed(() => donutItems(
  (d1Window.value?.databases || []).map(db => ({
    key: db.databaseId,
    name: db.name || String(db.databaseId || '').slice(0, 8),
    sub: String(db.databaseId || '').slice(0, 8),
    value: Number(db.rowsRead || 0) + Number(db.rowsWritten || 0)
  })), cfD1Total.value))

const cfDoTotal = computed(() =>
  (doWindow.value?.scripts || []).reduce((sumValue, script) => sumValue + Number(script.requests || 0), 0))
const cfDoItems = computed(() => donutItems(
  (doWindow.value?.scripts || []).map(script => ({
    key: script.name,
    name: script.name,
    value: Number(script.requests || 0)
  })), cfDoTotal.value))

const cfKvTotal = computed(() =>
  (cloudflare.kv?.namespaces || []).reduce((sumValue, ns) => sumValue + Number(ns.read || 0) + Number(ns.write || 0) + Number(ns.delete || 0) + Number(ns.list || 0), 0))
const cfKvItems = computed(() => donutItems(
  (cloudflare.kv?.namespaces || []).map(ns => ({
    key: ns.namespaceId,
    name: ns.name || String(ns.namespaceId || '').slice(0, 8),
    sub: String(ns.namespaceId || '').slice(0, 8),
    value: Number(ns.read || 0) + Number(ns.write || 0) + Number(ns.delete || 0) + Number(ns.list || 0)
  })), cfKvTotal.value))

const cfTopApps = computed(() => {
  const total = Number(cloudflare.totalRequests || 0)
  const apps = (cloudflare.apps || []).slice(0, 6).map(app => ({
    ...app,
    key: app.name,
    shareText: shareText(app.requests, total),
    barPct: total ? Math.max(0.5, Math.min(100, (Number(app.requests) / total) * 100)) : 0
  }))
  const rest = (cloudflare.apps || []).slice(6)
  if (rest.length) {
    const requests = rest.reduce((sumValue, app) => sumValue + Number(app.requests || 0), 0)
    apps.push({ key: 'other', name: t('cfOther'), requests, shareText: shareText(requests, total), barPct: total ? Math.max(0.5, Math.min(100, (requests / total) * 100)) : 0 })
  }
  return apps
})

const numberCount = reactive({
  normalReceiveTotal: 0,
  normalSendTotal: 0,
  normalAccountTotal: 0,
  normalUserTotal: 0,
  delReceiveTotal: 0,
  delSendTotal: 0,
  delAccountTotal: 0,
  delUserTotal: 0
})


const receiveData = useTransition(receiveTotal, {
  duration: 1500,
})

const sendData = useTransition(sendTotal, {
  duration: 1500,
})

const accountData = useTransition(accountTotal, {
  duration: 1500,
})

const userData = useTransition(userTotal, {
  duration: 1500,
})

const senderData = ref(null)
const userLineData = reactive({
  xdata: [],
  sdata: []
})

const emailColumnData = {
  receiveData: [],
  sendData: [],
  daysData: []
}

function skinToken(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const topic = computed(() => ({
  color: uiStore.dark ? skinToken('--rd-text', '#E5EAF3') : '#303133',
  background: uiStore.dark ? skinToken('--rd-panel', '#1E0E13') : '#FFFFFF',
  borderColor: uiStore.dark ? skinToken('--rd-panel', '#1E0E13') : '#FFFFFF',
  scaleLineColor: uiStore.dark ? skinToken('--rd-line-strong', '#636466') : '#CDD0D6',
  crossColor: uiStore.dark ? skinToken('--rd-muted', '#8D9095') : '#A8ABB2',
  axisColor: uiStore.dark ? skinToken('--rd-muted', '#A3A6AD') : '#909399',
  splitLineColor: uiStore.dark ? skinToken('--rd-line', '#58585B') : '#D4D7DE',
  gaugeSplitLine: uiStore.dark ? skinToken('--rd-line-strong', '#CFD3DC') : '#606266',
  containerBackground: uiStore.dark ? skinToken('--rd-panel-2', '#6C6E72') : '#E6EBF8'
}))
let daySendTotal = 0
let leaveWidth = 0
let senderPie = null
let increaseLine = null
let emailColumn = null
let sendGauge = null
let cfD1Chart = null
let cfDoChart = null
let cfKvChart = null
let first = true
let boxKey = ref(0)
let senderPieLeft = window.innerWidth < 500 ? `${window.innerWidth - 110}` : '72%'
let analysisDark = uiStore.dark

onMounted(() => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  analysisUsage().then(data => Object.assign(usage, data)).catch(() => {})

  analysisCloudflare()
    .then(data => {
      Object.assign(cloudflare, data)
      setTimeout(initCfCharts, 0)
    })
    .catch(error => {
      cloudflare.configured = true
      cloudflare.error = error?.message || t('cfRequestFailed')
    })

  analysisEcharts(timeZone).then(data => {
    receiveTotal.value = data.numberCount.receiveTotal
    sendTotal.value = data.numberCount.sendTotal
    accountTotal.value = data.numberCount.accountTotal
    userTotal.value = data.numberCount.userTotal
    numberCount.normalReceiveTotal = data.numberCount.normalReceiveTotal
    numberCount.normalSendTotal = data.numberCount.normalSendTotal
    numberCount.normalAccountTotal = data.numberCount.normalAccountTotal
    numberCount.normalUserTotal = data.numberCount.normalUserTotal
    numberCount.delReceiveTotal = data.numberCount.delReceiveTotal
    numberCount.delSendTotal = data.numberCount.delSendTotal
    numberCount.delAccountTotal = data.numberCount.delAccountTotal
    numberCount.delUserTotal = data.numberCount.delUserTotal
    senderData.value = data.receiveRatio.nameRatio.map(item => {
      return {
        name: item.name || ' ',
        value: item.total
      }
    })

    userLineData.xdata = data.userDayCount.map(item => dayjs(item.date).format("M.D"));
    userLineData.sdata = data.userDayCount.map(item => item.total)

    emailColumnData.daysData = data.emailDayCount.receiveDayCount.map(item => dayjs(item.date).format("M.D"))
    emailColumnData.receiveData = data.emailDayCount.receiveDayCount.map(item => item.total)
    emailColumnData.sendData = data.emailDayCount.sendDayCount.map(item => item.total)
    daySendTotal = data.daySendTotal
    analysisLoading.value = false
    initPicture();
    first = false
  })

})

const widthChange = debounce(initPicture, 500, {
  leading: false,
  trailing: true
})


watch(() => uiStore.asideShow, () => {
  if (window.innerWidth > 1024) {
    widthChange()
  }
})

onActivated(() => {
  if (first) return
  if (window.innerWidth !== leaveWidth && leaveWidth !== 0) {
    widthChange()
  } else if (!senderPie) {
    widthChange()
  } else if (analysisDark !== uiStore.dark) {
    initPicture()
    analysisDark = uiStore.dark
  }
})

onDeactivated(() => {
  leaveWidth = window.innerWidth
})

window.onresize = () => {
  setStyle()
  widthChange()
}

watch(() => uiStore.dark, () => {
  if (route.name !== 'analysis') return
  analysisDark = uiStore.dark
  initPicture()
})

function initPicture() {
  if (route.name !== 'analysis') return
  boxKey.value++
  setTimeout(() => {
    createSenderPie()
    createIncreaseLine()
    createEmailColumnChart();
    createSendGauge();
    initCfCharts();
  })
}

function initCfCharts() {
  if (route.name !== 'analysis') return
  cfD1Chart = createCfDonut(cfD1El.value, cfD1Chart, cfD1Items.value, cfD1Total.value, '行')
  cfDoChart = createCfDonut(cfDoEl.value, cfDoChart, cfDoItems.value, cfDoTotal.value, '次')
  cfKvChart = createCfDonut(cfKvEl.value, cfKvChart, cfKvItems.value, cfKvTotal.value, '次')
}

function createCfDonut(el, chart, items, total, unit) {
  if (!el || !items.length) return chart
  const instance = chart || echarts.getInstanceByDom(el) || echarts.init(el)
  instance.setOption({
    color: items.map(item => item.color),
    animationDuration: 400,
    title: {
      text: formatCompact(total),
      subtext: unit,
      left: '50%',
      top: '40%',
      textAlign: 'center',
      textStyle: { color: topic.value.color, fontSize: 20, fontWeight: 700 },
      subtextStyle: { color: topic.value.axisColor, fontSize: 10 }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: topic.value.background,
      borderColor: topic.value.splitLineColor,
      textStyle: { color: topic.value.color },
      formatter: params => `${params.marker} ${params.name}<br/>${formatNumber(params.value)} · ${shareText(params.value, total)}`
    },
    series: [{
      type: 'pie',
      radius: ['55%', '75%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderColor: topic.value.background,
        borderWidth: 2,
        borderRadius: 4
      },
      label: { show: false },
      labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: items.map(item => ({ name: item.name, value: item.value }))
    }]
  }, true)
  return instance
}

function setStyle() {
  senderPieLeft = window.innerWidth < 500 ? `${window.innerWidth - 110}` : '72%'
  emailColumnData.barWidth = window.innerWidth > 767 ? '40%' : '60%'
}

const measureCtx = document.createElement('canvas').getContext('2d');
measureCtx.font = '12px sans-serif';

function truncateTextByWidth(text, maxWidth = 140) {

  let width = measureCtx.measureText(text).width;
  if (width <= maxWidth) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += text[i];
    if (measureCtx.measureText(result + '…').width > maxWidth) {
      return result.slice(0, -1) + '…';
    }
  }
  return text;
}

function createSenderPie() {

  if (senderPie) {
    senderPie.dispose()
  }
  senderPie = echarts.init(document.querySelector(".sender-pie"))
  let option = {
    tooltip: {
      trigger: 'item',
      textStyle: {
        color: topic.value.color
      },
      backgroundColor: topic.value.background,
      formatter: params => {
        return `${params.marker} ${params.name}： ${params.value} (${params.percent}%)`;
      }
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      left: '10',
      top: '20',
      textStyle: {
        color: topic.value.color
      },
      formatter: function (name) {
        return truncateTextByWidth(name)
      }
    },
    series: [
      {
        data: senderData.value,
        name: '',
        type: 'pie',
        radius: ['40%', '65%'],
        center: [senderPieLeft, '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: topic.value.borderColor,
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'outside', // 标签显示在外部
          formatter: '{d}%',  // 显示名称和占比
          color: '#333',
          fontSize: 14  // 设置字体大小
        },
        emphasis: {
          label: {
            show: false,
            fontSize: 40,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: true
        },
        color: ['#3CB2FF', '#13DEB9', '#FBBF24', '#FF7F50', '#BAE6FD', '#C084FC'] // 添加符合主题的配色
      }
    ]
  }
  senderPie.setOption(option)
}

function createIncreaseLine() {

  if (increaseLine) {
    increaseLine.dispose()
  }

  increaseLine = echarts.init(document.querySelector(".increase-line"))

  let option = {
    tooltip: {
      trigger: 'axis', // 设置触发方式为 'axis'，在坐标轴上显示信息
      axisPointer: {
        type: 'cross', // 指示器的类型为交叉型，适用于折线图等
        crossStyle: {
          color: topic.value.crossColor// 设置指示器线的颜色
        },
        lineStyle: {
          color: topic.value.crossColor         // ← 竖线颜色
        },
        axis: 'x',
      },
      formatter: function (params) {
        let result = ''
        params.forEach(item => {
          result = `${item.marker} ${t('growthTotalUsers')} ${item.value}`;
        });
        return result;
      },
      backgroundColor: topic.value.background,  // 设置背景颜色
      borderColor: topic.value.splitLineColor,      // 设置边框颜色
      borderWidth: 1,           // 设置边框宽度
      padding: 10,              // 设置内边距
      textStyle: {
        color: topic.value.color,          // 设置文字颜色
      }
    },
    grid: {
      top: '8%',
      right: '20',
      left: '35',
      bottom: '35'
    },
    xAxis: {
      type: 'category',
      data: userLineData.xdata,
      axisTick: {
        show: false,
        alignWithLabel: false,  // 刻度线与标签对齐,
        lineStyle: {
          color: topic.value.axisColor,
        }
      },
      axisPointer: {
        label: {
          show: false
        }
      },
      axisLine: {
        lineStyle: {
          color: topic.value.axisColor,
          width: 1,
          type: 'solid'
        }
      },
      axisLabel: {
        formatter: function (value, index) {
          if (index === 0) {
            return '      ' + value;
          }
          if (index === userLineData.xdata.length - 1) {
            return value + '   '
          }
          return value;
        },

      },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        margin: 5, // 增加y轴刻度数字与网格线之间的间距
      },
      boundaryGap: [0, 0.1],
      max: (params) => {
        if (params.max < 8) {
          return 10
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: topic.value.axisColor,
          width: 1,
        }
      },
      axisPointer: {
        label: {
          show: true,
          formatter: (e) => {
            return Math.round(e.value)
          }
        }
      },
      splitLine: {
        show: true, // 显示网格线
        lineStyle: {
          type: 'dashed', // 设置网格线为虚线
          color: topic.value.scaleLineColor   // 设置虚线的颜色
        }
      }
    },
    series: [
      {

        data: userLineData.sdata,
        type: 'line',
        smooth: 0.1,
        symbol: 'none',
        lineStyle: {
          color: '#1D84FF',
          width: 2.5
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: 'rgba(29, 132, 255, 0.3)'
            },
            {
              offset: 1,
              color: 'rgba(29, 132, 255, 0.03)'
            }
          ])
        },
        color: ['#1D84FF'],
      }
    ]
  };
  increaseLine.setOption(option);

  let max = increaseLine.getModel().getComponent('yAxis', 0).axis.scale.getExtent()[1];

  let left = 35

  if (max > 99) left = 42
  if (max > 999) left = 51
  if (max > 9999) left = 58
  if (max > 99999) left = 66

  increaseLine.setOption({
    grid: {
      left: left
    }
  });
}

function createEmailColumnChart() {

  if (emailColumn) {
    emailColumn.dispose()
  }

  emailColumn = echarts.init(document.querySelector(".email-column"));

  const option = {
    tooltip: {
      textStyle: {
        color: topic.value.color
      },
      backgroundColor: topic.value.background,
      formatter: function (params) {
        params.marker
        return `${params.marker} ${params.seriesName}: ${params.value}`
      }
    },
    legend: {
      data: [t('emailReceived'), t('emailSent')],
      top: '0',
      textStyle: {
        color: topic.value.color,  // 图例文字颜色
      }
    },
    grid: {
      left: '18',
      right: '18',
      bottom: '15',
      top: '50',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: emailColumnData.daysData,
      axisTick: {
        show: false,
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: topic.value.axisColor,
          width: 1,
        }
      },
    },
    yAxis: {
      max: (params) => {
        if (params.max < 8) {
          return 10
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: topic.value.splitLineColor,  // ← 横线颜色
          type: 'solid',    // dashed=虚线，solid=实线
          width: 1
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: topic.value.axisColor,
          width: 0,
        }
      },
      type: 'value',
      boundaryGap: [0, 0.1],
    },
    series: [
      {
        name: t('emailReceived'),
        type: 'bar',
        stack: 'total', // 堆叠组标识（必须相同）
        barWidth: '60%',
        barMaxWidth: 30,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.3)',
          }
        },
        data: emailColumnData.receiveData,
        itemStyle: {
          color: '#3CB2FF',
        }
      },
      {
        name: t('emailSent'),
        type: 'bar',
        stack: 'total', // 堆叠组标识（必须相同）
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.3)'
          }
        },
        data: emailColumnData.sendData,
        itemStyle: {
          color: '#13deb9',
        }
      }
    ]
  };

  emailColumn.setOption(option);
}

function createSendGauge() {
  if (sendGauge) {
    sendGauge.dispose()
  }
  sendGauge = echarts.init(document.querySelector(".send-count"));
  let option = {
    tooltip: {
      textStyle: {
        color: topic.value.color
      },
      backgroundColor: topic.value.background
    },
    series: [{
      name: t('sentToday'),
      type: 'gauge',
      max: 100,
      // 进度条颜色（新增）
      progress: {
        show: true,
        roundCap: true,
        itemStyle: {
          color: '#3CB2FF'
        }
      },
      // 指针颜色（新增）
      pointer: {
        itemStyle: {
          color: '#3CB2FF'
        }
      },
      axisLabel: {
        color: topic.value.gaugeSplitLine,
      },
      // 轴线背景色（新增）
      axisLine: {
        roundCap: true,
        lineStyle: {
          color: [[1, topic.value.containerBackground]]
        }
      },
      splitLine: {
        lineStyle: {
          color: topic.value.gaugeSplitLine, // 大刻度线颜色
        }
      },
      // 刻度颜色（新增）
      axisTick: {
        lineStyle: {
          color: topic.value.axisColor
        }
      },
      // 中心文字颜色（新增）
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color: topic.value.color // 黑色文字
      },
      data: [{
        value: daySendTotal,
        name: t('total'),
        // 名称标签颜色（新增）
        title: {
          color: topic.value.color  // 灰色标签
        }
      }]
    }],
    color: ['#3CB2FF']
  };
  sendGauge.setOption(option);
}


</script>
<style>
.percentage-value {
  display: block;
  margin-top: 10px;
  font-size: 28px;
}

.percentage-label {
  display: block;
  margin-top: 10px;
  font-size: 12px;
}
/* Cloudflare usage: compact two-column dashboard */
.cf-viz-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; align-items: start; }
.cf-viz-card { min-width: 0; padding: 14px 16px; border: 1px solid var(--el-border-color); border-radius: 14px; background: var(--el-bg-color); }
.cf-viz-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 12px; font-weight: 650; color: var(--el-text-color-primary); }
.cf-viz-head small { font-size: 10px; font-weight: 400; color: var(--el-text-color-placeholder); }
.cf-donut-wrap { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 10px; align-items: center; min-height: 190px; }
.cf-donut { width: 100%; height: 190px; min-width: 0; }
.cf-legend { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cf-legend-item { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto auto; gap: 6px; align-items: center; min-width: 0; font-size: 11px; line-height: 1.3; }
.cf-legend-item i { width: 8px; height: 8px; border-radius: 50%; }
.cf-legend-name { min-width: 0; color: var(--el-text-color-primary); overflow-wrap: anywhere; white-space: normal; }
.cf-legend-name small { display: block; margin-top: 1px; font-size: 9px; line-height: 1.2; color: var(--el-text-color-placeholder); }
.cf-legend-item strong { font-size: 11px; font-variant-numeric: tabular-nums; color: var(--el-text-color-primary); }
.cf-legend-item em { min-width: 42px; text-align: right; font-style: normal; font-size: 10px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.cf-viz-empty { display: flex; align-items: center; justify-content: center; min-height: 160px; font-size: 12px; color: var(--el-text-color-placeholder); }
.cf-kv-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 4px 0 8px; }
.cf-kv-actions > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 8px; border-radius: 8px; background: var(--el-fill-color-light); }
.cf-kv-actions span { font-size: 10px; color: var(--el-text-color-secondary); }
.cf-kv-actions strong { font-size: 15px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.cf-kv-actions em { font-style: normal; font-size: 9px; color: var(--el-text-color-placeholder); }
.cf-kv-donut-wrap { grid-template-columns: 150px minmax(0, 1fr); min-height: 170px; margin-top: 2px; }
.cf-kv-donut-wrap .cf-donut { height: 170px; }
.cf-app-list { display: flex; flex-direction: column; gap: 2px; }
.cf-app-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto 44px; gap: 7px; align-items: center; min-width: 0; padding: 4px 0 3px; border-bottom: 1px solid var(--el-border-color-lighter); }
.cf-app-row:last-child { border-bottom: 0; }
.cf-app-row .cf-app-icon { width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: var(--el-fill-color-light); }
.cf-app-row .cf-app-icon.primary { color: var(--rd-accent); background: color-mix(in srgb, var(--rd-accent) 12%, transparent); }
.cf-app-name { min-width: 0; font-size: 11px; line-height: 1.3; color: var(--el-text-color-primary); overflow-wrap: anywhere; white-space: normal; }
.cf-app-row > strong { font-size: 11px; font-variant-numeric: tabular-nums; }
.cf-app-row > em { font-style: normal; font-size: 10px; text-align: right; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.cf-app-bar { grid-column: 2 / -1; height: 3px; overflow: hidden; border-radius: 99px; background: var(--el-fill-color-light); }
.cf-app-bar span { display: block; height: 100%; border-radius: inherit; background: var(--rd-accent); }
@media (max-width: 1000px) {
  .cf-viz-grid { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .cf-viz-card { padding: 12px; }
  .cf-donut-wrap, .cf-kv-donut-wrap { grid-template-columns: 132px minmax(0, 1fr); gap: 6px; }
  .cf-donut, .cf-kv-donut-wrap .cf-donut { height: 160px; }
  .cf-kv-actions { grid-template-columns: 1fr 1fr; }
  .cf-legend-item { grid-template-columns: 7px minmax(0, 1fr) auto; }
  .cf-legend-item em { grid-column: 3; min-width: 34px; }
}

</style>
<style scoped lang="scss">
.analysis-loading {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.analysis {
  height: 100%;
  padding: 20px 20px 30px;
  gap: 20px;
  background: var(--extra-light-fill);
  display: grid;
  grid-auto-rows: min-content;
  @media (max-width: 1024px) {
    padding: 15px 15px 30px;
    gap: 15px
  }

  .title {
    margin-top: 10px;
    margin-left: 15px;
    font-size: 18px;
    font-weight: 500;
  }

  .number {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 20px;
    @media (max-width: 1366px) {
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }

    .number-item {
      background: var(--el-bg-color);
      border-radius: 8px;
      border: 1px solid var(--el-border-color);
      padding: 21px 20px;

      .top {
        display: grid;
        justify-content: space-between;
        align-content: center;
        grid-template-columns: auto auto;

        .left {
          display: grid;
          gap: 5px;
          grid-auto-rows: min-content;

          > div:first-child {
            font-size: 15px;
          }

          > div:last-child {
            font-size: 13px;
          }

          :deep(.el-statistic__number) {
            font-size: 26px;
          }
        }

        .right {
          display: grid;
          align-items: center;

          .count-icon {
            top: 3px;
            position: relative;
            display: grid;
            align-items: center;
            padding: 14px;
            border-radius: 8px;
            background: var(--el-color-primary-light-9);
            color: var(--el-color-primary);
          }
        }

      }

      .delete-ratio {
        width: 100%;
        display: grid;
        grid-template-columns:  auto auto;
        justify-content: start;
        gap: 20px;
        padding-top: 5px;
        font-size: 14px;

        .normal {
          width: fit-content;
          color: var(--el-color-success);
          font-weight: bold;;
          margin-left: 3px;
        }

        .deleted {
          width: fit-content;
          color: var(--el-color-danger);
          font-weight: bold;;
          margin-left: 3px;
        }
      }

    }
  }

  .infra-panel {
    background: var(--el-bg-color);
    border-radius: 8px;
    border: 1px solid var(--el-border-color);
    padding: 18px 20px;

    .infra-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .infra-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
      @media (max-width: 1366px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      @media (max-width: 767px) { grid-template-columns: 1fr 1fr; gap: 10px; }
    }
    .infra-item {
      display: grid;
      gap: 4px;
      min-width: 0;
      span { font-size: 12px; color: var(--el-text-color-secondary); }
      strong { font-size: 22px; line-height: 1.2; font-weight: 650; }
      small { font-size: 11px; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
    }
  }

  .cf-panel {
    background: var(--el-bg-color);
    border-radius: 8px;
    border: 1px solid var(--el-border-color);
    padding: 18px 20px;

    .cf-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .cf-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; }
    .cf-logo { display: inline-flex; color: #f48120; }
    .cf-period { font-size: 11px; font-weight: 400; color: var(--el-text-color-secondary); }
    .cf-status { font-size: 12px; color: var(--el-color-warning); }
    .cf-plan { font-size: 11px; font-weight: 500; color: var(--el-color-primary); background: var(--el-color-primary-light-9); padding: 2px 7px; border-radius: 10px; }
    .cf-empty { font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6; }
    .cf-error { color: var(--el-color-danger); }
    .cf-totals { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .cf-total { display: flex; gap: 10px; align-items: flex-start; min-width: 0; padding: 12px; border-radius: 8px; background: var(--el-fill-color-lighter); }
    .cf-total-icon { display: inline-flex; color: var(--el-color-primary); margin-top: 2px; }
    .cf-total div { display: grid; gap: 3px; min-width: 0; }
    .cf-total small { font-size: 11px; color: var(--el-text-color-secondary); }
    .cf-total strong { font-size: 19px; line-height: 1.2; overflow-wrap: anywhere; }
    .cf-total em { font-style: normal; font-size: 10px; line-height: 1.35; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
    .cf-quota-error { color: var(--el-color-danger) !important; }
    .cf-updated { font-size: 10px; color: var(--el-text-color-secondary); white-space: nowrap; }
    .cf-breakdown { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--el-border-color-lighter); }
    .cf-breakdown-title { margin-bottom: 5px; font-size: 11px; font-weight: 600; color: var(--el-text-color-secondary); }
    .cf-detail-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: baseline; gap: 10px; padding: 5px 0; border-top: 1px dashed var(--el-border-color-lighter); font-size: 11px; }
    .cf-detail-row:first-of-type { border-top: 0; }
    .cf-detail-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cf-detail-value { font-weight: 600; font-variant-numeric: tabular-nums; }
    .cf-detail-meta { color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
    .cf-chart { display: flex; align-items: flex-end; gap: 12px; overflow-x: auto; padding: 12px 2px 4px; min-height: 176px; scrollbar-width: thin; }
    .cf-chart-col { display: flex; flex: 0 0 92px; flex-direction: column; align-items: center; gap: 5px; min-width: 0; }
    .cf-chart-col > strong { font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--el-text-color-regular); }
    .cf-chart-track { display: flex; align-items: flex-end; width: 38px; height: 112px; padding: 3px; border-radius: 8px; background: var(--el-fill-color-light); }
    .cf-chart-track i { display: block; width: 100%; min-height: 3px; border-radius: 6px; background: linear-gradient(180deg, var(--el-color-primary), color-mix(in srgb, var(--el-color-primary) 58%, var(--el-bg-color))); transition: height .35s ease; }
    .cf-chart-col > span { max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 600; color: var(--el-text-color-regular); }
    .cf-chart-col > small { max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; color: var(--el-text-color-secondary); }
    .cf-kv-chart { min-height: 150px; padding-top: 8px; }
    .cf-kv-chart .cf-chart-track { height: 82px; }
    .cf-kv { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--el-border-color); }
    .cf-kv-title { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: var(--el-text-color-regular); }
    .cf-kv-title small { font-size: 10px; font-weight: 400; color: var(--el-text-color-secondary); }
    .cf-kv-totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .cf-kv-totals > div { display: grid; gap: 2px; min-width: 0; padding: 9px 10px; border-radius: 7px; background: var(--el-fill-color-lighter); }
    .cf-kv-totals span { font-size: 10px; color: var(--el-text-color-secondary); }
    .cf-kv-totals strong { font-size: 16px; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .cf-kv-totals em { font-style: normal; font-size: 9px; color: var(--el-text-color-secondary); }
    .cf-kv-ns { margin-top: 10px; }
    .cf-apps-title { margin: 16px 0 8px; font-size: 12px; color: var(--el-text-color-secondary); }
    .cf-apps-title small { margin-left: 6px; font-size: 10px; color: var(--el-text-color-placeholder); }
    .cf-apps { display: grid; gap: 6px; }
    .cf-apps.scrollable { max-height: 238px; overflow-y: auto; padding-right: 4px; }
    .cf-apps.scrollable::-webkit-scrollbar { width: 6px; }
    .cf-apps.scrollable::-webkit-scrollbar-thumb { background: var(--el-border-color); border-radius: 6px; }
    .cf-app { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto 42px; align-items: center; gap: 8px; padding: 7px 0; border-top: 1px solid var(--el-border-color-lighter); }
    .cf-app-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; color: var(--el-text-color-secondary); background: var(--el-fill-color-light); }
    .cf-app-icon.primary { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
    .cf-app-name { display: grid; gap: 1px; min-width: 0; }
    .cf-app-name strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cf-app-name small { font-size: 10px; color: var(--el-text-color-secondary); }
    .cf-app-value { font-size: 13px; }
    .cf-share { font-size: 11px; text-align: right; color: var(--el-text-color-secondary); }
    .cf-bar { grid-column: 2 / -1; height: 3px; border-radius: 3px; background: var(--el-fill-color); overflow: hidden; }
    .cf-bar span { display: block; height: 100%; border-radius: inherit; background: var(--el-color-primary); }
    @media (max-width: 1100px) { .cf-totals { grid-template-columns: 1fr 1fr; } .cf-updated { display: none; } }
    @media (max-width: 767px) { .cf-totals { grid-template-columns: 1fr; } .cf-kv-totals { grid-template-columns: 1fr 1fr; } .cf-app { grid-template-columns: 30px minmax(0, 1fr) auto; } .cf-share { display: none; } }
  }

  .picture {
    display: grid;
    grid-template-columns: 500px 1fr;
    gap: 20px;
    @media (max-width: 1620px) {
      grid-template-columns: 1fr;
    }
    @media (max-width: 1024px) {
      gap: 15px;
    }

    .picture-item {
      background: var(--el-bg-color);
      border-radius: 8px;
      border: 1px solid var(--el-border-color);

      .source-button {
        padding-right: 15px;
        display: flex;
        align-items: start;

        :deep(.el-radio-button__inner) {
          padding: 6px 10px;
        }
      }

      .sender-pie {
        height: 350px;
        @media (max-width: 767px) {
          height: 200px;
        }
      }

      .increase-line {
        height: 350px;
        @media (max-width: 767px) {
          height: 280px;
        }
      }
    }
  }

  .picture-cs {
    display: grid;
    grid-template-columns: 1fr 500px;
    gap: 20px;
    @media (max-width: 1620px) {
      grid-template-columns: 1fr;
      gap: 15px;
    }

    .picture-cs-item {
      background: var(--el-bg-color);
      border-radius: 8px;
      border: 1px solid var(--el-border-color);

      .send-count {
        height: 350px;
        @media (max-width: 767px) {
          height: 320px;
        }
      }

      .email-column {
        height: 350px;
        @media (max-width: 767px) {
          height: 250px;
        }
      }
    }
  }
}

/* Cloudflare usage: compact two-column dashboard */
.cf-viz-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; align-items: start; }
.cf-viz-card { min-width: 0; padding: 14px 16px; border: 1px solid var(--el-border-color); border-radius: 14px; background: var(--el-bg-color); }
.cf-viz-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 12px; font-weight: 650; color: var(--el-text-color-primary); }
.cf-viz-head small { font-size: 10px; font-weight: 400; color: var(--el-text-color-placeholder); }
.cf-donut-wrap { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 10px; align-items: center; min-height: 190px; }
.cf-donut { width: 100%; height: 190px; min-width: 0; }
.cf-legend { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cf-legend-item { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto auto; gap: 6px; align-items: center; min-width: 0; font-size: 11px; line-height: 1.3; }
.cf-legend-item i { width: 8px; height: 8px; border-radius: 50%; }
.cf-legend-name { min-width: 0; color: var(--el-text-color-primary); overflow-wrap: anywhere; white-space: normal; }
.cf-legend-name small { display: block; margin-top: 1px; font-size: 9px; line-height: 1.2; color: var(--el-text-color-placeholder); }
.cf-legend-item strong { font-size: 11px; font-variant-numeric: tabular-nums; color: var(--el-text-color-primary); }
.cf-legend-item em { min-width: 42px; text-align: right; font-style: normal; font-size: 10px; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.cf-viz-empty { display: flex; align-items: center; justify-content: center; min-height: 160px; font-size: 12px; color: var(--el-text-color-placeholder); }
.cf-kv-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 4px 0 8px; }
.cf-kv-actions > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 8px; border-radius: 8px; background: var(--el-fill-color-light); }
.cf-kv-actions span { font-size: 10px; color: var(--el-text-color-secondary); }
.cf-kv-actions strong { font-size: 15px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.cf-kv-actions em { font-style: normal; font-size: 9px; color: var(--el-text-color-placeholder); }
.cf-kv-donut-wrap { grid-template-columns: 150px minmax(0, 1fr); min-height: 170px; margin-top: 2px; }
.cf-kv-donut-wrap .cf-donut { height: 170px; }
.cf-app-list { display: flex; flex-direction: column; gap: 2px; }
.cf-app-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto 44px; gap: 7px; align-items: center; min-width: 0; padding: 4px 0 3px; border-bottom: 1px solid var(--el-border-color-lighter); }
.cf-app-row:last-child { border-bottom: 0; }
.cf-app-row .cf-app-icon { width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: var(--el-fill-color-light); }
.cf-app-row .cf-app-icon.primary { color: var(--rd-accent); background: color-mix(in srgb, var(--rd-accent) 12%, transparent); }
.cf-app-name { min-width: 0; font-size: 11px; line-height: 1.3; color: var(--el-text-color-primary); overflow-wrap: anywhere; white-space: normal; }
.cf-app-row > strong { font-size: 11px; font-variant-numeric: tabular-nums; }
.cf-app-row > em { font-style: normal; font-size: 10px; text-align: right; color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.cf-app-bar { grid-column: 2 / -1; height: 3px; overflow: hidden; border-radius: 99px; background: var(--el-fill-color-light); }
.cf-app-bar span { display: block; height: 100%; border-radius: inherit; background: var(--rd-accent); }
@media (max-width: 1000px) {
  .cf-viz-grid { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .cf-viz-card { padding: 12px; }
  .cf-donut-wrap, .cf-kv-donut-wrap { grid-template-columns: 132px minmax(0, 1fr); gap: 6px; }
  .cf-donut, .cf-kv-donut-wrap .cf-donut { height: 160px; }
  .cf-kv-actions { grid-template-columns: 1fr 1fr; }
  .cf-legend-item { grid-template-columns: 7px minmax(0, 1fr) auto; }
  .cf-legend-item em { grid-column: 3; min-width: 34px; }
}

</style>





















<template>
  <div class="email-container">
    <div class="mail-page-title">{{ pageTitle }}</div>
    <div class="header-actions">
      <el-checkbox
          v-model="checkAll"
          :indeterminate="isIndeterminate"
          :disabled="!emailList.length || loading"
          @change="handleCheckAllChange"
      >
      </el-checkbox>
      <div class="header-left" :style="'padding-left:' + actionLeft">

        <slot name="first"></slot>
        <Icon class="icon reload" :class="{ spinning: loading }" icon="ion:reload" width="18" height="18" @click="refresh"/>
        <Icon v-perm="'email:delete'" class="icon delete" icon="uiw:delete" width="16" height="16"
              v-if="getSelectedMailsIds().length > 0"
              @click="handleDelete"/>
        <Icon v-perm="'email:delete'" class="icon delete" icon="fluent:mail-read-20-regular" width="21" height="21"
              v-if="getSelectedMailsIds().length > 0 && showUnread"
              @click="handleRead"/>
        <el-tooltip v-if="getSelectedMailsIds().length > 0 && props.type === 'email'"
                    :content="t('markSpam')" placement="top">
          <Icon class="icon delete" icon="mdi:email-remove-outline" width="20" height="20" @click="handleSpam"/>
        </el-tooltip>
      </div>

      <div class="header-right">
        <span class="email-count" v-if="total">{{ $t('emailCount', {total: total}) }}</span>
        <div class="mail-pager" v-if="total > pageSize">
          <button type="button" class="pager-btn" :disabled="page <= 1" :title="t('prevPage')" @click="goPage(-1)">‹</button>
          <span class="pager-num">{{ page }} / {{ pageCount }}</span>
          <button type="button" class="pager-btn" :disabled="page >= pageCount" :title="t('nextPage')" @click="goPage(1)">›</button>
        </div>
      </div>
    </div>

    <div v-if="showCategories" class="mail-categories" role="tablist">
      <button v-for="item in categories" :key="item.key" type="button" role="tab"
              class="mail-category" :class="{active: activeCategory === item.key}"
              :aria-selected="activeCategory === item.key" @click="selectCategory(item.key)">
        <Icon :icon="item.icon" width="16" height="16"/>
        <span>{{ t(item.label) }}</span>
        <span v-if="categoryCounts[item.key]" class="mail-category-count">{{ categoryCounts[item.key] }}</span>
      </button>
    </div>

    <div ref="scroll" class="scroll">
      <UseVirtualList ref="scrollbarRef"
                        @scroll="onScroll"
                        :list="list"
                        :options="{ itemHeight: itemHeight, overscan: 15 }"
                        class="virtual"
                        style="height: 100%"
                        v-if="!loading && emailList.length > 0"
                        :key="keyCount"
        >
          <template #default="{ data: item, index }" >
            <div :class="['email-row', props.type, { 'is-unread': item.unread === EmailUnreadEnum.UNREAD && showUnread }]"
                 :data-checked="item.checked"
                 @click="jumpDetails(item)"
                 v-if="!item.expand"
                 :key="item.emailId"
                 @contextmenu="handleContextmenu($event, item)"
                 :style="item.rightChecked ? 'background: #FDF6EC' : ''"
            >
              <el-checkbox :class=" props.type === 'all-email' ? 'all-email-checkbox' : 'checkbox'"
                           v-model="item.checked"
                           :disabled="!item.checked && isSelectMax"
                           @click.stop></el-checkbox>
              <div @click.stop="starChange(item)" class="pc-star" v-if="showStar">
                <Icon v-if="item.isStar" icon="fluent-color:star-16" width="20" height="20"/>
                <Icon v-else icon="solar:star-line-duotone" width="18" height="18"/>
              </div>
              <div v-if="!showStar"></div>
              <div class="title" :class="accountShow ? 'title-column' : 'title-column'">

                <div class="email-sender" :style="showStatus ? 'gap: 10px;' : ''">
                  <div class="email-status" v-if="showStatus">
                    <el-tooltip effect="dark" :content="item.statusIcon.content">
                      <Icon :icon="item.statusIcon.icon" :style="`color: ${item.statusIcon.color}`" width="20" height="20"/>
                    </el-tooltip>
                    <div class="del-status" v-if="item.isDel">
                      <el-tooltip effect="dark" :content="item.isDelContent">
                        <Icon class="icon" icon="mdi:email-remove" width="20" height="20"/>
                      </el-tooltip>
                    </div>
                  </div>
                  <div v-else></div>
                  <span class="name">
                    <span>
                      <div class="unread" v-if="isMobile && (item.unread === EmailUnreadEnum.UNREAD && showUnread) "/>
                      <slot name="name" :email="item"> {{ item.name }}</slot>
                    </span>
                    <span>
                      <Icon v-if="item.isStar" icon="fluent-color:star-16" width="18" height="18"/>
                    </span>
                  </span>
                  <span class="phone-time">{{ item.formatCreateTime }}</span>
                </div>
                <div>
                  <div class="email-text">
                    <span class="email-subject">
                      <div class="unread" v-if="!isMobile && (item.unread === EmailUnreadEnum.UNREAD && showUnread) "/>
                      <span v-if="item.code" class="code-tag" @click.stop="copyCode(item.code)">[{{ t('codeLabel') }}{{ item.code }}]</span>
                      <span class="subject-text">
                        <slot name="subject" :email="item" >
                          <span v-html="highlightText(item.subject || '\u200B')"></span>
                        </slot>
                      </span>
                      <span v-if="categoryLabel(item.spam ? 'spam' : item.category)" class="mail-category-tag">{{ categoryLabel(item.spam ? 'spam' : item.category) }}</span>
                    </span>
                    <span class="email-content" v-html="highlightText(item.formatText || '\u200B')"></span>
                  </div>
                  <div class="user-info" v-if="showUserInfo">
                    <div class="user">
                      <span>
                        <Icon icon="mynaui:user" width="20" height="20"/>
                      </span>
                      <span>{{ item.userEmail }}</span>
                    </div>
                    <div class="account">
                      <span>
                        <Icon icon="mdi-light:email" width="20" height="20"/>
                      </span>
                      <span>{{ item.type === 0 ? item.toEmail : item.sendEmail }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="email-right" :style="showUserInfo ? 'align-self: start;':''">
                <div v-if="!isMobile" class="email-actions">
                  <button type="button" class="email-action" :title="t('delete')" @click.stop="rightDelete(item.emailId)">
                    <Icon icon="fluent:delete-20-regular" width="16" height="16"/>
                  </button>
                  <button type="button" class="email-action" :class="{disabled: item.unread !== EmailUnreadEnum.UNREAD}" :title="t('markAsRead')" @click.stop="markRead(item)">
                    <Icon icon="fluent:mail-read-20-regular" width="16" height="16"/>
                  </button>
                  <button type="button" class="email-action" :class="{disabled: item.unread === EmailUnreadEnum.UNREAD}" :title="t('markAsUnread')" @click.stop="markUnread(item)">
                    <Icon icon="fluent:mail-unread-20-regular" width="16" height="16"/>
                  </button>
                </div>
                <span class="email-time" :style="(item.unread === EmailUnreadEnum.UNREAD && showUnread) ? 'font-weight: bold' : ''">{{ item.formatCreateTime }}</span>
              </div>
            </div>
            <skeletonBlock v-else-if="item.expand === 'loading'"
                           :rows="1"
                           :showStar="showStar"
                           :accountShow="accountShow"
                           :showStatus="showStatus"
                           :showUserInfo="showUserInfo"
                           :type="type"/>
            <div class="noLoading" v-else-if="item.expand === 'noMoreData'">
              <div>{{ $t('noMoreData') }}</div>
            </div>
          </template>
        </UseVirtualList>
      <skeletonBlock v-if="firstLoad && showFirstLoading"
                       :rows="20"
                       :showStar="showStar"
                       :accountShow="accountShow"
                       :showStatus="showStatus"
                       :showUserInfo="showUserInfo"
                       :type="type"/>
      <skeletonBlock v-if="loading"
                       :rows="skeletonRows"
                       :showStar="showStar"
                       :accountShow="accountShow"
                       :showStatus="showStatus"
                       :showUserInfo="showUserInfo"
                       :type="type"/>
      <div class="empty" v-if="noLoading && emailList.length === 0 && !loading">
        <el-empty :image-size="isMobile ? 120 : null" :description="$t('noMessagesFound')"/>
      </div>
      <div class="mail-list-footer" v-if="total">{{ $t('emailCount', {total}) }}</div>
    </div>
    <el-dropdown
        ref="dropdownRef"
        @visible-change="visibleChange"
        :virtual-ref="triggerRef"
        :show-arrow="false"
        :popper-options="{
      modifiers: [{ name: 'offset', options: { offset: [0, 0] } }],
    }"
        virtual-triggering
        trigger="contextmenu"
        placement="bottom-start"
    >
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="rightClickEmail.code" @click="copyCode(rightClickEmail.code)" >
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="fluent-color:clipboard-24" width="20" height="20" />
                <span>{{t('copyCode')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','star','all-email'].includes(props.type)" @click="toggleRead(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon :icon="rightClickEmail.unread === EmailUnreadEnum.UNREAD ? 'fluent:mail-read-20-regular' : 'fluent:mail-unread-20-regular'" width="20" height="20" />
                <span>{{ rightClickEmail.unread === EmailUnreadEnum.UNREAD ? t('markAsRead') : t('markAsUnread') }}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','star'].includes(props.type)" @click="openReply(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="la:reply" width="20" height="20"  />
                <span>{{t('reply')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','send', 'star'].includes(props.type)" @click="openForward(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:arrow-up-right" width="19" height="19"  />
                <span>{{t('forward')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','send', 'star'].includes(props.type)" @click="starChange(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="solar:star-line-duotone" width="19" height="19"/>
                <span>{{t('star')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','star'].includes(props.type)" @click="toggleSpam(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="mdi:email-remove-outline" width="20" height="20"/>
                <span>{{ rightClickEmail.spam ? t('unmarkSpam') : t('markSpam') }}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="['email','star'].includes(props.type) && rightClickEmail.sendEmail" @click="addContact(rightClickEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="mdi:account-plus-outline" width="20" height="20"/>
                <span>{{ t('contactAddQuick') }}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="props.type === 'all-email'" @click="handleSearch('user', rightClickEmail.userEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:search" width="20" height="20" />
                <span>{{t('searchUser')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="props.type === 'all-email' " @click="handleSearch('account', rightClickEmail.toEmail)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:search" width="20" height="20" />
                <span>{{t('searchEmail')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item v-if="props.type === 'all-email' " @click="handleSearch('name', rightClickEmail.name)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="iconoir:search" width="20" height="20" />
                <span>{{t('searchSender')}}</span>
              </div>
            </template>
          </el-dropdown-item>
          <el-dropdown-item @click="rightDelete(rightClickEmail.emailId)">
            <template #default>
              <div class="right-dropdown-item">
                <Icon icon="uiw:delete" width="16" height="20" style="margin-left: 1px;margin-right: 3px" />
                <span>{{t('delete')}}</span>
              </div>
            </template>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import {Icon} from "@iconify/vue";
import skeletonBlock from "@/components/email-scroll/skeleton/index.vue"
import {computed, onActivated, reactive, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import {useEmailStore} from "@/store/email.js";
import {emailSpam, emailSpamCancel, emailCategoryCounts} from "@/request/email.js";
import {contactAdd} from "@/request/contact.js";
import {useUiStore} from "@/store/ui.js";
import {useSettingStore} from "@/store/setting.js";
import {sleep} from "@/utils/time-utils.js"
import {fromNow} from "@/utils/day.js";
import {useI18n} from "vue-i18n";
import {useRoute} from "vue-router";
import {EmailUnreadEnum} from "@/enums/email-enum.js";
import { UseVirtualList } from '@vueuse/components'
import { useScroll } from '@vueuse/core'

const props = defineProps({
  getEmailList: Function,
  emailDelete: Function,
  emailRead: Function,
  emailUnread: Function,
  starAdd: Function,
  starCancel: Function,
  cancelSuccess: Function,
  starSuccess: Function,
  actionLeft: {
    type: String,
    default: '0'
  },
  timeSort: {
    type: Number,
    default: 0,
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  showAccountIcon: {
    type: Boolean,
    default: true,
  },
  showUserInfo: {
    type: Boolean,
    default: false
  },
  showStar: {
    type: Boolean,
    default: true
  },
  allowStar: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    default: 'email'
  },
  showFirstLoading: {
    type: Boolean,
    default: true
  },
  showUnread: {
    type: Boolean,
    default: false
  },
  showSearch: {
    type: Boolean,
    default: false
  },
  showCategories: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['jump', 'refresh-before', 'delete-draft', 'right-search'])
const {t} = useI18n()
const settingStore = useSettingStore()
const uiStore = useUiStore();
const emailStore = useEmailStore();
const loading = ref(false);
const followLoading = ref(false);
const noLoading = ref(false);
const emailList = reactive([])
const expandList = reactive([])
const total = ref(0);
const pageSize = 50;
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const checkAll = ref(false);
const isIndeterminate = ref(false);
const scroll = ref(null)
const firstLoad = ref(true)
let scrollTop = 0
const latestEmail = ref(null)
const scrollbarRef = ref(null)
let reqLock = false
let isMobile = ref(innerWidth < 1367)
let skeletonRows = 0
const timePaddingRight = ref('');
const keyCount = ref(0);
const dropdownRef = ref(null);
const dropdownCloseLock = ref(false);
const dropdownShow = ref(false);
const rightClickEmail = ref({});
const MAX_SELECT_COUNT = 95;
const checkedEmailCount = ref(0);
const isSelectMax = computed(() => checkedEmailCount.value >= MAX_SELECT_COUNT);
const route = useRoute()
const pageTitle = computed(() => {
  if (activeCategory.value !== 'primary') return categoryLabel(activeCategory.value)
  return t(route.meta?.title || 'inbox')
})
const activeCategory = ref('primary')
const categoryCounts = reactive({primary: 0, social: 0, promotion: 0, updates: 0, ads: 0, spam: 0})
const categories = [
  {key: 'primary', label: 'categoryPrimary', icon: 'mdi:inbox-outline'},
  {key: 'social', label: 'categorySocial', icon: 'mdi:account-group-outline'},
  {key: 'promotion', label: 'categoryPromotion', icon: 'mdi:tag-outline'},
  {key: 'updates', label: 'categoryUpdates', icon: 'mdi:bell-outline'},
  {key: 'ads', label: 'categoryAds', icon: 'mdi:bullhorn-outline'},
  {key: 'spam', label: 'categorySpam', icon: 'mdi:alert-octagon-outline'}
]

function categoryLabel(category) {
  return t(categories.find(item => item.key === category)?.label || 'categoryPrimary')
}

function selectCategory(category) {
  if (activeCategory.value === category) return
  activeCategory.value = category
  page.value = 1
  refreshList()
}

function loadCategoryCounts() {
  if (!props.showCategories) return Promise.resolve()
  return emailCategoryCounts().then(data => {
    Object.assign(categoryCounts, data)
    window.dispatchEvent(new CustomEvent('otsmail:counts'))
  }).catch(() => {})
}
let timer = null
const position = ref(
    DOMRect.fromRect({
      x: 0,
      y: 0,
    })
)

const triggerRef = ref({
  getBoundingClientRect() {
    return position.value;
  }
})

const queryParam = reactive({
  size: 50
});

const ESCAPE_MAP = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
function highlightText(value) {
  const text = String(value ?? '');
  const query = String(emailStore.searchParams?.text || '').trim();
  if (!query) return text.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch]);
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch])
      .replace(new RegExp(pattern, 'gi'), '<mark class="search-hit">$&</mark>');
}

defineExpose({
  refreshList,
  deleteEmail,
  addItem,
  handleList,
  emailList,
  firstLoad,
  latestEmail,
  noLoading,
  total,
  activeCategory,
  loadCategoryCounts
})

onActivated(() => {
  requestAnimationFrame(() => {
    const index = scrollTop / itemHeight.value
    scrollbarRef.value?.scrollTo(index);
  })
})

onMounted(() => {
  timer = setInterval(() => {
    emailList.forEach(email => {
      email.formatCreateTime = fromNow(email.createTime);
    })
  }, 1000 * 60);
})

onUnmounted(() => {
  clearInterval(timer)
})

getEmailList()
loadCategoryCounts()

window.onresize = () => {
  isMobile.value = innerWidth < 1367
}

function onScroll(e) {
  scrollTop = e.target.scrollTop;
}

const { arrivedState } = useScroll(scrollbarRef, {
  offset: { bottom: 1200 }
})


const list = computed(() => {
  return [...emailList, ...expandList]
})

const itemHeight = computed(() => {
    if (props.type === 'all-email') {
      return isMobile.value ? 132 : 65;
    } else  {
      return isMobile.value ? 64 : 44;
    }
})

watch(emailList, () => {
  updateHasScrollbar();
})

watch(scrollbarRef, () => {
  updateHasScrollbar();
})

// 寮哄埗鍒锋柊 (itemHeight 鏇存敼鍚庤櫄鎷熸粴鍔ㄥ垪琛ㄤ笉浼氳嚜宸辨洿鏂?
watch(itemHeight, () => {
  keyCount.value ++
})

watch(followLoading, (isFollowLoading) => {
  if (isFollowLoading) {
    expandList.push({
      emailId: 0,
      expand: 'loading'
    })
  } else {
    const index = expandList.findIndex(item => item.expand === 'loading')
    expandList.splice(index, 1);
  }
});

watch(noLoading, (isNoLoading) => {
  if (isNoLoading) {
    expandList.push({
      emailId: 0,
      expand: 'noMoreData'
    })
  } else {
    const index = expandList.findIndex(item => item.expand === 'noMoreData')
    expandList.splice(index, 1);
  }
})


// 姣忛〉鍥哄畾 50 灏侊紝搴曢儴涓嶅啀瑙﹀彂鏃犻檺鍔犺浇

watch(
    () => emailList.map(item => item.checked),
    () => {
      checkedEmailCount.value = emailList.length
      if (emailList.length > 0) {
        updateCheckStatus();
      }
    },
    {deep: true}
);


watch(() => emailStore.deleteIds, () => {
  if (emailStore.deleteIds) {
    deleteEmail(emailStore.deleteIds)
  }
})

watch(() => emailStore.cancelStarEmailId, () => {
  emailList.forEach(email => {
    if (email.emailId === emailStore.cancelStarEmailId) {
      email.isStar = 0
    }
  })
})

watch(() => emailStore.addStarEmailId, () => {
  emailList.forEach(email => {
    if (email.emailId === emailStore.addStarEmailId) {
      email.isStar = 1
    }
  })
})

window.addEventListener('wheel', (event) => {
  if (dropdownShow.value) {
    dropdownRef.value.handleClose();
  }
})

function openReply(email) {
  uiStore.writerRef.openReply(email)
}

function openForward(email) {
  uiStore.writerRef.openForward(email)
}

function visibleChange(e) {
  dropdownShow.value = e;
  dropdownCloseLock.value = true;
  setTimeout(() => {
    dropdownCloseLock.value = false;
  },1500)

  if (!e && rightClickEmail.value.rightChecked) {
    rightClickEmail.value.rightChecked = false
  }
}

const handleContextmenu = (event, email) => {

  if (props.type === 'draft') {
    return
  }

  if (rightClickEmail.value.rightChecked) {
    rightClickEmail.value.rightChecked = false
  }

  const { clientX, clientY } = event
  position.value = DOMRect.fromRect({
    x: clientX,
    y: clientY,
  })
  event.preventDefault();
  dropdownRef.value?.handleOpen();

  rightClickEmail.value = email;
  rightClickEmail.value.rightChecked = true
}

function updateHasScrollbar() {
  nextTick(() => {
    const doc = document.querySelector('.virtual');
    if (doc) {
      if (doc.scrollHeight > doc.clientHeight) {
        timePaddingRight.value = '5px';
      } else {
        timePaddingRight.value = '15px'
      }
    }
  })
}

function getSkeletonRows() {
  if (emailList.length > 20) return skeletonRows = 20
  if (emailList.length === 0) return skeletonRows = 1
  skeletonRows = emailList.length
}

const accountShow = computed(() => {
  return uiStore.accountShow && settingStore.settings.manyEmail === 0
})

function htmlToText(email) {
  if (email.content) {

    const tempDiv = document.createElement('div');

    tempDiv.innerHTML = email.content.replace(
        /<(img|iframe|object|embed|video|audio|source|link)[^>]*>/gi, ''
    );

    const scriptsAndStyles = tempDiv.querySelectorAll('script, style, title');
    scriptsAndStyles.forEach(el => el.remove());
    let text = tempDiv.textContent || tempDiv.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    return cleanSpace(text)
  }

  if (email.text) {
    return cleanSpace(email.text)
  } else {
    return ''
  }

}

function cleanSpace(text) {
  return text
      .replace(/[\u200B-\u200F\uFEFF\u034F\u200B-\u200F\u00A0\u3000\u00AD]/g, '')// 绉婚櫎闆跺绌烘牸
      .replace(/\s+/g, ' ')                   // 澶氱┖鐧藉悎骞舵垚涓€涓┖鏍?
      .trim();
}

function starChange(email) {

  if (!email.isStar) {

    if (!props.allowStar) return;

    email.isStar = 1;
    props.starAdd(email.emailId).then(() => {
      email.isStar = 1;
      props.starSuccess(email)
    }).catch(e => {
      console.error(e)
      email.isStar = 0
    })
  } else {

    email.isStar = 0;
    props.starCancel(email.emailId).then(() => {
      email.isStar = 0;
      props.cancelSuccess?.(email)
    }).catch(e => {
      console.error(e)
      email.isStar = 1;
    })
  }
}

const handleRead = async () => {
  const emailIds = getSelectedMailsIds();
  try {
    await props.emailRead(emailIds);
    localRead(emailIds);
    await loadCategoryCounts();
  } catch (e) {
    await loadCategoryCounts();
  }
}

function emailRead(emailId) {
  props.emailRead([emailId])
  localRead([emailId]);
}

async function setReadState(email, unread) {
  if (email.unread === unread) return
  const request = unread === EmailUnreadEnum.UNREAD ? props.emailUnread : props.emailRead
  if (!request) return
  try {
    await request([email.emailId])
    email.unread = unread
    email.checked = false
    await loadCategoryCounts()
  } catch (e) {
    // 澶辫触鏃朵互鏈嶅姟绔鏁颁负鍑嗭紝閬垮厤瑙掓爣琚湰鍦颁箰瑙傛洿鏂版姮楂?
    await loadCategoryCounts()
  }
}

function toggleRead(email) {
  return setReadState(email, email.unread === EmailUnreadEnum.UNREAD ? EmailUnreadEnum.READ : EmailUnreadEnum.UNREAD)
}

function markRead(email) {
  return setReadState(email, EmailUnreadEnum.READ)
}

function markUnread(email) {
  return setReadState(email, EmailUnreadEnum.UNREAD)
}

function localRead(emailIds) {
  emailIds.forEach(emailId => {
    const index = emailList.findIndex(email => email.emailId === emailId);
    if (index > -1) {
      if (emailList[index].unread === EmailUnreadEnum.UNREAD) {
        bumpCategory(emailList[index], -1)
      }
      emailList[index].unread = EmailUnreadEnum.READ;
      emailList[index].checked = false;
    }
  })
}

function bumpCategory(email, delta) {
  const key = email.spam ? 'spam' : email.category;
  if (key in categoryCounts) {
    categoryCounts[key] = Math.max(0, categoryCounts[key] + delta)
  }
}

function rightDelete(emailId) {

  if (props.type === 'all-email') {
    ElMessageBox.confirm(t('delOneEmailConfirm'), {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning'
    }).then(() => {
      props.emailDelete([emailId]).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true
        })
        emailStore.deleteIds = [emailId];
      })
    })
    return;
  }
  props.emailDelete([emailId]).then(() => {
    ElMessage({
      message: t('delSuccessMsg'),
      type: 'success',
      plain: true
    })
    emailStore.deleteIds = [emailId];
  })
}

function handleSearch(type, value) {
  emit('right-search', type, value);
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true
    })
  }
}

function handleDelete() {
  ElMessageBox.confirm(t('delEmailsConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {

    if (props.type === 'draft') {
      const draftIds = getSelectedDraftsIds();
      emit('delete-draft', draftIds);
      return;
    }

    const emailIds = getSelectedMailsIds();
    props.emailDelete(emailIds).then(() => {
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true
      })
      emailStore.deleteIds = emailIds;
    })
  })
}

function deleteEmail(emailIds) {
  emailIds.forEach(emailId => {
    emailList.forEach((item, index) => {
      if (emailId === item.emailId) {
        emailList.splice(index, 1);
      }
    })
  })
  if (emailList.length < queryParam.size && !noLoading.value) {
    getEmailList()
  }
}

function addItem(email) {

  const existIndex = emailList.findIndex(item => item.emailId === email.emailId)

  if (existIndex > -1) {
    return false;
  }

  email.formatText = htmlToText(email);
  email.formatCreateTime = fromNow(email.formatCreateTime);

  if (props.timeSort) {
    if (noLoading.value) {
      handleList([email]);
      emailList.push(email);
    }

    if (email.emailId > latestEmail.value?.emailId) {
      latestEmail.value = email
    }

    total.value++
    return true;
  }


  const index = emailList.findIndex(item => item.emailId < email.emailId)

  if (index !== -1) {
    handleList([email]);
    emailList.splice(index, 0, email);
  } else {
    if (noLoading.value) {
      handleList([email]);
      emailList.push(email);
    }
  }

  if (email.emailId > latestEmail.value?.emailId) {
    latestEmail.value = email
  }

  total.value++
  return true;
}

function handleCheckAllChange(val) {
  if (val) {
    let count = 0;
    emailList.forEach(item => {
      if (count < MAX_SELECT_COUNT) {
        item.checked = true;
        count++;
      } else {
        item.checked = false;
      }
    });
  } else {
    emailList.forEach(item => item.checked = false);
  }
  isIndeterminate.value = false;
}

// 鑾峰彇閫変腑鐨勯偖浠跺垪琛╥d
function getSelectedMailsIds() {
  return emailList.filter(item => item.checked).map(item => item.emailId);
}

function getSelectedDraftsIds() {
  return emailList.filter(item => item.checked).map(item => item.draftId);
}

function updateCheckStatus() {
  const checkedCount = emailList.filter(item => item.checked).length;
  checkedEmailCount.value = checkedCount;
  const atMax = checkedCount >= MAX_SELECT_COUNT;
  checkAll.value = emailList.length > 0 && (checkedCount === emailList.length || atMax);
  isIndeterminate.value = checkedCount > 0 && !checkAll.value;
}

function jumpDetails(email) {

  if (dropdownShow.value) {
    dropdownRef.value.handleClose();
    return;
  }

  if (!dropdownCloseLock.value) {
    const sel = window.getSelection();
    if (sel.toString().trim()) {
      return
    }
  }
  emit('jump', email)
}


function getEmailList() {

  if (reqLock) return;

  reqLock = true
  loading.value = true
  firstLoad.value = true
  scrollTop = 0

  props.getEmailList(0, queryParam.size, activeCategory.value, page.value).then(async data => {
    firstLoad.value = false
    const list = (data.list || []).map(item => ({...item, checked: false}))

    latestEmail.value = data.latestEmail
    emailList.length = 0
    handleList(list)
    emailList.push(...list)
    loadCategoryCounts()

    total.value = Number(data.total) || 0
    if (page.value > pageCount.value) {
      page.value = pageCount.value
    }
    nextTick(() => scrollbarRef.value?.setScrollTop(0))
    noLoading.value = false
    followLoading.value = false
  }).finally(() => {
    loading.value = false
    reqLock = false
  })
}

function goPage(delta) {
  const next = page.value + delta
  if (next < 1 || next > pageCount.value) return
  page.value = next
  refreshList()
}

function handleList(list) {
  list.forEach(email => {
    email.formatText = htmlToText(email)
    email.formatCreateTime = fromNow(email.createTime);
    email.test = t('received')
    const statusIconMap = {
      0: { icon: 'ic:round-mark-email-read', color: '#51C76B', content: t('received') },
      1: { icon: 'bi:send-arrow-up-fill',  color: '#51C76B', content: t('sent') },
      2: { icon: 'bi:send-check-fill',     color: '#51C76B', content: t('delivered') },
      3: { icon: 'bi:send-x-fill',         color: '#F56C6C', content: t('bounced') },
      8: { icon: 'bi:send-x-fill',         color: '#F56C6C', content: t('bounced') },
      4: { icon: 'bi:send-exclamation-fill', color: '#FBBD08', content: t('complained') },
      5: { icon: 'bi:send-arrow-up-fill',  color: '#FBBD08', content: t('delayed') },
      7: { icon: 'ic:round-mark-email-read', color: '#FBBD08', content: t('noRecipient') },
    };

    if (email.isDel) {
      email.isDelContent = t('selectDeleted');
    }
    email.statusIcon = statusIconMap[email.status];
  })
}

async function handleSpam() {
  const ids = getSelectedMailsIds()
  if (ids.length === 0) return
  await Promise.all(ids.map(id => emailSpam(id)))
  ElMessage({message: t('markSpam'), type: 'success', plain: true})
  refresh()
}

async function toggleSpam(email) {
  if (!email?.emailId) return
  const target = email.spam ? 0 : 1
  await (target ? emailSpam : emailSpamCancel)(email.emailId)
  ElMessage({message: t(target ? 'markSpam' : 'unmarkSpam'), type: 'success', plain: true})
  refresh()
}

async function addContact(email) {
  if (!email?.sendEmail) return
  await contactAdd({
    name: email.name || '',
    email: email.sendEmail,
    groupName: '榛樿',
    remark: ''
  })
  ElMessage({message: t('contactAddSuccess'), type: 'success', plain: true})
}

function refresh() {
  emit('refresh-before')
  if (props.skeleton) {
    scrollbarRef.value.setScrollTop(0)
  }
  refreshList()
}

function refreshList() {
  checkAll.value = false;
  isIndeterminate.value = false;
  getEmailList(true);
}

function loadData() {
  getEmailList()
}

</script>
<style lang="scss" scoped>

.email-container {
  display: flex;
  flex-direction: column;
  padding: 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  height: 100%;
}

.scroll {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  height: 100%;
  overflow: hidden;

  .virtual {
    will-change: scroll-position;
  }

  .empty {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
  }

  .noLoading {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px 0 0 0;
    color: var(--secondary-text-color);
  }

  .follow-loading {
    height: 60px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--loadding-background);
    height: 100%;
    width: 100%;
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
  }

  .loading-show {
    transition: all 200ms ease 200ms;
    opacity: 1;
  }

  .loading-hide {
    pointer-events: none;
    transition: var(--loading-hide-transition);
    opacity: 0;
  }
}

:deep(.email-row) {
  display: flex;
  padding: 8px 0;
  justify-content: space-between;
  box-shadow: var(--header-actions-border);
  cursor: pointer;
  align-items: center;
  position: relative;
  transition: background 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  height: 48px;
  @media (max-width: 1366px) {
    height: 83px;
  }

  @media (pointer: coarse) {
    /* 瑙﹀睆 */
    user-select: none;
  }
  &.all-email {
    height: 65px;
    @media (max-width: 1366px) {
      height: 132px;
    }
  }
  .user-info {
    display: flex;
    flex-wrap: wrap;
    column-gap: 10px;
    margin-top: 5px;
    margin-bottom: 2px;
    color: var(--email-scroll-content-color);
    @media (max-width: 1366px) {
      flex-direction: column;
    }

    .user, .account {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      transition: all 300ms;
      line-height: 12px;
      max-width: 300px;
      min-width: 0;

      @media (max-width: 1223px) {
        max-width: 280px;
      }

      span:first-child {
        position: relative;
      }

      span:last-child {
        margin-left: 5px;
        position: relative;
        bottom: 5px;
      }
    }
  }

  .checkbox {
    display: flex;
    padding-left: 15px;
    padding-right: 20px;
    justify-content: center;
  }

  .all-email-checkbox {
    display: flex;
    padding-left: 15px;
    padding-right: 20px;
    justify-content: center;
    @media (min-width: 1367px) {
      justify-content: start;
      height: 100%;
      align-self: start;
      padding-bottom: 30px;
    }
  }

  .title-column {
    @media (max-width: 1366px) {
      grid-template-columns: 1fr !important;
      gap: 4px !important;
    }
  }

  .title {
    flex: 1;
    display: grid;
    /* full-width list: keep the sender column tight so the subject stays close */
    grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
    column-gap: var(--space-4, 16px);
    @media (max-width: 1366px) {
      padding-right: 15px;
    }
    @media (max-width: 1366px) {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .email-sender {
      color: var(--el-text-color-primary);
      display: grid;
      grid-template-columns: auto 1fr auto;

      .email-status {
        display: flex;
        flex-direction: column;
        align-content: center;
        @media (max-width: 1366px) {
          flex-direction: row;
          gap: 5px;
        }
      }

      .name {
        display: grid;
        gap: 5px;
        grid-template-columns: auto 1fr;

        > span:last-child {
          display: flex;
          align-items: center;
        }

        @media (min-width: 1366px) {
          grid-template-columns: 1fr;
          > span:last-child {
            display: none;
          }
        }

        > span:first-child {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .name-skeleton {
          width: 150px;
          height: 1rem;
          @media (max-width: 767px) {
            width: 130px;
          }
        }
      }

      .phone-time {
        font-weight: normal;
        font-size: 12px;
        @media (min-width: 1367px) {
          display: none;
        }
      }
    }

    .email-text-skeleton {
      .text-skeleton-one {
        width: 80%;
        height: 16px;
        @media (max-width: 1366px) {
          width: 40%;
        }
        @media (max-width: 767px) {
          width: 70%;
        }
      }

      .text-skeleton-two {
        width: min(300px, 100%);
        height: 16px;
        @media (min-width: 1367px) {
          display: none;
        }
        @media (max-width: 1366px) {
          width: 100%;
        }
      }
    }

    .email-text {
      display: grid;
      grid-template-columns: auto 1fr;
      @media (max-width: 1366px) {
        grid-template-columns: 1fr;
      }

      .email-subject {
        display: flex;
        align-items: center;
        gap: 6px;
        overflow: hidden;
        white-space: nowrap;
        min-width: 0;
        @media (min-width: 1367px) {
          padding-left: 5px;
        }
      }

      .code-tag {
        flex: 0 0 auto;
        max-width: 170px;
        height: 20px;
        line-height: 20px;
        font-size: 14px;
        color: var(--el-text-color-primary);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        cursor: pointer;
      }

      .subject-text {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        min-width: 0;
      }

      .email-content {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        padding-left: 10px;
        color: var(--email-scroll-content-color);
        @media (max-width: 1366px) {
          padding-left: 0;
          margin-top: 0;
        }
      }
    }
  }


  .email-right {
    text-align: right;
    font-size: 12px;
    white-space: nowrap;
    display: flex;
    padding-left: 15px;
    align-items: center;
    @media (max-width: 1366px) {
      display: none;
    }
  }

  .email-right-skeleton {
    @media (max-width: 1366px) {
      display: none;
    }
  }

  &:hover {
    background-color: var(--email-hover-background);
    z-index: 0;
  }

  /*&[data-checked="true"] {
    background-color: #c2dbff;
  }*/
}


.phone-star {
  display: none;
}

.pc-star {
  display: flex;
  width: 40px;
}

@media (max-width: 1366px) {
  .pc-star {
    display: none;
  }
  .phone-star {
    display: block;
    align-self: end;
    padding-right: 16px;
    padding-top: 8px;
  }
  .star-pd {
    padding-top: 6px !important;
  }
}

.email-time {
  padding-right: v-bind(timePaddingRight);
}

:deep(.el-scrollbar__view) {
  height: 100%;
}

.header-actions {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 15px;
  padding: 3px 15px;
  box-shadow: var(--header-actions-border);

  .header-left {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    position: relative;
    column-gap: 20px;
    row-gap: 8px;
    padding-left: 2px;
    color: var(--el-text-color-primary);;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
    color: var(--el-text-color-primary);;

    .email-count {
      white-space: nowrap;
    }

    .mail-pager {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .pager-btn {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid var(--el-border-color);
      border-radius: 50%;
      background: var(--el-bg-color);
      color: var(--el-text-color-regular);
      cursor: pointer;
    }

    .pager-btn:disabled {
      opacity: .35;
      cursor: default;
    }

    .pager-num {
      min-width: 42px;
      text-align: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .icon {
    font-size: 18px;
    cursor: pointer;
  }

  .more-icon {
    margin-top: 8px;
    margin-left: 15px;
  }
}

.del-status {
  color: var(--el-color-info);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  bottom: 1px;
}



.right-dropdown-item {
  display: flex;
  gap: 10px;
}

:deep(.el-dropdown-menu__item:last-child) {
  padding-bottom: 10px;
}

:deep(.el-dropdown-menu__item:first-child) {
  padding-top: 10px;
}

:deep(.el-dropdown-menu__item) {
  padding-right: 14px;
  padding-left: 14px;
}

.unread {
  height: 6px;
  width: 6px;
  min-width: 6px;
  flex: 0 0 6px;
  background: var(--el-color-primary);
  margin: 0;
  border-radius: 50%;
  display: inline-block;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 閭欢鍒楄〃瑙嗚锛氭洿鍍忔敹浠剁锛岃€屼笉鏄〃鏍?*/
:deep(.email-row) {
  height: 56px;
  padding: 0 16px 0 4px;
  gap: 2px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  box-shadow: none;

  &.is-unread {
    background: color-mix(in srgb, var(--el-color-primary) 4%, var(--el-bg-color));
  }

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: var(--el-color-primary-light-9);
  }

  &.is-unread .name,
  &.is-unread .email-subject {
    font-weight: 700 !important;
  }

  .checkbox {
    padding: 0 4px 0 8px;
  }

  .pc-star {
    width: 30px;
    justify-content: center;
  }

  .title {
    grid-template-columns: minmax(0, 132px) minmax(0, 1fr);
    column-gap: 14px;
    min-width: 0;
  }

  .email-sender .name {
    font-size: 13.5px;
    color: var(--el-text-color-primary);
  }

  .email-text .subject-text {
    font-size: 14px;
    color: var(--el-text-color-primary);
  }

  .email-text :deep(mark.search-hit) {
    background: #fff1a8;
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }

  .email-text .email-content {
    padding-left: 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .email-right {
    padding-left: 12px;
    min-width: 86px;
    justify-content: flex-end;
  }

  .email-actions {
    display: none;
    align-items: center;
    gap: 2px;
    margin-right: 4px;
  }

  &:hover .email-actions {
    display: flex;
  }

  .email-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;

    &:hover {
      background: var(--fill-quaternary);
      color: var(--el-text-color-primary);
    }

    &.disabled {
      opacity: .3;
      pointer-events: none;
    }
  }

  .email-time {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    padding-right: 0;
  }

  @media (max-width: 1366px) {
    height: 72px;
    padding-right: 12px;

    .title {
      grid-template-columns: 1fr;
      gap: 3px;
    }

    .email-text .email-content {
      padding-left: 0;
    }
  }
}

.mail-categories {
  display: flex;
  align-items: stretch;
  flex: 0 0 auto;
  gap: 4px;
  height: 40px;
  padding: 0 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--separator);
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mail-category {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--label-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease;

  &:hover {
    color: var(--label);
  }

  &.active {
    color: var(--blue);
    border-bottom-color: var(--blue);
    font-weight: 600;
  }
}

.mail-category-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.reload.spinning {
  animation: reload-spin .8s linear infinite;
}
@keyframes reload-spin {
  to { transform: rotate(360deg); }
}</style>




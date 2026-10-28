<template>
  <el-popover v-model:visible="visible" placement="bottom-start" :width="320" trigger="click">
    <template #reference>
      <slot>
        <button type="button" class="cp-btn">
          <Icon icon="fa7-solid:user-plus" width="18" height="18"/>
          <span>{{ $t('contactPick') }}</span>
        </button>
      </slot>
    </template>

    <div class="cp">
      <div class="cp__head">
        <el-input
            v-model="keyword"
            size="small"
            class="cp__search"
            :placeholder="$t('contactSearch')"
            clearable
            @keyup.enter="load"
            @clear="load"/>
        <el-select v-model="group" size="small" class="cp__group" @change="load">
          <el-option :label="$t('all')" value=""/>
          <el-option v-for="item in groups" :key="item" :label="item" :value="item"/>
        </el-select>
      </div>

      <div class="cp__list">
        <div class="cp__row" v-for="item in list" :key="item.contactId" @click="choose(item)">
          <span class="cp__check" :class="{'cp__check--on': selected.includes(item.email)}" v-if="multiple">
            <Icon v-if="selected.includes(item.email)" icon="ion:checkmark" width="13" height="13"/>
          </span>
          <div class="cp__info">
            <div class="cp__name">{{ item.name || item.email }}</div>
            <div class="cp__mail">{{ item.email }}</div>
          </div>
          <span class="cp__tag">{{ item.groupName }}</span>
        </div>
        <div class="cp__empty" v-if="!loading && list.length === 0">{{ $t('contactEmpty') }}</div>
      </div>

      <div class="cp__foot" v-if="multiple">
        <el-button size="small" @click="visible = false">{{ $t('cancel') }}</el-button>
        <el-button size="small" type="primary" :disabled="selected.length === 0" @click="confirmMulti">
          {{ $t('confirm') }}
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { reactive, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import { contactList } from "@/request/contact.js";

defineOptions({
  name: 'contact-picker'
})

const props = defineProps({
  // true：多选，确认后 emit('pick', 邮箱数组)；false：点一行直接 emit('pick', 邮箱)
  multiple: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['pick'])

const visible = ref(false)
const loading = ref(false)
const keyword = ref('')
const group = ref('')
const list = reactive([])
const groups = reactive([])
const selected = ref([])

watch(visible, (value) => {
  if (value) {
    selected.value = []
    load()
  }
})

function load() {
  loading.value = true
  contactList(keyword.value, group.value).then(data => {
    list.length = 0
    list.push(...(data.list || []))
    groups.length = 0
    groups.push(...(data.groups || []))
  }).finally(() => {
    loading.value = false
  })
}

function choose(item) {
  if (props.multiple) {
    const index = selected.value.indexOf(item.email)
    index > -1 ? selected.value.splice(index, 1) : selected.value.push(item.email)
    return
  }
  emit('pick', item.email)
  visible.value = false
}

function confirmMulti() {
  if (selected.value.length === 0) {
    return
  }
  emit('pick', [...selected.value])
  visible.value = false
}
</script>

<style scoped>
.cp-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--fill-quaternary);
  color: var(--blue);
  font-size: var(--text-footnote);
  line-height: var(--lh-footnote);
  cursor: pointer;
}

.cp-btn:hover {
  background: var(--fill-tertiary);
}

.cp {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cp__head {
  display: flex;
  gap: var(--space-2);
}

.cp__search {
  flex: 1;
  min-width: 0;
}

.cp__group {
  flex: none;
  width: 104px;
}

.cp__list {
  max-height: 264px;
  overflow-y: auto;
  margin: 0 calc(-1 * var(--space-2));
}

.cp__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--row-height);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.cp__row:hover {
  background: var(--fill-quaternary);
}

.cp__check {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--separator);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.cp__check--on {
  background: var(--blue);
  border-color: var(--blue);
}

.cp__info {
  flex: 1;
  min-width: 0;
}

.cp__name {
  color: var(--label);
  font-size: var(--text-subhead);
  line-height: var(--lh-subhead);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp__mail {
  color: var(--label-2);
  font-size: var(--text-footnote);
  line-height: var(--lh-footnote);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp__tag {
  flex: none;
  color: var(--label-3);
  font-size: var(--text-caption);
  line-height: var(--lh-caption);
}

.cp__empty {
  padding: var(--space-5) 0;
  text-align: center;
  color: var(--label-3);
  font-size: var(--text-footnote);
}

.cp__foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

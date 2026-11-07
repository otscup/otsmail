<template>
  <div class="skin-grid" role="radiogroup" :aria-label="t('appearance')">
    <button
      v-for="skin in HOME_SKINS"
      :key="skin.id"
      type="button"
      class="skin-card"
      :class="[`skin-${skin.id}`, { selected: selected === skin.id }]"
      role="radio"
      :aria-checked="selected === skin.id"
      @click="choose(skin.id)"
    >
      <span class="skin-preview" aria-hidden="true">
        <span class="skin-rail"/>
        <span class="skin-side"/>
        <span class="skin-paper">
          <i/><i/><i/>
        </span>
      </span>
      <span class="skin-name">{{ t(skin.labelKey) }}</span>
      <span class="skin-desc">{{ t(skin.descKey) }}</span>
    </button>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {ElMessage} from 'element-plus'
import {HOME_SKINS, applySkin, getStoredSkin} from '@/utils/appearance.js'
import {updateMySetting} from '@/request/my.js'
import {useUserStore} from '@/store/user.js'

const {t} = useI18n()
const userStore = useUserStore()
const selected = ref(getStoredSkin())
let saving = false

async function choose(id) {
  if (saving || id === selected.value) return
  const previous = selected.value
  saving = true
  selected.value = applySkin(id)
  try {
    await updateMySetting({skin: id})
    userStore.user.skin = id
  } catch (e) {
    selected.value = applySkin(previous)
    ElMessage({message: e?.message || t('skinSyncFailed'), type: 'error', plain: true})
  } finally {
    saving = false
  }
}
</script>

<style scoped>
.skin-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  width: 100%;
}

.skin-card {
  display: grid;
  min-width: 0;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--rd-line);
  border-radius: 12px;
  background: var(--rd-panel) !important;
  color: var(--rd-text);
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}

.skin-card:hover {
  transform: translateY(-1px);
  border-color: var(--rd-line-strong);
}

.skin-card.selected {
  border-color: var(--rd-accent);
  box-shadow: 0 0 0 1px var(--rd-accent);
}

.skin-card:focus-visible {
  outline: 2px solid var(--rd-accent);
  outline-offset: 3px;
}

.skin-preview {
  display: flex;
  height: 92px;
  overflow: hidden;
  border-radius: 7px;
  border: 1px solid rgba(0, 0, 0, .08);
}

.skin-rail {
  width: 12px;
  background: var(--skin-rail);
}

.skin-side {
  width: 30%;
  background: var(--skin-side);
}

.skin-paper {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 7px;
  padding: 12px 10px;
  background: var(--skin-paper);
}

.skin-paper i {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: var(--skin-line);
}

.skin-paper i:first-child {
  width: 62%;
  background: var(--skin-accent);
}

.skin-name {
  font-size: 14px;
  font-weight: 650;
  color: var(--rd-text);
}

.skin-desc {
  margin-top: -4px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--rd-muted);
  white-space: normal;
  overflow-wrap: anywhere;
}

.skin-card.skin-paper {
  --skin-rail: #e9e2d5;
  --skin-side: #f2ebdf;
  --skin-paper: #fffdf8;
  --skin-line: #ded4c4;
  --skin-accent: #2452d8;
}

.skin-card.skin-fresh {
  --skin-rail: #dcefe5;
  --skin-side: #e7f5ee;
  --skin-paper: #fbfefc;
  --skin-line: #cfe7dc;
  --skin-accent: #0d6b55;
}

.skin-card.skin-gala {
  --skin-rail: #f0e4d8;
  --skin-side: #f7ede2;
  --skin-paper: #fff9f1;
  --skin-line: #e3d4c6;
  --skin-accent: #9e2738;
}

.skin-card.skin-classic {
  --skin-rail: #eef1f7;
  --skin-side: #f4f6fb;
  --skin-paper: #ffffff;
  --skin-line: #dde3ee;
  --skin-accent: #0a84ff;
}

@media (max-width: 760px) {
  .skin-grid {
    grid-template-columns: 1fr;
  }
  .skin-preview {
    height: 78px;
  }
}
</style>

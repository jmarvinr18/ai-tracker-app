<script setup lang="ts">
import type { TrackerError } from '@/api/errors'

defineProps<{ error: TrackerError }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="notice" role="alert">
    <div class="notice__head">
      <span class="tag tag--stall">{{ error.kind }}</span>
      <h3 class="notice__title">{{ error.title }}</h3>
      <button type="button" class="notice__close" @click="$emit('dismiss')">
        <span class="visually-hidden">Dismiss</span>
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <p class="notice__detail">{{ error.detail }}</p>
    <p v-if="error.action" class="notice__action">{{ error.action }}</p>
    <slot />
  </div>
</template>

<style scoped>
.notice {
  background: var(--stall-wash);
  border: 1px solid color-mix(in srgb, var(--stall) 30%, transparent);
  border-left: 3px solid var(--stall);
  border-radius: var(--radius);
  padding: var(--step-4);
  display: grid;
  gap: var(--step-2);
}

.notice__head {
  display: flex;
  align-items: center;
  gap: var(--step-2);
  flex-wrap: wrap;
}

.notice__title {
  font-size: 0.9375rem;
  flex: 1;
  min-width: 12ch;
}

.notice__close {
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.2rem 0.35rem;
  border-radius: var(--radius);
}

.notice__close:hover {
  color: var(--ink);
}

.notice__detail,
.notice__action {
  font-size: 0.8125rem;
  max-width: 72ch;
}

.notice__detail {
  color: var(--ink);
}

.notice__action {
  color: var(--ink);
  font-weight: 500;
  border-top: 1px solid color-mix(in srgb, var(--stall) 25%, transparent);
  padding-top: var(--step-2);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

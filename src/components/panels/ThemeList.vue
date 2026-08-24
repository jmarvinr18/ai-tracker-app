<script setup lang="ts">
import { computed } from 'vue'
import { formatCount } from '@/lib/format'
import type { ThemeRow } from '@/types/tracker'

const props = defineProps<{ themes: ThemeRow[] }>()

// Rank order is the point: position one is the barrier the most people wrote
// about, and therefore where an intervention starts.
const ranked = computed(() => [...props.themes].sort((a, b) => b.member_count - a.member_count))

const peak = computed(() =>
  ranked.value.reduce((carry, row) => Math.max(carry, row.member_count), 0),
)
</script>

<template>
  <ol class="themes">
    <li v-for="(theme, index) in ranked" :key="theme.theme_id || theme.label" class="theme">
      <span class="theme__rank num" :class="{ 'theme__rank--first': index === 0 }">
        {{ index + 1 }}
      </span>
      <span class="theme__label">{{ theme.label }}</span>
      <span class="theme__track" aria-hidden="true">
        <span
          class="theme__fill"
          :style="{ width: `${peak > 0 ? (theme.member_count / peak) * 100 : 0}%` }"
        />
      </span>
      <span class="theme__count num">
        {{ formatCount(theme.member_count) }}
        <span class="theme__unit">{{ theme.member_count === 1 ? 'reply' : 'replies' }}</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.themes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--step-3);
  counter-reset: theme;
}

.theme {
  display: grid;
  grid-template-columns: 1.5rem 1fr;
  grid-template-areas:
    'rank label'
    '. track'
    '. count';
  gap: var(--step-1) var(--step-3);
  align-items: center;
}

@media (min-width: 640px) {
  .theme {
    grid-template-columns: 1.5rem minmax(10rem, 1fr) 6rem auto;
    grid-template-areas: 'rank label track count';
  }
}

.theme__rank {
  grid-area: rank;
  font-size: 0.875rem;
  color: var(--ink-soft);
  text-align: right;
}

.theme__rank--first {
  color: var(--ink);
  font-weight: 600;
}

.theme__label {
  grid-area: label;
  font-size: 0.875rem;
}

.theme__track {
  grid-area: track;
  background: var(--paper);
  height: 8px;
  border-radius: 2px;
  overflow: hidden;
}

.theme__fill {
  display: block;
  height: 100%;
  background: var(--ink-soft);
  border-radius: 2px;
}

.theme:first-child .theme__fill {
  background: var(--stall);
}

.theme__count {
  grid-area: count;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.theme__unit {
  font-family: var(--font-body);
  font-size: 0.6875rem;
  color: var(--ink-soft);
}
</style>

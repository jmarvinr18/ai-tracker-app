<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatCount, formatElapsed, formatTimestamp } from '@/lib/format'
import type { InsightsResponse } from '@/types/tracker'
import type { SentimentReading } from '@/lib/normalize'

const props = defineProps<{
  reading: InsightsResponse
  sentiment: SentimentReading
}>()

// Elapsed time is only true at the moment it is rendered, so it re-reads the
// clock rather than freezing at page load.
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(timer))

const lastEvent = computed(() => props.reading.totals.last_event_at)

const tiles = computed(() => [
  {
    key: 'users',
    label: 'People using it',
    value: formatCount(props.reading.totals.active_users),
    unit: `in ${props.reading.window_days} days`,
    title: 'Distinct people with at least one recorded use in the window',
  },
  {
    key: 'events',
    label: 'Recorded uses',
    value: formatCount(props.reading.totals.events),
    unit: 'events',
    title: 'Total usage events posted by the SDK',
  },
  {
    key: 'responses',
    label: 'Survey replies',
    value: formatCount(props.sentiment.totalResponses),
    unit: props.sentiment.totalResponses === 1 ? 'response' : 'responses',
    title: 'Completed survey responses across every sentiment value',
  },
  {
    key: 'last',
    label: 'Since last use',
    value: formatElapsed(lastEvent.value, now.value),
    unit: 'ago',
    title: formatTimestamp(lastEvent.value),
  },
])
</script>

<template>
  <div class="kpis">
    <div v-for="tile in tiles" :key="tile.key" class="kpi" :title="tile.title">
      <p class="label">{{ tile.label }}</p>
      <p class="kpi__value num">{{ tile.value }}</p>
      <p class="kpi__unit">{{ tile.unit }}</p>
    </div>
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  gap: var(--step-3);
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 760px) {
  .kpis {
    grid-template-columns: repeat(4, 1fr);
  }
}

.kpi {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--step-4);
}

.kpi__value {
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  line-height: 1.1;
  margin-top: var(--step-2);
  letter-spacing: -0.02em;
}

.kpi__unit {
  font-size: 0.75rem;
  color: var(--ink-soft);
}
</style>

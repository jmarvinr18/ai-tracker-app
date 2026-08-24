<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatElapsed, formatTimestamp } from '@/lib/format'
import type { Citation } from '@/types/tracker'
import type { Briefing } from '@/types/tracker'

const props = defineProps<{
  briefing: Briefing | null
  citations: Citation[]
  busy: boolean
  /** Milliseconds left on the regenerate rate limit. */
  cooldownRemaining: number
  canRegenerate: boolean
}>()

const emit = defineEmits<{ regenerate: [] }>()

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const cooldownSeconds = computed(() => Math.ceil(props.cooldownRemaining / 1000))
const blocked = computed(() => props.busy || cooldownSeconds.value > 0 || !props.canRegenerate)

const sections = computed(() => {
  const briefing = props.briefing
  if (!briefing) return []
  return [
    { key: 'summary', label: 'Summary', body: briefing.summary },
    { key: 'insight', label: 'Insight', body: briefing.insight },
    { key: 'recommendation', label: 'Recommendation', body: briefing.recommendation },
  ].filter((section) => section.body)
})

const unavailable = computed(() => props.briefing !== null && props.briefing.status !== 'ok')
</script>

<template>
  <div class="briefing">
    <!--
      `status: "unavailable"` means the agent could not produce a briefing this
      run. Showing the previous one in its place would present stale reasoning
      as current, so the state is shown instead.
    -->
    <div v-if="unavailable" class="unavailable" role="status">
      <span class="tag tag--stall">unavailable</span>
      <p class="unavailable__body">
        The briefing agent ran and could not produce a briefing for this window. Nothing older is
        being shown in its place — an earlier briefing would describe different numbers.
      </p>
      <p class="unavailable__body">
        Regenerate below. If it stays unavailable, check the agent's logs: the usual causes are a
        model timeout or a window with too little data to summarise.
      </p>
    </div>

    <EmptyState
      v-else-if="!briefing"
      headline="No briefing generated yet"
      action="The briefing agent has not run for this window. Press Regenerate to run it now, or wait for the scheduled job — the dashboard works without it."
    />

    <div v-else class="body">
      <section v-for="section in sections" :key="section.key" class="section">
        <h3 class="label">{{ section.label }}</h3>
        <p class="section__body">{{ section.body }}</p>
      </section>

      <div v-if="citations.length" class="citations">
        <h3 class="label">Cited figures</h3>
        <ul class="citations__list">
          <li v-for="citation in citations" :key="`${citation.metric}-${citation.value}`">
            <span class="citations__metric">{{ citation.metric }}</span>
            <span class="citations__value num">{{ citation.value }}</span>
          </li>
        </ul>
      </div>
    </div>

    <footer class="foot">
      <p class="foot__meta">
        <template v-if="briefing?.generated_at">
          Generated
          <time class="num" :title="formatTimestamp(briefing.generated_at)">
            {{ formatElapsed(briefing.generated_at, now) }}
          </time>
          ago · served from cache, so opening this page does not run the agent.
        </template>
        <template v-else> Served from cache. Opening this page does not run the agent. </template>
      </p>
      <button type="button" class="button" :disabled="blocked" @click="emit('regenerate')">
        <template v-if="busy">Running…</template>
        <template v-else-if="cooldownSeconds > 0">Regenerate in {{ cooldownSeconds }}s</template>
        <template v-else>Regenerate</template>
      </button>
    </footer>
    <p v-if="!canRegenerate" class="foot__note">
      Regenerating needs a live connection. This reading came from a paste or the sample dataset, so
      there is nothing to call.
    </p>
  </div>
</template>

<style scoped>
.briefing {
  display: grid;
  gap: var(--step-4);
}

.body {
  display: grid;
  gap: var(--step-4);
}

.section__body {
  font-size: 0.9375rem;
  max-width: 74ch;
  margin-top: var(--step-1);
}

.unavailable {
  background: var(--stall-wash);
  border-left: 3px solid var(--stall);
  border-radius: var(--radius);
  padding: var(--step-3) var(--step-4);
  display: grid;
  gap: var(--step-2);
  justify-items: start;
}

.unavailable__body {
  font-size: 0.8125rem;
  max-width: 70ch;
}

.citations {
  border-top: 1px solid var(--rule);
  padding-top: var(--step-3);
}

.citations__list {
  list-style: none;
  padding: 0;
  margin: var(--step-2) 0 0;
  display: grid;
  gap: var(--step-1);
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .citations__list {
    grid-template-columns: 1fr 1fr;
    gap: var(--step-1) var(--step-4);
  }
}

.citations__list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--step-2);
  border-bottom: 1px dotted var(--rule);
  padding-bottom: 2px;
}

.citations__metric {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-soft);
}

.citations__value {
  font-size: 0.8125rem;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--step-3);
  flex-wrap: wrap;
  border-top: 1px solid var(--rule);
  padding-top: var(--step-3);
}

.foot__meta,
.foot__note {
  font-size: 0.75rem;
  color: var(--ink-soft);
  max-width: 60ch;
}
</style>

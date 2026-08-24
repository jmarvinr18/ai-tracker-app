<script setup lang="ts">
import { computed } from 'vue'
import { formatCount, formatHours } from '@/lib/format'
import type { SentimentReading } from '@/lib/normalize'

const props = defineProps<{ sentiment: SentimentReading }>()

const peak = computed(() =>
  props.sentiment.words.reduce((carry, row) => Math.max(carry, row.responses), 0),
)

const tone: Record<string, string> = {
  positive: 'live',
  neutral: 'quiet',
  negative: 'stall',
}
</script>

<template>
  <div class="sentiment">
    <!--
      Numeric and word sentiment values do not aggregate: rows seeded before the
      API enforced words wrote codes, and there is no safe mapping from a code
      back to a word. Charting them together would silently invent a total.
    -->
    <div v-if="sentiment.mixedEncoding" class="warn" role="alert">
      <p class="warn__title">Two encodings in one column — these are not added together</p>
      <p class="warn__body">
        {{ formatCount(sentiment.wordResponses) }} responses use the words the API enforces, and
        {{ formatCount(sentiment.codeResponses) }} use numeric codes written before that constraint
        existed. A code cannot be mapped back to a word without guessing, so only the word rows are
        charted below and the coded rows are listed separately.
      </p>
      <p class="warn__body">
        Backfill the coded rows to <code>positive</code>, <code>neutral</code> or
        <code>negative</code> in the survey table, then reload.
      </p>
    </div>

    <ul v-if="sentiment.words.length" class="bars">
      <li v-for="row in sentiment.words" :key="row.word" class="bar-row">
        <span class="bar-row__label">{{ row.word }}</span>
        <span class="bar-row__track">
          <span
            class="bar-row__fill"
            :class="`bar-row__fill--${tone[row.word] ?? 'quiet'}`"
            :style="{ width: `${peak > 0 ? (row.responses / peak) * 100 : 0}%` }"
          />
        </span>
        <span class="bar-row__value num">{{ formatCount(row.responses) }}</span>
        <span class="bar-row__hours num" :title="'Average time saved per response'">
          {{ formatHours(row.hours) }}
        </span>
      </li>
    </ul>

    <ul v-if="sentiment.codes.length" class="codes">
      <li v-for="row in sentiment.codes" :key="`code-${row.code}`">
        <span class="tag">code {{ row.code }}</span>
        <span class="num">{{ formatCount(row.responses) }}</span>
        <span class="codes__unit">responses · {{ formatHours(row.hours) }} saved</span>
      </li>
    </ul>

    <ul v-if="sentiment.other.length" class="codes">
      <li v-for="row in sentiment.other" :key="`other-${row.label}`">
        <span class="tag">{{ row.label }}</span>
        <span class="num">{{ formatCount(row.responses) }}</span>
        <span class="codes__unit">responses, unrecognised value</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sentiment {
  display: grid;
  gap: var(--step-4);
}

.warn {
  background: var(--stall-wash);
  border-left: 3px solid var(--stall);
  border-radius: var(--radius);
  padding: var(--step-3) var(--step-4);
  display: grid;
  gap: var(--step-2);
}

.warn__title {
  font-family: var(--font-display);
  font-size: 0.875rem;
}

.warn__body {
  font-size: 0.8125rem;
  max-width: 70ch;
}

.warn code {
  font-size: 0.75rem;
  background: var(--surface);
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
}

.bars {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--step-3);
}

.bar-row {
  display: grid;
  grid-template-columns: 5rem 1fr 2.5rem 3.5rem;
  align-items: center;
  gap: var(--step-2);
}

.bar-row__label {
  font-size: 0.8125rem;
  text-transform: capitalize;
}

.bar-row__track {
  background: var(--paper);
  border-radius: 2px;
  height: 14px;
  overflow: hidden;
}

.bar-row__fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.bar-row__fill--live {
  background: var(--live);
}

.bar-row__fill--stall {
  background: var(--stall);
}

.bar-row__fill--quiet {
  background: var(--ink-soft);
}

.bar-row__value {
  font-size: 0.8125rem;
  text-align: right;
}

.bar-row__hours {
  font-size: 0.75rem;
  color: var(--ink-soft);
  text-align: right;
}

.codes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--step-2);
  border-top: 1px solid var(--rule);
  padding-top: var(--step-3);
}

.codes li {
  display: flex;
  align-items: center;
  gap: var(--step-2);
  font-size: 0.8125rem;
}

.codes__unit {
  color: var(--ink-soft);
  font-size: 0.75rem;
}
</style>

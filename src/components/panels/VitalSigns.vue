<script setup lang="ts">
import { computed } from 'vue'
import { formatCount, formatList, formatRatio, formatWeek } from '@/lib/format'
import {
  STALL_INTENSITY,
  STALL_MIN_USERS,
  type DivisionVitals,
  type VitalsReading,
} from '@/lib/vitals'

const props = defineProps<{ vitals: VitalsReading }>()

interface PulseBar {
  week: string
  /** 0–1, relative to the tallest week in this row. */
  height: number
  title: string
}

/**
 * Bars are scaled within their own row, not across rows.
 *
 * Across-row scaling would make every row except the busiest a flat smear, and
 * the row's magnitude is already carried by the ratio and the counts beside it.
 * What the bars are for is shape.
 */
function bars(division: DivisionVitals): PulseBar[] {
  const peak = division.pulse.reduce((carry, value) => Math.max(carry, value), 0)
  return division.pulse.map((value, index) => ({
    week: props.vitals.weeks[index] ?? String(index),
    height: peak > 0 ? value / peak : 0,
    title: `Week of ${formatWeek(props.vitals.weeks[index] ?? '')}: ~${Math.round(value)} uses (inferred)`,
  }))
}

const stalledNames = computed(() => props.vitals.stalled.map((entry) => entry.division))

const conclusion = computed(() => {
  const names = stalledNames.value
  if (names.length === 0) {
    return `No division is below ${STALL_INTENSITY} uses per person. Nothing here needs an intervention this week.`
  }
  const subject = names.length === 1 ? 'is' : 'are'
  const noun = names.length === 1 ? 'division' : 'divisions'
  return (
    `${formatList(names)} ${subject} stalled — people there tried the agent and stopped. ` +
    `That ${noun} is where change management pays for itself: the users already exist, ` +
    `so the cost is a nudge rather than a rollout.`
  )
})

const floorNames = computed(() =>
  props.vitals.divisions
    .filter((entry) => entry.belowReportingFloor)
    .map((entry) => entry.division),
)
</script>

<template>
  <section class="vitals panel">
    <header class="panel__head">
      <div>
        <h2 class="vitals__title">Vital signs by division</h2>
        <p class="panel__note">
          Ranked by uses per person, not by volume. A division with many users and few uses each is
          the finding a total would hide.
        </p>
      </div>
      <p class="tag">
        stalled &lt; {{ STALL_INTENSITY }} uses/person · min {{ STALL_MIN_USERS }} users
      </p>
    </header>

    <ol class="rows">
      <li
        v-for="division in vitals.divisions"
        :key="division.division"
        class="row"
        :class="{ 'row--stalled': division.stalled }"
      >
        <div class="row__id">
          <p class="row__name">{{ division.division }}</p>
          <p class="row__group">{{ division.businessGroups.join(', ') || 'Unassigned' }}</p>
        </div>

        <div class="row__ratio">
          <span class="row__intensity num">{{ formatRatio(division.intensity) }}</span>
          <span class="row__per">uses/person</span>
        </div>

        <div
          class="row__pulse"
          role="img"
          :aria-label="`Weekly pulse for ${division.division}, inferred`"
        >
          <span
            v-for="(bar, index) in bars(division)"
            :key="`${division.division}-${bar.week}-${index}`"
            class="bar"
            :title="bar.title"
            :style="{ '--h': `${Math.max(bar.height * 100, 3)}%` }"
          />
        </div>

        <div class="row__counts">
          <span class="num">{{ formatCount(division.activeUsers) }}</span>
          <span class="row__countlabel">users</span>
          <span class="num">{{ formatCount(division.events) }}</span>
          <span class="row__countlabel">uses</span>
        </div>

        <div class="row__flag">
          <span v-if="division.stalled" class="tag tag--stall">stalled</span>
          <span v-else-if="division.belowReportingFloor" class="tag">below floor</span>
          <span v-else class="tag tag--live">healthy</span>
        </div>
      </li>
    </ol>

    <p class="conclusion" :class="{ 'conclusion--alert': stalledNames.length > 0 }">
      {{ conclusion }}
    </p>

    <p v-if="floorNames.length" class="footnote">
      {{ formatList(floorNames) }}
      {{ floorNames.length === 1 ? 'has' : 'have' }} a low ratio but fewer than
      {{ STALL_MIN_USERS }} users, so {{ floorNames.length === 1 ? 'it is' : 'they are' }} left
      unflagged. One curious person is not a division in trouble.
    </p>

    <p v-if="vitals.pulseIsInferred" class="footnote footnote--provenance">
      <strong>Measured:</strong> every ratio, user count and use count above, and therefore every
      stall flag. <strong>Inferred:</strong> the week-by-week shape of each pulse —
      <code>/v1/insights</code> returns one trend for the whole agent, so each row distributes its
      real total across the overall curve and leans it earlier when stalled. Read the bars for
      shape, the numbers for evidence. A <code>GROUP BY division, week</code> query on the API would
      make these measured too; it is the recommended follow-up.
    </p>
  </section>
</template>

<style scoped>
/* The one place in the app that raises its voice. */
.vitals {
  border-width: 1px;
  box-shadow: var(--shadow);
}

.vitals__title {
  font-size: 1.25rem;
  letter-spacing: -0.01em;
}

.rows {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--rule);
}

.row {
  display: grid;
  gap: var(--step-2) var(--step-4);
  align-items: center;
  padding: var(--step-3) 0;
  border-bottom: 1px solid var(--rule);
  grid-template-areas:
    'id ratio'
    'pulse pulse'
    'counts flag';
  grid-template-columns: 1fr auto;
}

@media (min-width: 820px) {
  .row {
    grid-template-areas: 'id ratio pulse counts flag';
    grid-template-columns: minmax(9rem, 1.1fr) auto minmax(8rem, 1.6fr) auto 5.5rem;
  }
}

.row__id {
  grid-area: id;
  min-width: 0;
}

.row__name {
  font-family: var(--font-display);
  font-size: 0.9375rem;
}

.row__group {
  font-size: 0.6875rem;
  color: var(--ink-soft);
}

.row__ratio {
  grid-area: ratio;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.row__intensity {
  font-size: 1.375rem;
  color: var(--live);
  letter-spacing: -0.02em;
}

.row--stalled .row__intensity {
  color: var(--stall);
}

.row__per {
  font-size: 0.6875rem;
  color: var(--ink-soft);
}

/* The pulse: a row of small weekly bars. Flatlining should be visible at a glance. */
.row__pulse {
  grid-area: pulse;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 34px;
  padding: 2px 0;
}

.bar {
  flex: 1;
  min-width: 3px;
  height: var(--h);
  background: var(--live);
  border-radius: 1px;
  opacity: 0.85;
  transition: height 0.3s ease;
}

.row--stalled .bar {
  background: var(--stall);
}

.row__counts {
  grid-area: counts;
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 0.8125rem;
  color: var(--ink-soft);
  white-space: nowrap;
}

.row__countlabel {
  font-size: 0.6875rem;
}

.row__counts .num {
  color: var(--ink);
}

.row__flag {
  grid-area: flag;
  justify-self: end;
}

.conclusion {
  margin-top: var(--step-4);
  font-size: 0.9375rem;
  max-width: 68ch;
  border-left: 3px solid var(--rule);
  padding-left: var(--step-3);
}

.conclusion--alert {
  border-left-color: var(--stall);
}

.footnote {
  margin-top: var(--step-3);
  font-size: 0.75rem;
  color: var(--ink-soft);
  max-width: 78ch;
}

.footnote--provenance {
  border-top: 1px solid var(--rule);
  padding-top: var(--step-3);
}

.footnote code {
  font-size: 0.7rem;
  background: var(--paper);
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
}
</style>

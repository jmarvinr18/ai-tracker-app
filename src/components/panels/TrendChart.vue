<script setup lang="ts">
import { computed } from 'vue'
import { formatCount, formatWeek } from '@/lib/format'
import type { TrendPoint } from '@/types/tracker'

const props = defineProps<{ trend: TrendPoint[] }>()

// Hand-drawn rather than a charting dependency: this is one line and three grid
// rules, which is less code than the import would be.
const WIDTH = 640
const HEIGHT = 200
const PAD = { top: 16, right: 12, bottom: 28, left: 40 }

const plot = computed(() => {
  const points = props.trend
  const peak = points.reduce((carry, point) => Math.max(carry, point.active_users), 0)
  // Round the ceiling up so the top grid rule is a number a person would say.
  const ceiling = peak <= 0 ? 10 : Math.ceil(peak / 10) * 10
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom

  const coords = points.map((point, index) => {
    const ratio = points.length > 1 ? index / (points.length - 1) : 0.5
    return {
      x: PAD.left + ratio * innerWidth,
      y: PAD.top + innerHeight * (1 - point.active_users / ceiling),
      point,
    }
  })

  const line = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x},${coord.y}`)
    .join(' ')

  const first = coords[0]
  const last = coords[coords.length - 1]
  const area =
    first && last
      ? `${line} L${last.x},${PAD.top + innerHeight} L${first.x},${PAD.top + innerHeight} Z`
      : ''

  const rules = [0, 0.5, 1].map((fraction) => ({
    y: PAD.top + innerHeight * fraction,
    value: Math.round(ceiling * (1 - fraction)),
  }))

  return { coords, line, area, rules, ceiling }
})

const change = computed(() => {
  const points = props.trend
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const previous = points[points.length - 2]
  if (!last || !previous) return null
  return last.active_users - previous.active_users
})
</script>

<template>
  <figure class="chart">
    <svg
      class="chart__svg"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`Weekly active users across ${trend.length} weeks, peaking at ${plot.ceiling}`"
    >
      <g class="rules">
        <template v-for="rule in plot.rules" :key="rule.y">
          <line :x1="PAD.left" :x2="WIDTH - PAD.right" :y1="rule.y" :y2="rule.y" />
          <text class="num" :x="PAD.left - 8" :y="rule.y + 4" text-anchor="end">
            {{ rule.value }}
          </text>
        </template>
      </g>

      <path v-if="plot.area" class="area" :d="plot.area" />
      <path v-if="plot.line" class="line" :d="plot.line" />

      <g class="marks">
        <circle
          v-for="coord in plot.coords"
          :key="coord.point.week"
          :cx="coord.x"
          :cy="coord.y"
          r="3"
        >
          <title>
            {{ formatWeek(coord.point.week) }}: {{ coord.point.active_users }} active users
          </title>
        </circle>
      </g>

      <g class="weeks num">
        <text
          v-for="(coord, index) in plot.coords"
          :key="`w-${coord.point.week}`"
          :x="coord.x"
          :y="HEIGHT - 8"
          :text-anchor="index === 0 ? 'start' : index === plot.coords.length - 1 ? 'end' : 'middle'"
        >
          {{ formatWeek(coord.point.week) }}
        </text>
      </g>
    </svg>

    <figcaption v-if="change !== null" class="chart__caption">
      Most recent week
      <span class="num" :class="change < 0 ? 'down' : 'up'">
        {{ change >= 0 ? '+' : '' }}{{ formatCount(change) }}
      </span>
      active users against the week before.
    </figcaption>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
}

.chart__svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.rules line {
  stroke: var(--rule);
  stroke-width: 1;
}

.rules text,
.weeks text {
  fill: var(--ink-soft);
  font-size: 10px;
  font-family: var(--font-mono);
}

.area {
  fill: var(--live-wash);
}

.line {
  fill: none;
  stroke: var(--live);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.marks circle {
  fill: var(--surface);
  stroke: var(--live);
  stroke-width: 2;
}

.chart__caption {
  margin-top: var(--step-3);
  font-size: 0.8125rem;
  color: var(--ink-soft);
}

.up {
  color: var(--live);
}

.down {
  color: var(--stall);
}
</style>

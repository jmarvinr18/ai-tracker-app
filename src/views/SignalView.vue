<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTrackerStore } from '@/stores/tracker'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import KpiRow from '@/components/panels/KpiRow.vue'
import VitalSigns from '@/components/panels/VitalSigns.vue'
import TrendChart from '@/components/panels/TrendChart.vue'
import SentimentBars from '@/components/panels/SentimentBars.vue'
import ThemeList from '@/components/panels/ThemeList.vue'
import BriefingPanel from '@/components/panels/BriefingPanel.vue'
import { formatCount } from '@/lib/format'

const store = useTrackerStore()
const { reading, vitals, health, error, source, busy, regenerateCooldownRemaining } =
  storeToRefs(store)

// Filter state
const selectedDivisions = ref<string[]>([])
const selectedSentiments = ref<string[]>([])
const selectedPlatforms = ref<string[]>([])

// Get unique values for filters
const divisions = computed(() => {
  const divs = new Set(reading.value?.adoption.map((row) => row.division) ?? [])
  return Array.from(divs).sort()
})

const sentiments = computed(() => {
  return ['positive', 'neutral', 'negative']
})

const platforms = computed(() => {
  const plats = new Set(reading.value?.platforms.map((row) => row.platform) ?? [])
  return Array.from(plats).sort()
})

// Filter functions
function toggleDivision(division: string): void {
  const idx = selectedDivisions.value.indexOf(division)
  if (idx > -1) {
    selectedDivisions.value.splice(idx, 1)
  } else {
    selectedDivisions.value.push(division)
  }
}

function toggleSentiment(sentiment: string): void {
  const idx = selectedSentiments.value.indexOf(sentiment)
  if (idx > -1) {
    selectedSentiments.value.splice(idx, 1)
  } else {
    selectedSentiments.value.push(sentiment)
  }
}

function togglePlatform(platform: string): void {
  const idx = selectedPlatforms.value.indexOf(platform)
  if (idx > -1) {
    selectedPlatforms.value.splice(idx, 1)
  } else {
    selectedPlatforms.value.push(platform)
  }
}

function clearAllFilters(): void {
  selectedDivisions.value = []
  selectedSentiments.value = []
  selectedPlatforms.value = []
}

// Filtered data
const filteredAdoption = computed(() => {
  if (!reading.value) return []
  return reading.value.adoption.filter((row) => {
    if (selectedDivisions.value.length > 0 && !selectedDivisions.value.includes(row.division)) {
      return false
    }
    return true
  })
})

const filteredSentiment = computed(() => {
  if (!reading.value) return []
  return reading.value.sentiment.filter((row) => {
    if (selectedSentiments.value.length > 0 && !selectedSentiments.value.includes(String(row.sentiment))) {
      return false
    }
    return true
  })
})

const filteredPlatforms = computed(() => {
  if (!reading.value) return []
  return reading.value.platforms.filter((row) => {
    if (selectedPlatforms.value.length > 0 && !selectedPlatforms.value.includes(row.platform)) {
      return false
    }
    return true
  })
})

const filteredVitals = computed(() => {
  if (!vitals.value) return null
  // Update vitals based on filtered adoption data
  const filteredEvents = filteredAdoption.value.reduce((sum, row) => sum + row.events, 0)
  const filteredUsers = filteredAdoption.value.reduce((sum, row) => sum + row.active_users, 0)
  return {
    ...vitals.value,
    events: filteredEvents,
    activeUsers: filteredUsers,
  }
})

const platformNote = computed(() => {
  if (filteredPlatforms.value.length === 0) return undefined
  return filteredPlatforms.value
    .map((row) => `${row.platform}: ${formatCount(row.events)} uses, ${row.active_users} people`)
    .join(' · ')
})

const hasActiveFilters = computed(() => {
  return selectedDivisions.value.length > 0 || selectedSentiments.value.length > 0 || selectedPlatforms.value.length > 0
})

// Create filtered reading object with updated totals
const filteredReading = computed(() => {
  if (!reading.value) return null
  const events = filteredAdoption.value.reduce((sum, row) => sum + row.events, 0)
  const users = filteredAdoption.value.reduce((sum, row) => sum + row.active_users, 0)
  return {
    ...reading.value,
    adoption: filteredAdoption.value,
    platforms: filteredPlatforms.value,
    totals: {
      ...reading.value.totals,
      events,
      active_users: users,
    },
  }
})
</script>

<template>
  <div class="stack">
    <ErrorNotice v-if="error" :error="error" @dismiss="store.error = null" />

    <template v-if="reading && vitals && health">
      <KpiRow :reading="filteredReading || reading" :sentiment="health.sentiment" />

      <!-- Division Filter -->
      <div v-if="divisions.length > 0" class="filter-bar">
        <div class="filter-bar-title">📊 Filter by Division</div>
        <div class="filter-tags">
          <button
            v-for="division in divisions"
            :key="division"
            type="button"
            class="filter-tag"
            :class="{ active: selectedDivisions.includes(division) }"
            @click="toggleDivision(division)"
          >
            {{ division }}
          </button>
          <button
            v-if="selectedDivisions.length > 0"
            type="button"
            class="filter-tag clear"
            @click="selectedDivisions = []"
          >
            ✕ Clear
          </button>
        </div>
      </div>

      <VitalSigns :vitals="filteredVitals || vitals" />

      <div class="grid-2">
        <PanelCard
          title="Weekly trend"
          note="Distinct people with at least one use each week, across the whole agent."
        >
          <TrendChart v-if="reading.trend.length" :trend="reading.trend" />
          <EmptyState
            v-else
            headline="No weekly trend yet"
            action="The window contains no completed weeks. Widen it in Connect, or wait for the SDK to post a second week of events."
          />
        </PanelCard>

        <div>
          <!-- Sentiment Filter -->
          <div v-if="filteredSentiment.length > 0" class="filter-bar">
            <div class="filter-bar-title">💬 Filter by Sentiment</div>
            <div class="filter-tags">
              <button
                v-for="sentiment in sentiments"
                :key="sentiment"
                type="button"
                class="filter-tag"
                :class="[{ active: selectedSentiments.includes(sentiment) }, `sentiment-${sentiment}`]"
                @click="toggleSentiment(sentiment)"
              >
                <span class="sentiment-dot" :class="`sentiment-${sentiment}`"></span>
                {{ sentiment.charAt(0).toUpperCase() + sentiment.slice(1) }}
              </button>
              <button
                v-if="selectedSentiments.length > 0"
                type="button"
                class="filter-tag clear"
                @click="selectedSentiments = []"
              >
                ✕ Clear
              </button>
            </div>
          </div>

          <PanelCard
            title="Sentiment"
            note="From the survey that fires some days after a person's first use."
          >
            <SentimentBars v-if="health.sentiment.totalResponses > 0" :sentiment="health.sentiment" />
            <EmptyState
              v-else
              headline="No survey responses yet"
              action="The survey fires a few days after a person's first use. Submit one from Send data to see this populate, or wait for the schedule."
            />
          </PanelCard>
        </div>
      </div>

      <div class="grid-2">
        <PanelCard
          title="Reported barriers"
          note="Written answers clustered into themes. Position one is where an intervention starts."
        >
          <ThemeList v-if="health.hasThemes" :themes="reading.themes" />
          <EmptyState
            v-else
            headline="Not clustered yet"
            action="Run the embedding function to group written answers into themes. Until it runs this stays empty — it is not an error, and nothing else on this page depends on it."
          />
        </PanelCard>

        <div>
          <!-- Platform Filter -->
          <div v-if="platforms.length > 0" class="filter-bar">
            <div class="filter-bar-title">🖥️ Filter by Platform</div>
            <div class="filter-tags">
              <button
                v-for="platform in platforms"
                :key="platform"
                type="button"
                class="filter-tag"
                :class="{ active: selectedPlatforms.includes(platform) }"
                @click="togglePlatform(platform)"
              >
                {{ platform }}
              </button>
              <button
                v-if="selectedPlatforms.length > 0"
                type="button"
                class="filter-tag clear"
                @click="selectedPlatforms = []"
              >
                ✕ Clear
              </button>
            </div>
          </div>

          <PanelCard title="Platforms" :note="platformNote">
            <ul v-if="filteredPlatforms.length" class="platforms">
              <li v-for="row in filteredPlatforms" :key="row.platform">
                <span class="platforms__name">{{ row.platform }}</span>
                <span class="num">{{ formatCount(row.events) }}</span>
                <span class="platforms__unit">uses</span>
                <span class="num">{{ formatCount(row.active_users) }}</span>
                <span class="platforms__unit">people</span>
              </li>
            </ul>
            <EmptyState
              v-else
              headline="No platforms with current filters"
              action="Adjust your filters to see platform data."
            />
          </PanelCard>
        </div>
      </div>

      <PanelCard
        title="Leadership briefing"
        note="Written by the briefing agent from the figures above."
      >
        <BriefingPanel
          :briefing="reading.briefing"
          :citations="health.citations"
          :busy="busy.regenerate"
          :cooldown-remaining="regenerateCooldownRemaining"
          :can-regenerate="source === 'live'"
          @regenerate="store.regenerate()"
        />
      </PanelCard>
    </template>

    <PanelCard v-else title="No reading loaded" note="Nothing has been measured yet.">
      <EmptyState
        headline="This dashboard has no data in it"
        action="Load the sample dataset to see the instrument working with no backend at all, or open Connect to fetch or paste a live reading."
      />
      <div class="actions">
        <button type="button" class="button button--primary" @click="store.loadSample()">
          Load sample dataset
        </button>
        <RouterLink class="button" to="/connect">Open Connect</RouterLink>
      </div>
    </PanelCard>
  </div>
</template>

<style scoped>
.filter-bar {
  background: linear-gradient(135deg, #fafaf8, #f3f4f6);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: var(--step-4);
  backdrop-filter: blur(10px);
}

.filter-bar-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.filter-tag {
  padding: 8px 14px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.filter-tag:hover {
  border-color: #4f46e5;
  background: #f9f5ff;
  color: #4f46e5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
}

.filter-tag.active {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border-color: #4f46e5;
  color: white;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
}

.filter-tag.active:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.5);
}

.filter-tag.clear {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #991b1b;
  padding: 8px 12px;
}

.filter-tag.clear:hover {
  background: #fecaca;
  border-color: #f87171;
  transform: translateY(-2px);
}

.filter-tag.sentiment-positive {
  --accent-light: #dcfce7;
  --accent-main: #22c55e;
}

.filter-tag.sentiment-positive:hover:not(.active) {
  background: var(--accent-light);
  border-color: var(--accent-main);
  color: var(--accent-main);
}

.filter-tag.sentiment-neutral {
  --accent-light: #fef3c7;
  --accent-main: #f59e0b;
}

.filter-tag.sentiment-neutral:hover:not(.active) {
  background: var(--accent-light);
  border-color: var(--accent-main);
  color: var(--accent-main);
}

.filter-tag.sentiment-negative {
  --accent-light: #fee2e2;
  --accent-main: #ef4444;
}

.filter-tag.sentiment-negative:hover:not(.active) {
  background: var(--accent-light);
  border-color: var(--accent-main);
  color: var(--accent-main);
}

.sentiment-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.sentiment-positive {
  background: #22c55e;
}

.sentiment-neutral {
  background: #f59e0b;
}

.sentiment-negative {
  background: #ef4444;
}

.actions {
  display: flex;
  gap: var(--step-2);
  flex-wrap: wrap;
  margin-top: var(--step-4);
}

.actions .button {
  text-decoration: none;
}

.platforms {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--step-2);
}

.platforms li {
  display: flex;
  align-items: baseline;
  gap: var(--step-2);
  flex-wrap: wrap;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--rule);
  padding-bottom: var(--step-2);
}

.platforms__name {
  font-family: var(--font-mono);
  flex: 1;
  min-width: 12ch;
}

.platforms__unit {
  font-size: 0.6875rem;
  color: var(--ink-soft);
}
</style>

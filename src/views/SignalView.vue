<script setup lang="ts">
import { computed } from 'vue'
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

const platformNote = computed(() => {
  const platforms = reading.value?.platforms ?? []
  if (platforms.length === 0) return undefined
  return platforms
    .map((row) => `${row.platform}: ${formatCount(row.events)} uses, ${row.active_users} people`)
    .join(' · ')
})
</script>

<template>
  <div class="stack">
    <ErrorNotice v-if="error" :error="error" @dismiss="store.error = null" />

    <template v-if="reading && vitals && health">
      <KpiRow :reading="reading" :sentiment="health.sentiment" />

      <VitalSigns :vitals="vitals" />

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

        <PanelCard title="Platforms" :note="platformNote">
          <ul v-if="reading.platforms.length" class="platforms">
            <li v-for="row in reading.platforms" :key="row.platform">
              <span class="platforms__name">{{ row.platform }}</span>
              <span class="num">{{ formatCount(row.events) }}</span>
              <span class="platforms__unit">uses</span>
              <span class="num">{{ formatCount(row.active_users) }}</span>
              <span class="platforms__unit">people</span>
            </li>
          </ul>
          <EmptyState
            v-else
            headline="No platforms recorded"
            action="Events carry a platform field. Post one from Send data, or check that the SDK is setting it."
          />
        </PanelCard>
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

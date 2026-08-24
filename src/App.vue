<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTrackerStore } from '@/stores/tracker'
import { formatElapsed } from '@/lib/format'

const store = useTrackerStore()
const { reading, source, loadedAt } = storeToRefs(store)

const provenance = computed(() => {
  if (!source.value) return 'no reading'
  const age = loadedAt.value ? formatElapsed(new Date(loadedAt.value).toISOString()) : null
  return age ? `${source.value} · read ${age} ago` : source.value
})
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>

  <header class="masthead">
    <div class="masthead__id">
      <h1 class="masthead__title">Adoption Signal</h1>
      <p class="masthead__sub">
        <span class="num">{{ reading?.agent_id ?? '—' }}</span>
        <span v-if="reading" class="masthead__window">
          · {{ reading.window_days }}-day window
        </span>
      </p>
    </div>

    <nav class="nav" aria-label="Screens">
      <RouterLink to="/">Signal</RouterLink>
      <RouterLink to="/send">Send data</RouterLink>
      <RouterLink to="/connect">Connect</RouterLink>
    </nav>

    <p class="masthead__source tag" :class="source === 'live' ? 'tag--live' : ''">
      {{ provenance }}
    </p>
  </header>

  <main id="main">
    <RouterView />
  </main>

  <footer class="colophon">
    <p>
      The API key is held in memory only and is never written to browser storage — a refresh clears
      it. A key left in localStorage outlives the tab it was typed into, and nothing on screen tells
      you it is still there.
    </p>
  </footer>
</template>

<style scoped>
.skip {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--ink);
  color: var(--surface);
  padding: var(--step-2) var(--step-3);
  border-radius: var(--radius);
  z-index: 10;
}

.skip:focus {
  left: var(--step-3);
  top: var(--step-3);
}

.masthead {
  display: flex;
  align-items: center;
  gap: var(--step-3) var(--step-4);
  flex-wrap: wrap;
  padding-bottom: var(--step-4);
  margin-bottom: var(--step-5);
  border-bottom: 1px solid var(--rule);
}

.masthead__id {
  flex: 1;
  min-width: 12rem;
}

.masthead__title {
  font-size: 1.125rem;
  letter-spacing: -0.01em;
}

.masthead__sub {
  font-size: 0.75rem;
  color: var(--ink-soft);
}

.masthead__window {
  font-family: var(--font-body);
}

.nav {
  display: flex;
  gap: var(--step-1);
  flex-wrap: wrap;
}

.nav a {
  font-size: 0.8125rem;
  color: var(--ink-soft);
  text-decoration: none;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius);
  border: 1px solid transparent;
}

.nav a:hover {
  color: var(--ink);
  background: var(--surface);
}

.nav a.router-link-exact-active {
  color: var(--ink);
  background: var(--surface);
  border-color: var(--rule);
  font-weight: 500;
}

.masthead__source {
  order: 3;
}

.colophon {
  margin-top: var(--step-7);
  padding-top: var(--step-4);
  border-top: 1px solid var(--rule);
  font-size: 0.75rem;
  color: var(--ink-soft);
  max-width: 78ch;
}
</style>

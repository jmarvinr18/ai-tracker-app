<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTrackerStore } from '@/stores/tracker'
import PanelCard from '@/components/PanelCard.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import { isTrackerError, type TrackerError } from '@/api/errors'
import { SAMPLE_INSIGHTS } from '@/data/sample'

const store = useTrackerStore()
const router = useRouter()
const { config, busy, error, source } = storeToRefs(store)

const pasted = ref('')
const pasteError = ref<TrackerError | null>(null)
const healthNote = ref('')

async function fetchLive(): Promise<void> {
  await store.loadInsights()
  if (store.status === 'ready') router.push('/')
}

function readPasted(): void {
  pasteError.value = null
  try {
    store.loadPasted(pasted.value)
    router.push('/')
  } catch (cause) {
    pasteError.value = isTrackerError(cause) ? cause : null
  }
}

function loadSample(): void {
  store.loadSample()
  router.push('/')
}

function fillSampleJson(): void {
  // Round-trips the sample through the paste path so the format is visible.
  pasted.value = JSON.stringify(SAMPLE_INSIGHTS, null, 2)
  pasteError.value = null
}

async function pingHealth(): Promise<void> {
  healthNote.value = ''
  try {
    await store.checkHealth()
    healthNote.value =
      'The endpoint answered. /v1/health is unauthenticated, so this proves reachability, not that the key is right.'
  } catch (cause) {
    healthNote.value = isTrackerError(cause)
      ? `${cause.title}. ${cause.action ?? ''}`
      : 'The health check did not complete.'
  }
}
</script>

<template>
  <div class="stack">
    <ErrorNotice v-if="error" :error="error" @dismiss="store.error = null" />

    <PanelCard
      title="Connection"
      note="Where to read from. Everything except the key is remembered between sessions."
    >
      <template #actions>
        <span v-if="source" class="tag" :class="source === 'live' ? 'tag--live' : ''">
          reading: {{ source }}
        </span>
      </template>

      <div class="fields">
        <label class="field">
          <span class="label">Base URL</span>
          <input
            v-model="config.baseUrl"
            class="input"
            type="url"
            spellcheck="false"
            autocomplete="off"
            placeholder="https://vpce-xxxx.execute-api.us-east-1.vpce.amazonaws.com/develop"
          />
          <span class="field__hint">The VPC endpoint's own DNS name, including the stage.</span>
        </label>

        <label class="field">
          <span class="label">API ID</span>
          <input
            v-model="config.apiId"
            class="input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="a1b2c3d4e5"
          />
          <span class="field__hint">
            Sent as <code>x-apigw-api-id</code>. Required: private DNS is disabled, so the hostname
            names the endpoint rather than the API, and without this header the request never
            reaches it.
          </span>
        </label>

        <label class="field">
          <span class="label">API key</span>
          <input
            v-model="config.apiKey"
            class="input"
            type="password"
            spellcheck="false"
            autocomplete="off"
            placeholder="held in memory only"
          />
          <span class="field__hint">
            Never written to localStorage, sessionStorage or a cookie, so a refresh clears it. This
            is deliberate: a key in browser storage outlives the tab it was typed into, and nothing
            on screen tells you it is still there.
          </span>
        </label>

        <label class="field">
          <span class="label">Agent ID</span>
          <input
            v-model="config.agentId"
            class="input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="clarvo-rag-v1"
          />
          <span class="field__hint">Sent as <code>x-agent-id</code>.</span>
        </label>

        <label class="field">
          <span class="label">Window</span>
          <input v-model.number="config.windowDays" class="input" type="number" min="1" max="365" />
          <span class="field__hint">Days of history to request.</span>
        </label>
      </div>

      <div class="actions">
        <button
          type="button"
          class="button button--primary"
          :disabled="busy.insights"
          @click="fetchLive"
        >
          {{ busy.insights ? 'Reading…' : 'Fetch live reading' }}
        </button>
        <button type="button" class="button" :disabled="busy.health" @click="pingHealth">
          Check /v1/health
        </button>
        <button type="button" class="button" @click="store.forgetApiKey()">Forget key</button>
      </div>
      <p v-if="healthNote" class="note">{{ healthNote }}</p>

      <!--
        The API is private: the endpoint answers only from inside the VPC, and
        even with DNS resolving the browser's CORS preflight OPTIONS hits a REST
        API that defines no OPTIONS method. A browser fetch is expected to fail
        here — which is why paste mode is a first-class path, not a fallback.
      -->
      <p class="warning">
        <strong>A browser usually cannot reach this API.</strong> It answers only from inside the
        VPC, and the browser's CORS preflight <code>OPTIONS</code> is refused regardless, because
        the REST API defines no <code>OPTIONS</code> method. If the fetch above fails, nothing is
        misconfigured — use paste mode below.
      </p>
    </PanelCard>

    <PanelCard
      title="Paste a response"
      note="The path that always works. Run the call where it can be run, paste what came back."
    >
      <ErrorNotice v-if="pasteError" :error="pasteError" @dismiss="pasteError = null" />

      <label class="field">
        <span class="label">Response body</span>
        <textarea
          v-model="pasted"
          class="textarea"
          spellcheck="false"
          placeholder='{"agent_id":"clarvo-rag-v1","totals":{…}}'
        ></textarea>
        <span class="field__hint">
          Accepts the bare <code>/v1/insights</code> body, a Lambda invocation result
          (<code>{"result":{"body":"…"}}</code>), or an API Gateway proxy result
          (<code>{"body":"…"}</code>), encoded once or twice. There is no need to trim it by hand.
        </span>
      </label>

      <div class="actions">
        <button type="button" class="button button--primary" @click="readPasted">
          Read this response
        </button>
        <button type="button" class="button" @click="fillSampleJson">Fill with sample JSON</button>
        <button type="button" class="button" @click="pasted = ''">Clear</button>
      </div>

      <details class="how">
        <summary>How to get the JSON</summary>
        <p>Run this from a host inside the VPC, then paste the output above.</p>
        <pre><code>curl -s "$BASE_URL/v1/insights?days=30" \
  -H "x-api-key: $API_KEY" \
  -H "x-apigw-api-id: $API_ID" \
  -H "x-agent-id: clarvo-rag-v1"</code></pre>
        <p>A Lambda test invoke works too — its whole result can be pasted unedited.</p>
      </details>
    </PanelCard>

    <PanelCard
      title="Sample dataset"
      note="A complete reading with no backend involved, so the instrument can be understood offline."
    >
      <p class="note">
        Six divisions, five weeks, a briefing and four clustered themes. Claims is stalled in it, so
        the finding the product exists to surface is visible immediately.
      </p>
      <div class="actions">
        <button type="button" class="button button--primary" @click="loadSample">
          Load sample dataset
        </button>
        <button type="button" class="button" @click="store.clearReading()">Clear reading</button>
      </div>
    </PanelCard>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  gap: var(--step-4);
}

@media (min-width: 780px) {
  .fields {
    grid-template-columns: 1fr 1fr;
  }
}

.actions {
  display: flex;
  gap: var(--step-2);
  flex-wrap: wrap;
  margin-top: var(--step-4);
}

.note {
  font-size: 0.8125rem;
  color: var(--ink-soft);
  margin-top: var(--step-3);
  max-width: 74ch;
}

.warning {
  margin-top: var(--step-4);
  padding: var(--step-3);
  background: var(--paper);
  border-left: 3px solid var(--ink-soft);
  border-radius: var(--radius);
  font-size: 0.8125rem;
  max-width: 78ch;
}

code {
  font-size: 0.75rem;
  background: var(--paper);
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
}

.how {
  margin-top: var(--step-4);
  border-top: 1px solid var(--rule);
  padding-top: var(--step-3);
  font-size: 0.8125rem;
}

.how summary {
  cursor: pointer;
  color: var(--ink-soft);
}

.how p {
  margin-top: var(--step-2);
  color: var(--ink-soft);
}

.how pre {
  margin-top: var(--step-2);
  background: var(--ink);
  color: var(--paper);
  padding: var(--step-3);
  border-radius: var(--radius);
  overflow-x: auto;
  font-size: 0.75rem;
  line-height: 1.5;
}

.how pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}
</style>

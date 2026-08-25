<script setup lang="ts">
import { reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTrackerStore } from '@/stores/tracker'
import PanelCard from '@/components/PanelCard.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import EmptyState from '@/components/EmptyState.vue'
import { DraftError, emptyUsageDraft, suggestEventId, toUsageEvent } from '@/lib/events'
import { isTrackerError, TrackerError } from '@/api/errors'
import { formatElapsed } from '@/lib/format'
import type { FeedbackSubmission, SentimentWord } from '@/types/tracker'

const store = useTrackerStore()
const { busy, log } = storeToRefs(store)

const usage = reactive(emptyUsageDraft())
const usageError = ref<TrackerError | null>(null)

const feedback = reactive({
  acf2Id: '',
  sentiment: 'positive' as SentimentWord,
  timeSaved: '',
  barriers: '',
  valueSignals: '',
})
const feedbackError = ref<TrackerError | null>(null)
const checkResult = ref('')

function asTrackerError(cause: unknown): TrackerError {
  if (isTrackerError(cause)) return cause
  if (cause instanceof DraftError) {
    return new TrackerError({
      kind: 'shape',
      title: 'That form is not ready to send',
      detail: cause.message,
      action: 'Correct the field and send again.',
    })
  }
  return new TrackerError({
    kind: 'shape',
    title: 'The request could not be built',
    detail: cause instanceof Error ? cause.message : String(cause),
    action: 'Check the fields above.',
  })
}

async function submitUsage(): Promise<void> {
  usageError.value = null
  try {
    await store.sendUsage([toUsageEvent(usage)])
  } catch (cause) {
    usageError.value = asTrackerError(cause)
  }
}

function newEventId(): void {
  usage.eventId = suggestEventId()
}

async function runFeedbackCheck(): Promise<void> {
  feedbackError.value = null
  checkResult.value = ''
  try {
    const result = await store.checkFeedback(feedback.acf2Id.trim())
    checkResult.value = result.due
      ? `A survey is owed — ${result.questions.length} question${result.questions.length === 1 ? '' : 's'} to answer.`
      : `No survey owed: ${result.reason}`
  } catch (cause) {
    feedbackError.value = asTrackerError(cause)
  }
}

async function submitFeedback(): Promise<void> {
  feedbackError.value = null
  const acf2Id = feedback.acf2Id.trim()
  if (!acf2Id) {
    feedbackError.value = asTrackerError(new DraftError('An ACF2 ID is required.'))
    return
  }

  // `sentiment` goes as the word. A number returns 400 — the select is bound to
  // the three words so the wrong type cannot be built here in the first place.
  const submission: FeedbackSubmission = { acf2_id: acf2Id, sentiment: feedback.sentiment }
  const timeSaved = feedback.timeSaved
  if (timeSaved) {
    const parsed = Number(timeSaved)
    if (!Number.isFinite(parsed)) {
      feedbackError.value = asTrackerError(new DraftError('Time saved must be a number of hours.'))
      return
    }
    submission.time_saved = parsed
  }
  if (feedback.barriers.trim()) submission.barriers = feedback.barriers.trim()
  if (feedback.valueSignals.trim()) submission.value_signals = feedback.valueSignals.trim()

  try {
    await store.submitFeedback(submission)
  } catch (cause) {
    feedbackError.value = asTrackerError(cause)
  }
}
</script>

<template>
  <div class="stack">
    <PanelCard
      title="Record a usage event"
      note="Posts to /v1/usage. Only the ACF2 ID is required; everything else is optional."
    >
      <ErrorNotice v-if="usageError" :error="usageError" @dismiss="usageError = null" />

      <form class="fields" @submit.prevent="submitUsage">
        <label class="field">
          <span class="label">ACF2 ID *</span>
          <input v-model="usage.acf2Id" class="input" type="text" autocomplete="off" required />
          <span class="field__hint">The only field the API insists on.</span>
        </label>

        <label class="field">
          <span class="label">Event ID</span>
          <span class="with-button">
            <input v-model="usage.eventId" class="input" type="text" autocomplete="off" />
            <button type="button" class="button" @click="newEventId">New</button>
          </span>
          <span class="field__hint">
            Send the same event ID twice and the response is
            <code>{accepted: 0, duplicates: 1}</code> — a repeat is not a second use. Worth sending
            twice on stage to show it.
          </span>
        </label>

        <label class="field">
          <span class="label">Platform</span>
          <input v-model="usage.platform" class="input" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span class="label">Business group</span>
          <input v-model="usage.businessGroup" class="input" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span class="label">Division</span>
          <input v-model="usage.division" class="input" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span class="label">Event type</span>
          <input v-model="usage.eventType" class="input" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span class="label">Occurred at</span>
          <input v-model="usage.occurredAt" class="input" type="datetime-local" />
          <span class="field__hint">
            Sent as <code>occurred_at</code>. A field called <code>timestamp</code> is silently
            ignored and the event is dated to now. Leave empty to mean now on purpose.
          </span>
        </label>

        <label class="field field--wide">
          <span class="label">Metadata</span>
          <textarea
            v-model="usage.metadata"
            class="textarea metadata"
            spellcheck="false"
            placeholder='{"source":"ide"}'
          ></textarea>
          <span class="field__hint">Optional JSON object.</span>
        </label>

        <div class="actions field--wide">
          <button type="submit" class="button button--primary" :disabled="busy.send">
            {{ busy.send ? 'Sending…' : 'Send event' }}
          </button>
        </div>
      </form>
    </PanelCard>

    <PanelCard
      title="Submit a feedback response"
      note="Posts to /v1/feedback/submit, and checks whether a survey is owed."
    >
      <ErrorNotice v-if="feedbackError" :error="feedbackError" @dismiss="feedbackError = null" />

      <form class="fields" @submit.prevent="submitFeedback">
        <label class="field">
          <span class="label">ACF2 ID *</span>
          <span class="with-button">
            <input
              v-model="feedback.acf2Id"
              class="input"
              type="text"
              autocomplete="off"
              required
            />
            <button type="button" class="button" :disabled="busy.send" @click="runFeedbackCheck">
              Survey owed?
            </button>
          </span>
          <span class="field__hint">Calls /v1/feedback/check for this person.</span>
        </label>

        <label class="field">
          <span class="label">Sentiment *</span>
          <select v-model="feedback.sentiment" class="select">
            <option value="positive">positive</option>
            <option value="neutral">neutral</option>
            <option value="negative">negative</option>
          </select>
          <span class="field__hint">
            Sent as the word. A number returns 400, so this is a fixed list rather than a free
            field.
          </span>
        </label>

        <label class="field">
          <span class="label">Time saved (hours)</span>
          <input v-model="feedback.timeSaved" class="input" type="number" step="0.25" min="0" />
        </label>

        <label class="field">
          <span class="label">Barriers</span>
          <input v-model="feedback.barriers" class="input" type="text" autocomplete="off" />
          <span class="field__hint">Free text. This is what the clustering job reads.</span>
        </label>

        <label class="field field--wide">
          <span class="label">Value signals</span>
          <input v-model="feedback.valueSignals" class="input" type="text" autocomplete="off" />
        </label>

        <div class="actions field--wide">
          <button type="submit" class="button button--primary" :disabled="busy.send">
            {{ busy.send ? 'Sending…' : 'Submit response' }}
          </button>
        </div>
      </form>

      <p v-if="checkResult" class="check">{{ checkResult }}</p>
    </PanelCard>

    <PanelCard title="Response log" note="Every call this tab has made, newest first.">
      <template #actions>
        <button v-if="log.length" type="button" class="button" @click="store.clearLog()">
          Clear log
        </button>
      </template>

      <ol v-if="log.length" class="log">
        <li v-for="entry in log" :key="entry.id" class="log__row">
          <span class="tag" :class="entry.outcome === 'ok' ? 'tag--live' : 'tag--stall'">
            {{ entry.outcome }}
          </span>
          <span class="log__label">{{ entry.label }}</span>
          <span class="log__detail">{{ entry.detail }}</span>
          <span class="log__at num">{{ formatElapsed(new Date(entry.at).toISOString()) }}</span>
        </li>
      </ol>
      <EmptyState
        v-else
        headline="Nothing sent from this tab yet"
        action="Send an event or a feedback response above. Each call and its result is recorded here so a demo can be read back afterwards."
      />
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

  .field--wide {
    grid-column: 1 / -1;
  }
}

.with-button {
  display: flex;
  gap: var(--step-2);
}

.with-button .button {
  white-space: nowrap;
}

.metadata {
  min-height: 5rem;
}

.actions {
  display: flex;
  gap: var(--step-2);
  flex-wrap: wrap;
}

.check {
  margin-top: var(--step-4);
  padding: var(--step-3);
  background: var(--paper);
  border-left: 3px solid var(--ink-soft);
  border-radius: var(--radius);
  font-size: 0.8125rem;
}

code {
  font-size: 0.75rem;
  background: var(--paper);
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
}

.log {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--step-2);
}

.log__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'tag label at'
    '. detail detail';
  gap: var(--step-1) var(--step-2);
  align-items: baseline;
  border-bottom: 1px solid var(--rule);
  padding-bottom: var(--step-2);
  font-size: 0.8125rem;
}

.log__row .tag {
  grid-area: tag;
}

.log__label {
  grid-area: label;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.log__detail {
  grid-area: detail;
  color: var(--ink-soft);
  font-size: 0.75rem;
}

.log__at {
  grid-area: at;
  color: var(--ink-soft);
  font-size: 0.6875rem;
}
</style>

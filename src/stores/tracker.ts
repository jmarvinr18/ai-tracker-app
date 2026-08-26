import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/tracker'
import type { ConnectionConfig } from '@/api/tracker'
import { TrackerError, translateThrown } from '@/api/errors'
import { assertInsights, computeReadingHealth, unwrapEnvelope } from '@/lib/normalize'
import { computeVitals } from '@/lib/vitals'
import { SAMPLE_INSIGHTS } from '@/data/sample'
import type {
  FeedbackCheckResponse,
  FeedbackSubmission,
  InsightsResponse,
  ReadingSource,
  UsageEvent,
} from '@/types/tracker'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface LogEntry {
  id: number
  at: number
  label: string
  outcome: 'ok' | 'failed'
  detail: string
}

/**
 * Non-secret connection fields are restored between sessions as a convenience.
 *
 * The list is a hard-coded allow-list of four field names rather than a
 * blocklist over the config object, so no future field — least of all the key —
 * can become persisted by accident.
 */
const PERSISTED_FIELDS = ['baseUrl', 'apiId', 'agentId', 'windowDays'] as const
const STORAGE_KEY = 'adoption-signal.connection'
const REGENERATE_COOLDOWN_MS = 60_000

function loadEnvConfig(): Partial<ConnectionConfig> {
  const config: Partial<ConnectionConfig> = {}
  if (import.meta.env.VITE_API_BASE_URL) config.baseUrl = import.meta.env.VITE_API_BASE_URL
  if (import.meta.env.VITE_API_ID) config.apiId = import.meta.env.VITE_API_ID
  if (import.meta.env.VITE_API_KEY) config.apiKey = import.meta.env.VITE_API_KEY
  if (import.meta.env.VITE_AGENT_ID) config.agentId = import.meta.env.VITE_AGENT_ID
  if (import.meta.env.VITE_WINDOW_DAYS) {
    const days = parseInt(import.meta.env.VITE_WINDOW_DAYS, 10)
    if (!isNaN(days)) config.windowDays = days
  }
  return config
}

function loadPersistedConfig(): Partial<ConnectionConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const source = parsed as Record<string, unknown>
    const restored: Partial<ConnectionConfig> = {}
    if (typeof source.baseUrl === 'string') restored.baseUrl = source.baseUrl
    if (typeof source.apiId === 'string') restored.apiId = source.apiId
    if (typeof source.agentId === 'string') restored.agentId = source.agentId
    if (typeof source.windowDays === 'number') restored.windowDays = source.windowDays
    return restored
  } catch {
    return {}
  }
}

export const useTrackerStore = defineStore('tracker', () => {
  const config = reactive<ConnectionConfig>({
    baseUrl: '',
    apiId: '',
    // Never persisted, never written to storage: in memory for this tab only.
    apiKey: '',
    agentId: 'clarvo-rag-v1',
    windowDays: 30,
    ...loadEnvConfig(),
    ...loadPersistedConfig(),
  })

  const reading = ref<InsightsResponse | null>(null)
  const source = ref<ReadingSource | null>(null)
  const status = ref<LoadStatus>('idle')
  const error = ref<TrackerError | null>(null)
  const loadedAt = ref<number | null>(null)
  const regenerateReadyAt = ref(0)
  const busy = reactive({ insights: false, regenerate: false, health: false, send: false })
  const log = ref<LogEntry[]>([])

  let logSequence = 0

  function record(label: string, outcome: LogEntry['outcome'], detail: string): void {
    logSequence += 1
    log.value = [{ id: logSequence, at: Date.now(), label, outcome, detail }, ...log.value].slice(
      0,
      40,
    )
  }

  function describe(cause: unknown): TrackerError {
    return translateThrown(cause, config.baseUrl || 'the API')
  }

  function persistConfig(): void {
    try {
      const payload: Record<string, string | number> = {}
      for (const field of PERSISTED_FIELDS) payload[field] = config[field]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Storage being unavailable is not worth interrupting anyone over.
    }
  }

  function setReading(next: InsightsResponse, from: ReadingSource): void {
    reading.value = next
    source.value = from
    status.value = 'ready'
    error.value = null
    loadedAt.value = Date.now()
  }

  async function loadInsights(): Promise<void> {
    if (busy.insights) return
    busy.insights = true
    status.value = 'loading'
    error.value = null
    try {
      const next = await api.fetchInsights(config)
      setReading(next, 'live')
      persistConfig()
      record(
        'GET /v1/insights',
        'ok',
        `${next.totals.events} events, ${next.totals.active_users} users`,
      )
    } catch (cause) {
      const translated = describe(cause)
      error.value = translated
      status.value = 'error'
      record('GET /v1/insights', 'failed', translated.title)
    } finally {
      busy.insights = false
    }
  }

  function loadPasted(raw: string): void {
    try {
      const next = assertInsights(unwrapEnvelope(raw))
      setReading(next, 'pasted')
      record(
        'Pasted response',
        'ok',
        `${next.totals.events} events, ${next.totals.active_users} users`,
      )
    } catch (cause) {
      const translated = describe(cause)
      error.value = translated
      status.value = 'error'
      record('Pasted response', 'failed', translated.title)
      throw translated
    }
  }

  function loadSample(): void {
    setReading(structuredClone(SAMPLE_INSIGHTS), 'sample')
    record('Loaded sample dataset', 'ok', 'No network call was made')
  }

  function clearReading(): void {
    reading.value = null
    source.value = null
    status.value = 'idle'
    error.value = null
    loadedAt.value = null
  }

  /** Clears the key from memory without disturbing the reading on screen. */
  function forgetApiKey(): void {
    config.apiKey = ''
  }

  const regenerateCooldownRemaining = computed(() =>
    Math.max(0, regenerateReadyAt.value - Date.now()),
  )

  async function regenerate(): Promise<void> {
    if (busy.regenerate || Date.now() < regenerateReadyAt.value) return
    busy.regenerate = true
    error.value = null
    try {
      const result = await api.regenerateBriefing(config)
      // The rate limit applies to the attempt, not to its outcome — running the
      // agent is expensive whether or not it manages to answer.
      regenerateReadyAt.value = Date.now() + REGENERATE_COOLDOWN_MS
      record('POST /v1/insights/regenerate', 'ok', `status ${result.status}`)
      await loadInsights()
    } catch (cause) {
      const translated = describe(cause)
      regenerateReadyAt.value = Date.now() + REGENERATE_COOLDOWN_MS
      error.value = translated
      record('POST /v1/insights/regenerate', 'failed', translated.title)
    } finally {
      busy.regenerate = false
    }
  }

  async function checkHealth(): Promise<void> {
    busy.health = true
    try {
      const result = await api.fetchHealth(config)
      record('GET /v1/health', 'ok', `status ${result.status}`)
    } catch (cause) {
      const translated = describe(cause)
      record('GET /v1/health', 'failed', translated.title)
      throw translated
    } finally {
      busy.health = false
    }
  }

  async function sendUsage(events: UsageEvent[]): Promise<void> {
    busy.send = true
    try {
      const result = await api.sendUsage(config, events)
      record(
        'POST /v1/usage',
        'ok',
        `accepted ${result.accepted}, duplicates ${result.duplicates}` +
          (result.duplicates > 0 ? ' — a repeated event ID is not a second use' : ''),
      )
    } catch (cause) {
      const translated = describe(cause)
      record('POST /v1/usage', 'failed', translated.title)
      throw translated
    } finally {
      busy.send = false
    }
  }

  async function checkFeedback(acf2Id: string): Promise<FeedbackCheckResponse> {
    busy.send = true
    try {
      const result = await api.checkFeedback(config, acf2Id)
      record(
        'POST /v1/feedback/check',
        'ok',
        result.due
          ? `Survey owed: ${result.questions.length} questions`
          : `Not owed: ${result.reason}`,
      )
      return result
    } catch (cause) {
      const translated = describe(cause)
      record('POST /v1/feedback/check', 'failed', translated.title)
      throw translated
    } finally {
      busy.send = false
    }
  }

  async function submitFeedback(submission: FeedbackSubmission): Promise<void> {
    busy.send = true
    try {
      await api.submitFeedback(config, submission)
      record('POST /v1/feedback/submit', 'ok', `Recorded as ${submission.sentiment}`)
    } catch (cause) {
      const translated = describe(cause)
      record('POST /v1/feedback/submit', 'failed', translated.title)
      throw translated
    } finally {
      busy.send = false
    }
  }

  function clearLog(): void {
    log.value = []
  }

  const vitals = computed(() =>
    reading.value ? computeVitals(reading.value.adoption, reading.value.trend) : null,
  )

  const health = computed(() => (reading.value ? computeReadingHealth(reading.value) : null))

  const hasReading = computed(() => reading.value !== null)

  return {
    config,
    reading,
    source,
    status,
    error,
    loadedAt,
    busy,
    log,
    vitals,
    health,
    hasReading,
    regenerateCooldownRemaining,
    loadInsights,
    loadPasted,
    loadSample,
    clearReading,
    forgetApiKey,
    persistConfig,
    regenerate,
    checkHealth,
    sendUsage,
    checkFeedback,
    submitFeedback,
    clearLog,
  }
})

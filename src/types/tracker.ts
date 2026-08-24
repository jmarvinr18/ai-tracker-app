/**
 * Wire types for the adoption tracker API.
 *
 * These describe what the API actually sends, quirks included, rather than what
 * would be convenient. Normalisation into friendlier shapes happens in
 * `@/lib/normalize` so that the awkwardness stays in one place.
 */

/** Allows an unrecognised value through without widening to `string` for editors. */
type Known<T extends string> = T | (string & {})

export interface InsightsTotals {
  events: number
  active_users: number
  platforms: number
  first_event_at: string | null
  last_event_at: string | null
}

export interface AdoptionRow {
  business_group: string
  division: string
  active_users: number
  events: number
}

export interface TrendPoint {
  /** ISO date of the Monday starting the week, e.g. `2026-08-17`. */
  week: string
  active_users: number
  events: number
}

export interface PlatformRow {
  platform: string
  active_users: number
  events: number
}

export type SentimentWord = 'positive' | 'neutral' | 'negative'

export interface SentimentRow {
  /**
   * The API enforces the three words, but rows seeded before that constraint
   * exist with numeric codes. Typed as `string | number` so the mixed-encoding
   * check in `@/lib/normalize` has something honest to inspect.
   */
  sentiment: string | number
  responses: number
  /** Arrives as a string from the aggregate query, not a number. */
  avg_time_saved_hours: string | number | null
}

export interface ThemeRow {
  theme_id: string
  label: string
  member_count: number
  generated_at: string | null
}

export interface Citation {
  metric: string
  value: string | number
}

export type BriefingStatus = Known<'ok' | 'unavailable'>

export interface Briefing {
  status: BriefingStatus
  summary: string | null
  insight: string | null
  recommendation: string | null
  /**
   * `jsonb` column: an array from one code path, a JSON-encoded string from
   * another. Both shapes reach the browser; `readCitations` resolves them.
   */
  citations: Citation[] | string | null
  generated_at: string | null
}

export interface InsightsResponse {
  agent_id: string
  window_days: number
  totals: InsightsTotals
  adoption: AdoptionRow[]
  trend: TrendPoint[]
  platforms: PlatformRow[]
  sentiment: SentimentRow[]
  /** `[]` until the clustering job has run. An empty state, not an error. */
  themes: ThemeRow[]
  /** `null` until the briefing agent has run. An empty state, not an error. */
  briefing: Briefing | null
}

export interface HealthResponse {
  status: string
  [key: string]: unknown
}

export interface RegenerateResponse {
  status: Known<'ok' | 'unavailable'>
  briefing_id?: string
}

export interface UsageEvent {
  /** The only required field. */
  acf2_id: string
  event_id?: string
  platform?: string
  business_group?: string
  division?: string
  event_type?: string
  /** Named `occurred_at`, never `timestamp` — see `@/api/tracker`. */
  occurred_at?: string
  metadata?: Record<string, unknown>
}

export interface UsageResponse {
  accepted: number
  duplicates: number
  [key: string]: unknown
}

export interface FeedbackQuestion {
  id?: string
  prompt?: string
  [key: string]: unknown
}

export type FeedbackCheckResponse =
  { due: false; reason: string } | { due: true; questions: FeedbackQuestion[] }

export interface FeedbackSubmission {
  acf2_id: string
  /** Must be the word, never a code — a number returns 400. */
  sentiment: SentimentWord
  time_saved?: number
  barriers?: string
  value_signals?: string
}

export interface FeedbackSubmitResponse {
  status?: string
  [key: string]: unknown
}

/** Where the reading on screen came from. */
export type ReadingSource = 'live' | 'pasted' | 'sample'

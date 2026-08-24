import { TrackerError } from '@/api/errors'
import type {
  Briefing,
  Citation,
  InsightsResponse,
  SentimentRow,
  SentimentWord,
} from '@/types/tracker'

/** Narrowing helper: keeps `unknown` handling readable without reaching for `any`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

const MAX_UNWRAP_DEPTH = 6

/**
 * Accepts what people actually have on their clipboard.
 *
 * A response fetched from inside the VPC arrives bare. A Lambda test invoke
 * wraps it as `{result: {body: "<json>"}}`, an API Gateway proxy result as
 * `{body: "<json>"}`, and either may be double-encoded. Unwrapping here means
 * nobody has to trim JSON by hand at the moment they are least able to.
 */
export function unwrapEnvelope(raw: string): unknown {
  const text = raw.trim()
  if (!text) {
    throw new TrackerError({
      kind: 'shape',
      title: 'Nothing to read',
      detail: 'The box is empty.',
      action: 'Paste the JSON body of a GET /v1/insights call, then read it again.',
    })
  }

  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (cause) {
    throw new TrackerError({
      kind: 'shape',
      title: 'That is not valid JSON',
      detail: cause instanceof Error ? cause.message : 'The text could not be parsed.',
      action:
        'Paste the whole response, braces included. A Lambda invocation result or an API ' +
        'Gateway proxy result works as-is — there is no need to trim it.',
    })
  }

  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth += 1) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value) as unknown
        continue
      } catch {
        break
      }
    }
    if (!isRecord(value)) break
    // A payload of our own always has `totals`; stop before unwrapping past it.
    if ('totals' in value) break
    if ('result' in value) {
      value = value.result
      continue
    }
    if ('body' in value) {
      value = value.body
      continue
    }
    if ('Payload' in value) {
      value = value.Payload
      continue
    }
    break
  }

  return value
}

function readCitationList(value: unknown): Citation[] {
  return asArray(value)
    .filter(isRecord)
    .map((entry) => ({
      metric: asString(entry.metric, 'metric'),
      value: typeof entry.value === 'number' ? entry.value : asString(entry.value),
    }))
}

/**
 * `citations` is a jsonb column that one code path writes as an array and
 * another as a JSON-encoded string. Both reach the browser.
 */
export function readCitations(citations: Briefing['citations']): Citation[] {
  if (citations === null || citations === undefined) return []
  if (typeof citations === 'string') {
    const text = citations.trim()
    if (!text) return []
    try {
      return readCitationList(JSON.parse(text) as unknown)
    } catch {
      return []
    }
  }
  return readCitationList(citations)
}

function readBriefing(value: unknown): Briefing | null {
  if (!isRecord(value)) return null
  const citations = value.citations
  return {
    status: asString(value.status, 'ok'),
    summary: asNullableString(value.summary),
    insight: asNullableString(value.insight),
    recommendation: asNullableString(value.recommendation),
    citations:
      typeof citations === 'string' || Array.isArray(citations)
        ? (citations as Briefing['citations'])
        : null,
    generated_at: asNullableString(value.generated_at),
  }
}

/**
 * Validates and coerces an unknown payload into `InsightsResponse`.
 *
 * Coercion is deliberate: the API is the source of truth for the numbers, but
 * it is inconsistent about their JSON types, and a dashboard that throws on a
 * stringified integer is worse than one that reads it.
 */
export function assertInsights(value: unknown): InsightsResponse {
  if (!isRecord(value)) {
    throw new TrackerError({
      kind: 'shape',
      title: 'That is not an insights payload',
      detail: `Expected a JSON object, got ${Array.isArray(value) ? 'an array' : typeof value}.`,
      action: 'Paste the response from GET /v1/insights?days=30.',
    })
  }

  if (!isRecord(value.totals)) {
    const keys = Object.keys(value).slice(0, 8).join(', ')
    throw new TrackerError({
      kind: 'shape',
      title: 'That payload has no totals block',
      detail: keys
        ? `Read an object with these keys instead: ${keys}.`
        : 'Read an object with no keys at all.',
      action:
        'This is the response from GET /v1/insights, not from /v1/health or a metrics route. ' +
        'Paste the insights response, or load the sample dataset to see the expected shape.',
    })
  }

  const totals = value.totals

  return {
    agent_id: asString(value.agent_id, 'unknown-agent'),
    window_days: asNumber(value.window_days, 30),
    totals: {
      events: asNumber(totals.events),
      active_users: asNumber(totals.active_users),
      platforms: asNumber(totals.platforms),
      first_event_at: asNullableString(totals.first_event_at),
      last_event_at: asNullableString(totals.last_event_at),
    },
    adoption: asArray(value.adoption)
      .filter(isRecord)
      .map((row) => ({
        business_group: asString(row.business_group, 'Unassigned'),
        division: asString(row.division, 'Unassigned'),
        active_users: asNumber(row.active_users),
        events: asNumber(row.events),
      })),
    trend: asArray(value.trend)
      .filter(isRecord)
      .map((row) => ({
        week: asString(row.week),
        active_users: asNumber(row.active_users),
        events: asNumber(row.events),
      })),
    platforms: asArray(value.platforms)
      .filter(isRecord)
      .map((row) => ({
        platform: asString(row.platform, 'unknown'),
        active_users: asNumber(row.active_users),
        events: asNumber(row.events),
      })),
    sentiment: asArray(value.sentiment)
      .filter(isRecord)
      .map((row) => ({
        // Left as sent: the encoding is the thing being inspected downstream.
        sentiment:
          typeof row.sentiment === 'number' ? row.sentiment : asString(row.sentiment, 'unknown'),
        responses: asNumber(row.responses),
        avg_time_saved_hours:
          typeof row.avg_time_saved_hours === 'string' ||
          typeof row.avg_time_saved_hours === 'number'
            ? row.avg_time_saved_hours
            : null,
      })),
    themes: asArray(value.themes)
      .filter(isRecord)
      .map((row) => ({
        theme_id: asString(row.theme_id),
        label: asString(row.label, 'Unlabelled theme'),
        member_count: asNumber(row.member_count),
        generated_at: asNullableString(row.generated_at),
      })),
    briefing: readBriefing(value.briefing),
  }
}

/** `avg_time_saved_hours` arrives as a string from the aggregate query. */
export function readHours(value: SentimentRow['avg_time_saved_hours']): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const SENTIMENT_WORDS: readonly SentimentWord[] = ['positive', 'neutral', 'negative']

export interface SentimentReading {
  /** Rows whose sentiment is one of the three words the API enforces. */
  words: { word: SentimentWord; responses: number; hours: number | null }[]
  /** Rows written as numeric codes, before the API enforced words. */
  codes: { code: string; responses: number; hours: number | null }[]
  /** Anything that is neither. */
  other: { label: string; responses: number; hours: number | null }[]
  /**
   * True when both encodings are present. The two do not aggregate — a numeric
   * `1` cannot be assumed to mean `positive` — so the UI says so rather than
   * drawing a chart that silently drops or mislabels half the responses.
   */
  mixedEncoding: boolean
  wordResponses: number
  codeResponses: number
  totalResponses: number
}

export function readSentiment(rows: SentimentRow[]): SentimentReading {
  const reading: SentimentReading = {
    words: [],
    codes: [],
    other: [],
    mixedEncoding: false,
    wordResponses: 0,
    codeResponses: 0,
    totalResponses: 0,
  }

  for (const row of rows) {
    const hours = readHours(row.avg_time_saved_hours)
    const responses = row.responses
    const raw = typeof row.sentiment === 'number' ? String(row.sentiment) : row.sentiment.trim()
    const lowered = raw.toLowerCase()

    if ((SENTIMENT_WORDS as readonly string[]).includes(lowered)) {
      reading.words.push({ word: lowered as SentimentWord, responses, hours })
      reading.wordResponses += responses
    } else if (raw !== '' && Number.isFinite(Number(raw))) {
      reading.codes.push({ code: raw, responses, hours })
      reading.codeResponses += responses
    } else {
      reading.other.push({ label: raw || 'unlabelled', responses, hours })
    }
    reading.totalResponses += responses
  }

  // Order the words consistently rather than however the GROUP BY returned them.
  reading.words.sort((a, b) => SENTIMENT_WORDS.indexOf(a.word) - SENTIMENT_WORDS.indexOf(b.word))
  reading.codes.sort((a, b) => Number(b.code) - Number(a.code))
  reading.mixedEncoding = reading.words.length > 0 && reading.codes.length > 0

  return reading
}

export interface ReadingHealth {
  sentiment: SentimentReading
  citations: Citation[]
  hasThemes: boolean
  hasBriefing: boolean
  /** The agent answered but could not produce a briefing this run. */
  briefingUnavailable: boolean
}

/** The derived facts every screen needs, computed once per reading. */
export function computeReadingHealth(reading: InsightsResponse): ReadingHealth {
  const briefing = reading.briefing
  return {
    sentiment: readSentiment(reading.sentiment),
    citations: briefing ? readCitations(briefing.citations) : [],
    hasThemes: reading.themes.length > 0,
    hasBriefing: briefing !== null && briefing.status === 'ok',
    briefingUnavailable: briefing !== null && briefing.status !== 'ok',
  }
}

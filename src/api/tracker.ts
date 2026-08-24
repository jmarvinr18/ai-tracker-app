import { TrackerError, translateThrown } from './errors'
import type {
  AdoptionRow,
  FeedbackCheckResponse,
  FeedbackSubmission,
  FeedbackSubmitResponse,
  HealthResponse,
  InsightsResponse,
  RegenerateResponse,
  ThemeRow,
  TrendPoint,
  UsageEvent,
  UsageResponse,
} from '@/types/tracker'
import { assertInsights } from '@/lib/normalize'

export interface ConnectionConfig {
  /** e.g. https://vpce-xxxx.execute-api.us-east-1.vpce.amazonaws.com/develop */
  baseUrl: string
  /** Sent as `x-apigw-api-id`. */
  apiId: string
  /** Sent as `x-api-key`. Held in memory only — never written to storage. */
  apiKey: string
  /** Sent as `x-agent-id`, e.g. clarvo-rag-v1. */
  agentId: string
  windowDays: number
}

const REQUEST_TIMEOUT_MS = 20_000

interface RequestOptions {
  method?: 'GET' | 'POST'
  /** `/v1/health` is the only unauthenticated route. */
  authenticated?: boolean
  query?: Record<string, string | number | undefined>
  body?: unknown
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function buildUrl(config: ConnectionConfig, path: string, query: RequestOptions['query']): string {
  const base = trimTrailingSlash(config.baseUrl.trim())
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return `${base}${path}${qs ? `?${qs}` : ''}`
}

/**
 * The API is private and its VPC endpoint has private DNS disabled, so the
 * hostname belongs to the endpoint rather than to the API. `x-apigw-api-id` is
 * what tells API Gateway which API is being addressed — without it the request
 * is rejected at the front door and never reaches the backend.
 */
function buildHeaders(config: ConnectionConfig, options: RequestOptions): HeadersInit {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (config.apiId.trim()) headers['x-apigw-api-id'] = config.apiId.trim()
  if (config.agentId.trim()) headers['x-agent-id'] = config.agentId.trim()
  if (options.authenticated !== false && config.apiKey) headers['x-api-key'] = config.apiKey
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  return headers
}

function requireConfig(config: ConnectionConfig, options: RequestOptions): void {
  if (!config.baseUrl.trim()) {
    throw new TrackerError({
      kind: 'config',
      title: 'Set a base URL first',
      detail: 'No endpoint has been entered, so there is nothing to call.',
      action: 'Open Connect and enter the VPC endpoint URL, or load the sample dataset.',
    })
  }
  if (!config.apiId.trim()) {
    throw new TrackerError({
      kind: 'config',
      title: 'Set the API ID first',
      detail:
        'The endpoint host is shared by every private API in the region. Without ' +
        'x-apigw-api-id the gateway cannot tell which API the call is for.',
      action: 'Open Connect and enter the API ID.',
    })
  }
  if (options.authenticated !== false && !config.apiKey) {
    throw new TrackerError({
      kind: 'config',
      title: 'Enter an API key first',
      detail: 'Every route except /v1/health needs x-api-key.',
      action: 'Open Connect and paste the key. It is held in memory only, so a refresh clears it.',
    })
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function describeBody(body: unknown): string {
  if (body === null) return 'no body'
  if (typeof body === 'string') return body.slice(0, 400)
  return JSON.stringify(body).slice(0, 400)
}

async function request<T>(
  config: ConnectionConfig,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  requireConfig(config, options)
  const url = buildUrl(config, path, options.query)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: buildHeaders(config, options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })
  } catch (cause) {
    throw translateThrown(cause, config.baseUrl)
  } finally {
    clearTimeout(timer)
  }

  const body = await readBody(response)

  if (response.status === 503) {
    throw new TrackerError({
      kind: 'unavailable',
      title: 'The agent could not produce a briefing',
      detail: `${path} returned 503 with ${describeBody(body)}`,
      action: 'Try again in a minute. The cached briefing on screen is unchanged.',
      status: 503,
    })
  }

  if (response.status === 401 || response.status === 403) {
    throw new TrackerError({
      kind: 'auth',
      title: 'The API rejected the key',
      detail:
        `${path} returned ${response.status}. The request did reach the gateway, so the ` +
        'endpoint and API ID are right — the key or its usage plan is not.',
      action: 'Check the key in Connect, and that it is enabled for this API stage.',
      status: response.status,
    })
  }

  if (!response.ok) {
    throw new TrackerError({
      kind: 'http',
      title: `The API returned ${response.status}`,
      detail: `${path} responded with ${describeBody(body)}`,
      action:
        response.status === 400
          ? 'Check the field names and value types in the request — the API validates strictly.'
          : 'Retry, then check the API logs for this request if it repeats.',
      status: response.status,
    })
  }

  return body as T
}

export function fetchInsights(config: ConnectionConfig): Promise<InsightsResponse> {
  return request<unknown>(config, '/v1/insights', {
    query: { days: config.windowDays },
  }).then(assertInsights)
}

export function fetchHealth(config: ConnectionConfig): Promise<HealthResponse> {
  return request<HealthResponse>(config, '/v1/health', { authenticated: false })
}

export function fetchAdoption(config: ConnectionConfig): Promise<AdoptionRow[]> {
  return request<AdoptionRow[]>(config, '/v1/metrics/adoption', {
    query: { days: config.windowDays },
  })
}

export function fetchTrend(config: ConnectionConfig): Promise<TrendPoint[]> {
  return request<TrendPoint[]>(config, '/v1/metrics/trend', {
    query: { days: config.windowDays },
  })
}

export function fetchThemes(config: ConnectionConfig): Promise<ThemeRow[]> {
  return request<ThemeRow[]>(config, '/v1/themes')
}

export function regenerateBriefing(config: ConnectionConfig): Promise<RegenerateResponse> {
  return request<RegenerateResponse>(config, '/v1/insights/regenerate', {
    method: 'POST',
    body: {},
  })
}

/**
 * The timestamp field is `occurred_at`. A field called `timestamp` is silently
 * ignored and the event is dated to now, which stays invisible until someone
 * tries to explain a trend line. `@/lib/events` is the only place that name is
 * written, so it can only be got wrong once.
 */
export function sendUsage(config: ConnectionConfig, events: UsageEvent[]): Promise<UsageResponse> {
  return request<UsageResponse>(config, '/v1/usage', { method: 'POST', body: { events } })
}

export function checkFeedback(
  config: ConnectionConfig,
  acf2Id: string,
): Promise<FeedbackCheckResponse> {
  return request<FeedbackCheckResponse>(config, '/v1/feedback/check', {
    method: 'POST',
    body: { acf2_id: acf2Id },
  })
}

/** `sentiment` is a word by construction here — the API returns 400 for a number. */
export function submitFeedback(
  config: ConnectionConfig,
  submission: FeedbackSubmission,
): Promise<FeedbackSubmitResponse> {
  return request<FeedbackSubmitResponse>(config, '/v1/feedback/submit', {
    method: 'POST',
    body: submission,
  })
}

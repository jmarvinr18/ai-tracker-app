/**
 * Errors carry what to do next, not just what went wrong.
 *
 * `fetch` rejects with an indistinguishable `TypeError` whether the host was
 * unreachable or a CORS preflight was blocked, so `kind: 'blocked'` deliberately
 * names both possibilities instead of picking one and sending someone hunting
 * for a key that was never wrong.
 */
export type TrackerErrorKind =
  | 'config' // something the operator has not filled in yet
  | 'blocked' // request never reached the API: DNS, VPC or CORS preflight
  | 'auth' // 401 / 403
  | 'http' // any other non-2xx
  | 'shape' // reached the API, got something that is not an insights payload
  | 'unavailable' // the agent answered, but could not do the work (503)

export interface TrackerErrorInit {
  kind: TrackerErrorKind
  /** One line, imperative, no apology. */
  title: string
  /** What is known. */
  detail: string
  /** The next action to take. */
  action?: string
  status?: number
}

export class TrackerError extends Error {
  readonly kind: TrackerErrorKind
  readonly title: string
  readonly detail: string
  readonly action?: string
  readonly status?: number

  constructor(init: TrackerErrorInit) {
    super(init.title)
    this.name = 'TrackerError'
    this.kind = init.kind
    this.title = init.title
    this.detail = init.detail
    this.action = init.action
    this.status = init.status
  }
}

export function isTrackerError(value: unknown): value is TrackerError {
  return value instanceof TrackerError
}

/**
 * The ambiguous failure. Both causes produce the same `TypeError`, so both get
 * named and the reader is pointed at the path that always works.
 */
export function blockedError(baseUrl: string): TrackerError {
  return new TrackerError({
    kind: 'blocked',
    title: 'The request never reached the API',
    detail:
      `The browser could not complete a call to ${baseUrl}. This is one of three things, ` +
      'and the browser reports all three identically: the VPC endpoint host does not resolve ' +
      'or is not reachable from this network; or the CORS preflight OPTIONS request was ' +
      'refused, because the REST API defines no OPTIONS method. The API key is not implicated ' +
      '— a wrong key returns 403, which looks nothing like this.',
    action:
      'Fetch /v1/insights from inside the VPC (curl, or a Lambda test invoke) and paste the ' +
      'response into Connect → Paste a response. The dashboard renders it identically.',
  })
}

/** Turns anything thrown by `fetch` into something a reader can act on. */
export function translateThrown(cause: unknown, baseUrl: string): TrackerError {
  if (isTrackerError(cause)) return cause
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return new TrackerError({
      kind: 'blocked',
      title: 'The request timed out',
      detail:
        `No response from ${baseUrl} before the timeout. A private endpoint that is not ` +
        'reachable from this network usually hangs rather than refusing outright.',
      action: 'Use Connect → Paste a response, or run the call from inside the VPC.',
    })
  }
  // TypeError is what fetch throws for DNS, connection and CORS failures alike.
  return blockedError(baseUrl)
}

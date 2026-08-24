/** Formatting for telemetry: compact, unambiguous, and never rounded into a lie. */

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return integer.format(value)
}

export function formatRatio(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}h`
}

/**
 * Elapsed time, compact: `40m`, `6h`, `3d`.
 *
 * A leadership dashboard asks "is this thing still being used", and a timestamp
 * makes the reader do the subtraction themselves.
 */
export function formatElapsed(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return '—'

  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 90) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

/** Absolute timestamp, for the title attribute behind an elapsed figure. */
export function formatTimestamp(iso: string | null): string {
  if (!iso) return 'No timestamp recorded'
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso
  return new Date(parsed).toLocaleString()
}

/** `2026-08-17` → `17 Aug`, for axis and bar labels. */
export function formatWeek(week: string): string {
  const parsed = Date.parse(week)
  if (!Number.isFinite(parsed)) return week
  return new Date(parsed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Joins names the way a sentence needs them: `A`, `A and B`, `A, B and C`. */
export function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0] ?? ''
  const head = items.slice(0, -1).join(', ')
  const tail = items[items.length - 1] ?? ''
  return `${head} and ${tail}`
}

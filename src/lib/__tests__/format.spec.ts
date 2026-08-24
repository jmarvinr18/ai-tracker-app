import { describe, it, expect } from 'vitest'

import { formatElapsed, formatList, formatRatio } from '../format'
import { toUsageEvent } from '../events'
import { emptyUsageDraft } from '../events'

const NOW = Date.parse('2026-08-24T12:00:00Z')

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

describe('formatElapsed', () => {
  it('reads as compact elapsed time, not as a timestamp', () => {
    expect(formatElapsed(ago(40 * 60_000), NOW)).toBe('40m')
    expect(formatElapsed(ago(6 * 3_600_000), NOW)).toBe('6h')
    expect(formatElapsed(ago(3 * 86_400_000), NOW)).toBe('3d')
    expect(formatElapsed(ago(45_000), NOW)).toBe('45s')
  })

  it('shows an em dash rather than NaN when there is no timestamp', () => {
    expect(formatElapsed(null, NOW)).toBe('—')
    expect(formatElapsed('not a date', NOW)).toBe('—')
  })
})

describe('formatList', () => {
  it('joins names the way a sentence needs them', () => {
    expect(formatList([])).toBe('')
    expect(formatList(['Claims'])).toBe('Claims')
    expect(formatList(['Claims', 'Operations'])).toBe('Claims and Operations')
    expect(formatList(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('formatRatio', () => {
  it('keeps one decimal so 6.6 and 6.61 do not both read as 7', () => {
    expect(formatRatio(119 / 18)).toBe('6.6')
    expect(formatRatio(Number.NaN)).toBe('—')
  })
})

describe('toUsageEvent', () => {
  it('sends the timestamp as occurred_at, never as timestamp', () => {
    const draft = { ...emptyUsageDraft(), acf2Id: 'ab1234', occurredAt: '2026-08-01T09:30' }
    const event = toUsageEvent(draft)

    expect(event.occurred_at).toBeTypeOf('string')
    expect(Object.keys(event)).not.toContain('timestamp')
  })

  it('omits the timestamp entirely when it is left blank', () => {
    const event = toUsageEvent({ ...emptyUsageDraft(), acf2Id: 'ab1234' })
    expect(event.occurred_at).toBeUndefined()
  })

  it('insists on the one field the API insists on', () => {
    expect(() => toUsageEvent(emptyUsageDraft())).toThrowError(/ACF2 ID is required/)
  })

  it('rejects metadata that is not a JSON object', () => {
    const draft = { ...emptyUsageDraft(), acf2Id: 'ab1234', metadata: '[1,2]' }
    expect(() => toUsageEvent(draft)).toThrowError(/JSON object/)
  })
})

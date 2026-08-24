import { describe, it, expect } from 'vitest'

import {
  assertInsights,
  readCitations,
  readHours,
  readSentiment,
  unwrapEnvelope,
} from '../normalize'
import { SAMPLE_INSIGHTS } from '@/data/sample'
import type { SentimentRow } from '@/types/tracker'

const bare = JSON.stringify(SAMPLE_INSIGHTS)

describe('unwrapEnvelope', () => {
  it('reads a bare response body', () => {
    expect(assertInsights(unwrapEnvelope(bare)).agent_id).toBe('clarvo-rag-v1')
  })

  it('reads a Lambda invocation result', () => {
    const wrapped = JSON.stringify({ result: { body: bare } })
    expect(assertInsights(unwrapEnvelope(wrapped)).totals.events).toBe(
      SAMPLE_INSIGHTS.totals.events,
    )
  })

  it('reads an API Gateway proxy result', () => {
    const wrapped = JSON.stringify({ statusCode: 200, body: bare })
    expect(assertInsights(unwrapEnvelope(wrapped)).totals.active_users).toBe(74)
  })

  it('reads a double-encoded body', () => {
    const wrapped = JSON.stringify({ result: { body: JSON.stringify(bare) } })
    expect(assertInsights(unwrapEnvelope(wrapped)).adoption).toHaveLength(6)
  })

  it('explains an empty box instead of throwing something opaque', () => {
    expect(() => unwrapEnvelope('   ')).toThrowError(/Nothing to read/)
  })

  it('explains invalid JSON', () => {
    expect(() => unwrapEnvelope('{not json')).toThrowError(/not valid JSON/)
  })
})

describe('assertInsights', () => {
  it('names what was pasted when it is the wrong payload', () => {
    const health = JSON.stringify({ status: 'ok', version: '1.4.0' })
    expect(() => assertInsights(unwrapEnvelope(health))).toThrowError(/no totals block/)
  })

  it('treats empty themes and a null briefing as normal, not as an error', () => {
    const dayOne = assertInsights({ ...SAMPLE_INSIGHTS, themes: [], briefing: null })
    expect(dayOne.themes).toEqual([])
    expect(dayOne.briefing).toBeNull()
  })

  it('coerces stringified numbers rather than refusing the payload', () => {
    const reading = assertInsights({
      totals: { events: '2580', active_users: 74, platforms: 1 },
      trend: [{ week: '2026-08-17', active_users: '56', events: '418' }],
    })

    expect(reading.totals.events).toBe(2580)
    expect(reading.trend[0]?.active_users).toBe(56)
  })

  it('keeps a briefing whose status is unavailable', () => {
    const reading = assertInsights({
      totals: { events: 0, active_users: 0, platforms: 0 },
      briefing: { status: 'unavailable', summary: null },
    })

    expect(reading.briefing?.status).toBe('unavailable')
  })
})

describe('readCitations', () => {
  it('reads citations sent as an array', () => {
    expect(readCitations([{ metric: 'a', value: '1' }])).toEqual([{ metric: 'a', value: '1' }])
  })

  it('reads citations sent as a JSON string from the other code path', () => {
    expect(readCitations('[{"metric":"a","value":"1"}]')).toEqual([{ metric: 'a', value: '1' }])
  })

  it('returns nothing rather than throwing on a null or unreadable column', () => {
    expect(readCitations(null)).toEqual([])
    expect(readCitations('not json')).toEqual([])
  })
})

describe('readHours', () => {
  it('reads the string the aggregate query returns', () => {
    expect(readHours('4.02')).toBe(4.02)
    expect(readHours(4.02)).toBe(4.02)
    expect(readHours(null)).toBeNull()
    expect(readHours('n/a')).toBeNull()
  })
})

describe('readSentiment', () => {
  it('orders the words consistently regardless of the GROUP BY order', () => {
    const rows: SentimentRow[] = [
      { sentiment: 'negative', responses: 2, avg_time_saved_hours: '0.25' },
      { sentiment: 'positive', responses: 6, avg_time_saved_hours: '4.02' },
    ]
    expect(readSentiment(rows).words.map((row) => row.word)).toEqual(['positive', 'negative'])
  })

  it('does not flag a mix when only words are present', () => {
    expect(readSentiment(SAMPLE_INSIGHTS.sentiment).mixedEncoding).toBe(false)
  })

  it('flags both encodings present and keeps their totals apart', () => {
    const rows: SentimentRow[] = [
      { sentiment: 'positive', responses: 6, avg_time_saved_hours: '4.02' },
      { sentiment: 1, responses: 4, avg_time_saved_hours: '2.00' },
      { sentiment: '-1', responses: 3, avg_time_saved_hours: null },
    ]
    const reading = readSentiment(rows)

    expect(reading.mixedEncoding).toBe(true)
    expect(reading.wordResponses).toBe(6)
    expect(reading.codeResponses).toBe(7)
    expect(reading.totalResponses).toBe(13)
  })

  it('sets aside a value that is neither a word nor a number', () => {
    const rows: SentimentRow[] = [{ sentiment: 'meh', responses: 1, avg_time_saved_hours: null }]
    const reading = readSentiment(rows)

    expect(reading.other).toHaveLength(1)
    expect(reading.mixedEncoding).toBe(false)
  })
})

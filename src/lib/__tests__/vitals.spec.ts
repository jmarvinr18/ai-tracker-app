import { describe, it, expect } from 'vitest'

import { computeVitals, STALL_INTENSITY } from '../vitals'
import { SAMPLE_INSIGHTS } from '@/data/sample'
import type { AdoptionRow, TrendPoint } from '@/types/tracker'

const trend: TrendPoint[] = [
  { week: '2026-07-27', active_users: 34, events: 486 },
  { week: '2026-08-03', active_users: 49, events: 690 },
  { week: '2026-08-10', active_users: 61, events: 746 },
]

describe('computeVitals', () => {
  it('ranks by uses per person, not by event volume', () => {
    const { divisions } = computeVitals(SAMPLE_INSIGHTS.adoption, SAMPLE_INSIGHTS.trend)

    // Engineering has the most events; DevSecOps has the highest intensity.
    expect(divisions[0]?.division).toBe('DevSecOps')
    expect(divisions[1]?.division).toBe('Engineering')
  })

  it('flags a division that many people tried and stopped using', () => {
    const { stalled } = computeVitals(SAMPLE_INSIGHTS.adoption, SAMPLE_INSIGHTS.trend)
    expect(stalled.map((entry) => entry.division)).toEqual(['Claims'])
  })

  it('sorts stalled divisions last so they read as the conclusion', () => {
    const { divisions } = computeVitals(SAMPLE_INSIGHTS.adoption, SAMPLE_INSIGHTS.trend)
    expect(divisions[divisions.length - 1]?.division).toBe('Claims')
  })

  it('does not report one curious person as a division in trouble', () => {
    const rows: AdoptionRow[] = [
      { business_group: 'Benefits', division: 'Actuarial', active_users: 4, events: 8 },
    ]
    const { divisions, stalled } = computeVitals(rows, trend)

    expect(stalled).toHaveLength(0)
    expect(divisions[0]?.belowReportingFloor).toBe(true)
    expect(divisions[0]?.intensity).toBeLessThan(STALL_INTENSITY)
  })

  it('sums divisions that appear under more than one business group', () => {
    const rows: AdoptionRow[] = [
      { business_group: 'SLGS', division: 'Engineering', active_users: 10, events: 500 },
      { business_group: 'Corporate', division: 'Engineering', active_users: 5, events: 100 },
    ]
    const [engineering] = computeVitals(rows, trend).divisions

    expect(engineering?.activeUsers).toBe(15)
    expect(engineering?.events).toBe(600)
    expect(engineering?.businessGroups).toEqual(['SLGS', 'Corporate'])
  })

  it('distributes a division total across the window without inventing events', () => {
    const rows: AdoptionRow[] = [
      { business_group: 'SLGS', division: 'Engineering', active_users: 10, events: 600 },
    ]
    const [engineering] = computeVitals(rows, trend).divisions
    const total = (engineering?.pulse ?? []).reduce((carry, value) => carry + value, 0)

    expect(engineering?.pulse).toHaveLength(trend.length)
    expect(total).toBeCloseTo(600, 6)
  })

  it('leans a stalled pulse towards its earlier weeks', () => {
    const rows: AdoptionRow[] = [
      { business_group: 'Benefits', division: 'Claims', active_users: 18, events: 119 },
    ]
    const [claims] = computeVitals(rows, trend).divisions
    const pulse = claims?.pulse ?? []

    expect(claims?.stalled).toBe(true)
    expect(pulse[0] ?? 0).toBeGreaterThan(pulse[pulse.length - 1] ?? 0)
  })

  it('survives a division with no users rather than dividing by zero', () => {
    const rows: AdoptionRow[] = [
      { business_group: 'SLGS', division: 'Ghost', active_users: 0, events: 0 },
    ]
    const [ghost] = computeVitals(rows, trend).divisions

    expect(ghost?.intensity).toBe(0)
    expect(ghost?.stalled).toBe(false)
  })

  it('returns an empty pulse when there is no trend to distribute across', () => {
    const rows: AdoptionRow[] = [
      { business_group: 'SLGS', division: 'Engineering', active_users: 10, events: 600 },
    ]
    const { divisions, weeks } = computeVitals(rows, [])

    expect(weeks).toEqual([])
    expect(divisions[0]?.pulse).toEqual([])
  })
})

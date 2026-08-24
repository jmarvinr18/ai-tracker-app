import type { AdoptionRow, TrendPoint } from '@/types/tracker'

/**
 * Uses per person below this reads as "tried it and stopped" rather than
 * "adopted it lightly".
 */
export const STALL_INTENSITY = 12

/**
 * A division needs at least this many users before the stall flag means
 * anything. Without the minimum, one curious person with two events gets
 * reported to leadership as a division in trouble.
 */
export const STALL_MIN_USERS = 5

export interface DivisionVitals {
  division: string
  /** Every business group contributing rows to this division. */
  businessGroups: string[]
  activeUsers: number
  events: number
  /** events / active_users — the finding. Not the event count. */
  intensity: number
  stalled: boolean
  /**
   * True when intensity is low but the user count is below the minimum, so no
   * claim is being made either way. Shown as neutral, never as alert.
   */
  belowReportingFloor: boolean
  /** Inferred weekly shape — see `buildPulse`. */
  pulse: number[]
}

export interface VitalsReading {
  divisions: DivisionVitals[]
  stalled: DivisionVitals[]
  weeks: string[]
  /** Whether `pulse` is measured per division or inferred from the overall curve. */
  pulseIsInferred: boolean
}

/**
 * The week-by-week shape *within* a division is inferred, not measured.
 *
 * `/v1/insights` returns one overall trend for the whole agent — there is no
 * per-division series in the payload. What is measured here is each division's
 * total events, its user count, and therefore its intensity and stall flag;
 * those numbers are real. The bars distribute that real total across the weeks
 * of the overall curve, and lean the distribution towards the earlier weeks for
 * a stalled division, because a stalled division is by definition one whose
 * usage fell away rather than one that never started.
 *
 * So: the height comparison between two bars in the same row is indicative, and
 * the row's total, ratio and colour are measured. The bars are a sparkline for
 * the shape of the finding, not evidence for it.
 *
 * FOLLOW-UP: the honest fix is server-side — add a `GROUP BY division, week`
 * query behind `/v1/metrics/trend?by=division` and plot the real series. That
 * is a small query change and it removes this inference entirely. Until then
 * this stays labelled as inferred in the UI rather than passing for measured.
 */
function buildPulse(weights: number[], totalEvents: number, stalled: boolean): number[] {
  if (weights.length === 0 || totalEvents <= 0) return []

  // Lean a stalled division's distribution towards its earlier weeks. 1 → 0.25
  // across the window; healthy divisions keep the overall curve's own shape.
  const leaned = weights.map((weight, index) => {
    if (!stalled || weights.length < 2) return weight
    const position = index / (weights.length - 1)
    return weight * (1 - 0.75 * position)
  })

  const sum = leaned.reduce((carry, weight) => carry + weight, 0)
  if (sum <= 0) return weights.map(() => 0)
  return leaned.map((weight) => (weight / sum) * totalEvents)
}

export function computeVitals(adoption: AdoptionRow[], trend: TrendPoint[]): VitalsReading {
  const byDivision = new Map<string, DivisionVitals>()

  for (const row of adoption) {
    const key = row.division || 'Unassigned'
    const existing = byDivision.get(key)
    if (existing) {
      existing.activeUsers += row.active_users
      existing.events += row.events
      if (row.business_group && !existing.businessGroups.includes(row.business_group)) {
        existing.businessGroups.push(row.business_group)
      }
    } else {
      byDivision.set(key, {
        division: key,
        businessGroups: row.business_group ? [row.business_group] : [],
        activeUsers: row.active_users,
        events: row.events,
        intensity: 0,
        stalled: false,
        belowReportingFloor: false,
        pulse: [],
      })
    }
  }

  const weeks = trend.map((point) => point.week)
  // Weight each week by the overall curve. Fall back to a flat distribution if
  // the trend has no event counts, so a row still renders as a shape.
  const rawWeights = trend.map((point) => (point.events > 0 ? point.events : point.active_users))
  const weightTotal = rawWeights.reduce((carry, weight) => carry + weight, 0)
  const weights = weightTotal > 0 ? rawWeights : rawWeights.map(() => 1)

  const divisions = [...byDivision.values()].map((entry) => {
    const intensity = entry.activeUsers > 0 ? entry.events / entry.activeUsers : 0
    const lowIntensity = intensity < STALL_INTENSITY && entry.activeUsers > 0
    const stalled = lowIntensity && entry.activeUsers >= STALL_MIN_USERS
    return {
      ...entry,
      intensity,
      stalled,
      belowReportingFloor: lowIntensity && entry.activeUsers < STALL_MIN_USERS,
      pulse: buildPulse(weights, entry.events, stalled),
    }
  })

  // Healthy divisions first, each group ranked by intensity, so the stalled rows
  // land at the bottom and read as the conclusion of the strip.
  divisions.sort((a, b) => {
    if (a.stalled !== b.stalled) return a.stalled ? 1 : -1
    return b.intensity - a.intensity
  })

  return {
    divisions,
    stalled: divisions.filter((entry) => entry.stalled),
    weeks,
    pulseIsInferred: true,
  }
}

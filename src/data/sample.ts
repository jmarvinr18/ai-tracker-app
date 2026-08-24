import type { InsightsResponse } from '@/types/tracker'

/**
 * A complete reading, so the dashboard can be opened and understood with no
 * backend at all — which is the normal case, since the API is private.
 *
 * The division ratios reproduce the shape the product exists to surface: Claims
 * has the second-largest group of users and by far the lowest engagement.
 * Actuarial sits below the five-user reporting floor, so it is left unflagged
 * despite a low ratio — that guard is worth seeing work.
 *
 * `totals.active_users` (74) is smaller than the sum of the division rows (78)
 * on purpose: totals count distinct people, and four of them are active in two
 * divisions. Event counts do sum exactly.
 */
export const SAMPLE_INSIGHTS: InsightsResponse = {
  agent_id: 'clarvo-rag-v1',
  window_days: 30,
  totals: {
    events: 2580,
    active_users: 74,
    platforms: 1,
    first_event_at: '2026-07-22T15:40:15Z',
    last_event_at: '2026-08-21T02:26:15Z',
  },
  adoption: [
    { business_group: 'SLGS', division: 'DevSecOps', active_users: 9, events: 634 },
    { business_group: 'SLGS', division: 'Engineering', active_users: 22, events: 1114 },
    { business_group: 'Corporate', division: 'Data & Analytics', active_users: 12, events: 424 },
    { business_group: 'Corporate', division: 'Operations', active_users: 13, events: 267 },
    { business_group: 'Benefits', division: 'Claims', active_users: 18, events: 119 },
    { business_group: 'Benefits', division: 'Actuarial', active_users: 4, events: 22 },
  ],
  trend: [
    { week: '2026-07-20', active_users: 18, events: 240 },
    { week: '2026-07-27', active_users: 34, events: 486 },
    { week: '2026-08-03', active_users: 49, events: 690 },
    { week: '2026-08-10', active_users: 61, events: 746 },
    { week: '2026-08-17', active_users: 56, events: 418 },
  ],
  platforms: [{ platform: 'bedrock_agentcore', active_users: 74, events: 2580 }],
  sentiment: [
    { sentiment: 'positive', responses: 6, avg_time_saved_hours: '4.02' },
    { sentiment: 'neutral', responses: 3, avg_time_saved_hours: '1.15' },
    { sentiment: 'negative', responses: 2, avg_time_saved_hours: '0.25' },
  ],
  themes: [
    {
      theme_id: 'thm_7f2a',
      label: 'Unclear documentation',
      member_count: 8,
      generated_at: '2026-08-21T04:00:00Z',
    },
    {
      theme_id: 'thm_31bd',
      label: 'Answers not grounded in our policy set',
      member_count: 6,
      generated_at: '2026-08-21T04:00:00Z',
    },
    {
      theme_id: 'thm_9c04',
      label: 'No obvious entry point in daily tooling',
      member_count: 5,
      generated_at: '2026-08-21T04:00:00Z',
    },
    {
      theme_id: 'thm_5ae8',
      label: 'Unsure whether output can be used in client work',
      member_count: 3,
      generated_at: '2026-08-21T04:00:00Z',
    },
  ],
  briefing: {
    status: 'ok',
    summary:
      'Adoption is broad but uneven. 74 people across six divisions recorded 2,580 uses in the ' +
      'last 30 days, and weekly active users grew every week until the most recent one, which ' +
      'fell from 61 to 56.',
    insight:
      'The headline growth hides a stall. Claims has the second-largest group of users of any ' +
      'division and the lowest engagement by a wide margin — 6.6 uses per person against 50.6 ' +
      'in Engineering. That pattern is people trying the agent once and not returning, which ' +
      'is a different problem from people never starting, and it does not fix itself.',
    recommendation:
      'Run a change-management intervention in Claims before extending the rollout. The ' +
      'most-reported barrier is unclear documentation, so pair a Claims-specific quickstart ' +
      'with two live clinics, then re-measure uses per person in three weeks.',
    citations: [
      { metric: 'claims_uses_per_person', value: '6.6' },
      { metric: 'claims_active_users', value: '18' },
      { metric: 'engineering_uses_per_person', value: '50.6' },
      { metric: 'top_theme_members', value: '8' },
      { metric: 'weekly_active_users_change', value: '-5' },
    ],
    generated_at: '2026-08-21T04:12:00Z',
  },
}

/** The same reading with the background jobs not yet run — day-one empty states. */
export const SAMPLE_INSIGHTS_DAY_ONE: InsightsResponse = {
  ...SAMPLE_INSIGHTS,
  themes: [],
  briefing: null,
}

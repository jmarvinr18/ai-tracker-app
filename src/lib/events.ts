import type { UsageEvent } from '@/types/tracker'

export interface UsageEventDraft {
  acf2Id: string
  eventId: string
  platform: string
  businessGroup: string
  division: string
  eventType: string
  /** A `datetime-local` value, or empty to let the API default it to now. */
  occurredAt: string
  metadata: string
}

export function emptyUsageDraft(): UsageEventDraft {
  return {
    acf2Id: '',
    eventId: '',
    platform: 'bedrock_agentcore',
    businessGroup: '',
    division: '',
    eventType: 'invocation',
    occurredAt: '',
    metadata: '',
  }
}

/** A stable-looking id so a demo can deliberately resend one and see a duplicate. */
export function suggestEventId(): string {
  const random = Math.random().toString(16).slice(2, 10)
  return `evt_${Date.now().toString(36)}_${random}`
}

export class DraftError extends Error {}

function parseMetadata(raw: string): Record<string, unknown> | undefined {
  const text = raw.trim()
  if (!text) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new DraftError(
      'Metadata must be a JSON object, e.g. {"source":"ide"}. Fix it or clear it.',
    )
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new DraftError('Metadata must be a JSON object, not an array or a bare value.')
  }
  return parsed as Record<string, unknown>
}

/**
 * Builds the wire event from the form.
 *
 * The timestamp field is `occurred_at`. A field named `timestamp` is accepted,
 * ignored, and silently replaced with the arrival time — so backfilled events
 * quietly land on today and nobody finds out until a trend line is questioned.
 * This function is the only place the name is written.
 */
export function toUsageEvent(draft: UsageEventDraft): UsageEvent {
  const acf2Id = draft.acf2Id.trim()
  if (!acf2Id) {
    throw new DraftError('An ACF2 ID is required — it is the only field the API insists on.')
  }

  const event: UsageEvent = { acf2_id: acf2Id }
  const eventId = draft.eventId.trim()
  if (eventId) event.event_id = eventId
  if (draft.platform.trim()) event.platform = draft.platform.trim()
  if (draft.businessGroup.trim()) event.business_group = draft.businessGroup.trim()
  if (draft.division.trim()) event.division = draft.division.trim()
  if (draft.eventType.trim()) event.event_type = draft.eventType.trim()

  const occurredAt = draft.occurredAt.trim()
  if (occurredAt) {
    const parsed = Date.parse(occurredAt)
    if (!Number.isFinite(parsed)) {
      throw new DraftError('That date could not be read. Use the picker, or clear it to use now.')
    }
    event.occurred_at = new Date(parsed).toISOString()
  }

  const metadata = parseMetadata(draft.metadata)
  if (metadata) event.metadata = metadata

  return event
}

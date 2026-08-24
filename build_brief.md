# Build brief — Adoption Signal dashboard

Add a dashboard to this existing Vue + TypeScript app. It reads from an internal AI-agent adoption tracker API and shows leadership where adoption is lagging and what to do about it.

**Before writing anything:** read `package.json`, `tsconfig.json`, and two or three existing components and stores. Match the conventions already here — state management, typing style, folder layout, styling approach, how API calls are made. Everything below describes *what* to build, not how this codebase should look. Where this brief conflicts with existing conventions, the conventions win. Say what you changed and why.

---

## The product in one paragraph

Agent teams add a small SDK to their repo; it posts usage events to a central API. A survey fires some days after a person's first use. A background job clusters the free-text complaints into named themes, and an LLM agent writes a short briefing for leadership. This dashboard is the read surface for all of that, plus a small form for generating test data during a demo.

---

## API contract

Base URL is configured at runtime, e.g. `https://vpce-xxxx.execute-api.us-east-1.vpce.amazonaws.com/develop`.

Headers on every request:

| Header | Notes |
|---|---|
| `x-api-key` | Required except on `/v1/health`. |
| `x-agent-id` | e.g. `clarvo-rag-v1`. |
| `x-apigw-api-id` | **Required.** The API is private and its VPC endpoint has private DNS disabled, so callers use the endpoint hostname and identify the API by header. Without it the request never reaches the API. |
| `content-type` | `application/json` on POST. |

### `GET /v1/insights?days=30`

The main read. Everything the dashboard needs in one round trip.

```json
{
  "agent_id": "clarvo-rag-v1",
  "window_days": 30,
  "totals": {
    "events": 2760,
    "active_users": 74,
    "platforms": 1,
    "first_event_at": "2026-07-22T15:40:15Z",
    "last_event_at": "2026-08-21T02:26:15Z"
  },
  "adoption": [
    { "business_group": "SLGS", "division": "Engineering", "active_users": 22, "events": 1114 }
  ],
  "trend": [
    { "week": "2026-08-17", "active_users": 56, "events": 418 }
  ],
  "platforms": [
    { "platform": "bedrock_agentcore", "active_users": 74, "events": 2760 }
  ],
  "sentiment": [
    { "sentiment": "positive", "responses": 6, "avg_time_saved_hours": "4.02" }
  ],
  "themes": [
    { "theme_id": "thm_x", "label": "Unclear documentation", "member_count": 8, "generated_at": "..." }
  ],
  "briefing": {
    "status": "ok",
    "summary": "...",
    "insight": "...",
    "recommendation": "...",
    "citations": [{ "metric": "...", "value": "..." }],
    "generated_at": "..."
  }
}
```

Type these properly. Note the API's own quirks:

- `avg_time_saved_hours` comes back as a **string**, not a number.
- `citations` is `jsonb` — an array from one code path, a JSON **string** from another. Handle both.
- `themes: []` and `briefing: null` are **normal empty states**, not errors. They stay empty until background jobs have run, and the dashboard must render on day one regardless.
- `briefing.status` can be `"unavailable"`, meaning the agent could not produce one. Show that state explicitly rather than falling back to an older briefing.

### Other endpoints

| Method + path | Purpose |
|---|---|
| `GET /v1/health` | Liveness. **Unauthenticated** — the only route that works with no key. |
| `GET /v1/metrics/adoption?days=` | Just the adoption block. |
| `GET /v1/metrics/trend?days=` | Just the trend block. |
| `GET /v1/themes` | Just the themes block. |
| `POST /v1/insights/regenerate` | Runs the briefing agent now. Returns 200 with `{status:"ok", briefing_id}` or **503** with `{status:"unavailable"}`. Rate-limit the UI control. |
| `POST /v1/usage` | `{ "events": [ ... ] }`. Only `acf2_id` is required per event. Other fields: `event_id`, `platform`, `business_group`, `division`, `event_type`, `occurred_at`, `metadata`. **The timestamp field is `occurred_at`, not `timestamp`** — the wrong name is silently ignored and defaults to now. Send the same `event_id` twice and the response is `{accepted: 0, duplicates: 1}`. |
| `POST /v1/feedback/check` | `{ "acf2_id": "..." }` → `{due: false, reason: "..."}` or `{due: true, questions: [...]}`. |
| `POST /v1/feedback/submit` | `{acf2_id, sentiment, time_saved?, barriers?, value_signals?}`. **`sentiment` must be the string `positive`, `neutral` or `negative`** — a number returns 400. |

---

## Screens

### 1. Signal (the dashboard)

**KPI row** — people using it, recorded uses, survey replies, time since last use. Format the last one as compact elapsed time (`40m`, `6h`, `3d`) rather than a timestamp.

**Vital signs by division — the signature element. Build this one carefully.**

The finding the whole product exists to surface is a **ratio**, not a total. Compute `events / active_users` per division and rank by that. Against real data:

```
DevSecOps         70.4
Engineering       50.6
Data & Analytics  35.3
Operations        20.5
Claims             6.6   <- stalled
```

Claims has the *second-largest* group of users and by far the lowest engagement — people tried the agent and stopped. Ranking by raw event count puts Claims fourth and hides this completely.

Flag a division as stalled when uses-per-person is under 12 **and** it has at least 5 users (the user minimum stops one curious person being reported as a division in trouble). Render each division as a row of small weekly bars — a pulse — so a flatlining division is visible at a glance. Stalled rows use the alert colour; healthy rows the signal colour. Sort stalled divisions last so they read as the conclusion.

Below the rows, a sentence naming the stalled divisions and saying that is where a change-management intervention pays for itself.

**Honesty constraint:** `/v1/insights` returns one overall trend, not a trend per division. The ratio and the stall flag are measured; the week-by-week distribution *within* a division is inferred by scaling the overall curve by that division's intensity and decaying it when stalled. Put that in a code comment. If time allows, a better fix is a `GROUP BY division, week` query added to the API — flag that as a follow-up rather than silently faking it.

**Weekly trend** — active users over time. Hand-drawn SVG is fine and preferred over pulling in a charting library for one line and three grid rules. If this project already has a chart library, use that instead.

**Sentiment** — horizontal bars, positive/neutral/negative. Detect and warn when the data contains *both* numeric and word sentiment values: seeded rows wrote numbers while the API enforces words, and the two do not aggregate. Say so in the UI rather than drawing a misleading chart.

**Themes** — ranked list with counts. Numbering is meaningful here: position one is the most-reported barrier, which is where an intervention starts.

**Briefing** — summary, insight, recommendation as three labelled sections, plus the cited figures underneath and when it was generated. Include a Regenerate button. Note in the UI that it is served from cache, so opening the page does not run the agent.

### 2. Send data

Two forms — record a usage event, and submit a feedback response — plus a response log. This exists so a demo can generate live data on stage. Include a "check if a survey is owed" button that calls `/v1/feedback/check`.

Note in the UI that sending the same event ID twice counts as a duplicate, not a second use. It is worth demonstrating.

### 3. Connect

Base URL, API ID, API key, agent ID, window in days. Plus a **paste-a-response** textarea and a **Load sample** button.

**Paste mode is essential, not a nicety.** See the constraint below.

---

## The constraint that shapes the whole app

**The API is private and a browser usually cannot reach it.**

- The endpoint only answers from inside the VPC.
- Private DNS is disabled, so the hostname is the VPC endpoint's own DNS name.
- Even with DNS resolving, the browser sends a CORS preflight `OPTIONS`, and the REST API has no OPTIONS methods — so the call is blocked before the backend sees it.

Consequences for the build:

1. **Paste mode is a first-class path.** A textarea that accepts the `/v1/insights` JSON and renders the dashboard identically. Accept either the bare response body or a whole Lambda invocation result (`{"result": {"body": "..."}}` or `{"body": "..."}`) so nothing has to be trimmed by hand.
2. **A sample dataset** so the dashboard can be opened and understood with no backend at all.
3. **Network errors must explain themselves.** `fetch` rejects with the same `TypeError` whether the host was unreachable or CORS blocked it. Do not guess — name both possibilities and point at paste mode. A blocked request otherwise looks exactly like a wrong API key, which wastes a lot of someone's evening.

---

## Non-negotiables

- **Never persist the API key.** No `localStorage`, no `sessionStorage`, no cookie. In-memory only, so a refresh clears it. Put a line in the UI saying this is deliberate: a key in browser storage outlives the tab it was typed into and nothing on screen tells you it is still there.
- **Every empty state names the next action.** "Not clustered yet — run the embedding function to group written answers into themes" rather than "No data".
- **Errors say what to do**, in the interface's voice, never apologising and never vague.
- Keyboard focus visible, responsive to mobile, `prefers-reduced-motion` respected.
- Type the API responses properly. Do not reach for `any` on the payload.

---

## Visual direction

The subject is a **measurement instrument**, not a business intelligence tool. If this project already has a design system, use it and ignore this section.

Otherwise: cool paper and ink rather than a dark dashboard. One healthy signal colour and one alert colour, used only for signal and alert. A monospace for every number — telemetry deserves tabular figures.

```
--paper:      #EDF1F4
--surface:    #FFFFFF
--ink:        #12212F
--ink-soft:   #5A6B7B
--rule:       #D2DAE1
--live:       #0F766E   (healthy)
--stall:      #B45309   (alert)
--live-wash:  #E2F0EE
--stall-wash: #FAEDDF
```

Type: Space Grotesk for display, IBM Plex Sans for body, IBM Plex Mono for all numerics.

Spend the boldness on the vital-signs strip. Keep everything around it quiet.

---

## Order of work

1. Types for the API payloads.
2. API client, with the header handling and the error translation.
3. Store — connection config, current reading, source (`live` / `pasted` / `sample`), actions.
4. Sample dataset and paste handling. **Do this early** — it unblocks all UI work without a reachable backend.
5. Connect screen.
6. Signal screen, vital signs first.
7. Send data screen.

Run the build and fix what it reports. Do not hand back code that has not compiled.
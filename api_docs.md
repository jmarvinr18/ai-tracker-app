# Team PRMJ Adoption Tracker API — Runbook

**Deployment:** private REST API on API Gateway, reachable only from inside the VPC or across peered networks. Not internet-facing.

---

## Base URL

Private DNS is **disabled** on the VPC endpoint, so the normal `execute-api` hostname will not resolve. Every caller uses the endpoint hostname and identifies the API by header.

```
https://{vpce-dns-name}/{stage}
```

Example:
```
https://vpce-07e654186478a70b8-9p3cv3yi.execute-api.ap-southeast-1.vpce.amazonaws.com/develop
```

**Every request must send:**

| Header | Value | Notes |
|---|---|---|
| `x-apigw-api-id` | the REST API ID | Required. The endpoint hostname is shared across every private API in the account, so without this the endpoint cannot tell which API you mean. |
| `x-api-key` | the agent's key | All routes except `/v1/health`. |
| `x-agent-id` | e.g. `slgsai-agent-v1` | Optional if `DEFAULT_AGENT_ID` is set on the function; send it explicitly to be safe. |
| `content-type` | `application/json` | On POST. |

Get the endpoint DNS name from VPC → Endpoints → your `execute-api` endpoint → DNS names.

---

## Authentication

The key is compared against a SHA-256 stored in `agent_config`, using a constant-time compare so a wrong key cannot be narrowed down by timing the response.

The agent is resolved in this order: `x-agent-id` header → `agent_id` in the body → the `DEFAULT_AGENT_ID` environment variable.

| Response | Meaning |
|---|---|
| `401 Missing x-api-key header` | No key sent. |
| `401 Unknown agent or invalid API key` | Either the agent does not exist **or** the key is wrong. Deliberately identical — telling a caller which one it was reveals whether an agent ID exists. |
| `403 Agent is disabled` | The agent exists but `is_active` is false. Use this to revoke access without deleting history. |

**Keys are shown once at registration and stored only as a hash.** A lost key cannot be recovered — re-register to rotate, which invalidates the old one immediately.

---

## Endpoints

### `GET /v1/health`

Liveness. **Unauthenticated on purpose** — it has to answer while the database is unreachable, because that is exactly when someone is checking whether the API is up.

```json
{"ok": true, "environment": "production"}
```

Use this first when debugging. A 200 here proves endpoint, DNS, resource policy, routing and integration all work, with credentials and the database entirely out of the picture.

---

### `POST /v1/usage`

Records adoption events. Accepts a batch; a batch of one is normal.

**Request**
```json
{
  "events": [
    {
      "event_id": "evt_api_001",
      "acf2_id": "abc1234",
      "platform": "bedrock_agentcore",
      "business_group": "SLGS",
      "division": "DevSecOps",
      "event_type": "invocation",
      "occurred_at": "2026-08-22T14:00:00Z",
      "metadata": {}
    }
  ]
}
```

Only `acf2_id` is required. Everything else defaults:

| Field | Default | Notes |
|---|---|---|
| `event_id` | generated | **Supply it.** It is the idempotency key — omit it and a retry double-counts. The SDK always sends one. |
| `agent_id` | from the API key | |
| `platform` | `"unknown"` | Free-form, so a new platform needs no schema change. |
| `event_type` | `"invocation"` | |
| `occurred_at` | now | Note the field name — **not** `timestamp`. |
| `metadata` | `{}` | Must be an object. |

`acf2_id` also accepts the alias `user_id`.

**Response**
```json
{"accepted": 1, "duplicates": 0, "events": ["evt_api_001"]}
```

Re-sending the same `event_id` returns `{"accepted": 0, "duplicates": 1}`. That is the guarantee that makes the adoption numbers trustworthy — worth demonstrating rather than just claiming.

A first sighting of an `(agent_id, acf2_id)` pair also writes `first_use`, which is what the feedback threshold measures from. That write never overwrites, so the date cannot drift forward.

**Errors:** `400` for a missing `acf2_id`, non-object `metadata`, a non-array `events`, or a batch over the maximum. `500` if a write fails — partial batches report how many were written before the failure.

---

### `POST /v1/feedback/check`

Asks whether this user has crossed the survey threshold.

**Request**
```json
{"acf2_id": "abc1234"}
```

**Responses**

Never used the agent:
```json
{"due": false, "reason": "no recorded first use"}
```

Already answered — the survey does not nag:
```json
{"due": false, "reason": "already answered"}
```

Too early:
```json
{"due": false, "reason": "threshold not reached",
 "threshold_unit": "days", "minutes_remaining": 18240.5}
```

Due:
```json
{"due": true, "threshold_unit": "minutes",
 "first_use_at": "2026-07-22T15:40:15Z",
 "questions": [
   {"id": "sentiment", "prompt": "Overall, how has this agent been for you?",
    "type": "choice", "options": ["positive", "neutral", "negative"]},
   {"id": "time_saved", "prompt": "Roughly how many hours has it saved you per week?",
    "type": "number"}
 ]}
```

The question set comes from the API rather than the client, so the survey can change without every agent redeploying.

**Threshold:** `threshold_days` per agent, default 14. `threshold_minutes` overrides it when set — that is demo mode, because you cannot wait fourteen days on stage.

---

### `POST /v1/feedback/submit`

**Request**
```json
{
  "acf2_id": "abc1234",
  "sentiment": "positive",
  "time_saved": 2.5,
  "barriers": "The setup documentation was hard to follow",
  "value_signals": {"would_recommend": true}
}
```

`acf2_id` is the only required field.

**`sentiment` must be `positive`, `neutral` or `negative`.** A number returns `400 'sentiment' must be positive, neutral or negative`.

`response_id` is generated if omitted. Supply it for idempotency on retry.

**Response**
```json
{"accepted": true, "response_id": "fbk_44118fb989b54ac996eab94576910a1c"}
```

Already answered:
```json
{"accepted": true, "duplicate": true}
```

`barriers` is the free-text field that later gets embedded and clustered into named themes. It is the single most valuable field on this endpoint — it is what turns "adoption is low" into "here is the intervention."

---

### `GET /v1/insights`

Everything the dashboard and the insight agent's tools need, in one round trip.

**Query:** `days` (default 90, max 365)

**Response**
```json
{
  "agent_id": "slgsai-agent-v1",
  "window_days": 30,
  "totals": {"events": 2760, "active_users": 74, "platforms": 1,
             "first_event_at": "...", "last_event_at": "..."},
  "adoption": [{"business_group": "SLGS", "division": "Engineering",
                "active_users": 22, "events": 1114}],
  "trend": [{"week": "2026-08-17", "active_users": 56, "events": 418}],
  "platforms": [{"platform": "bedrock_agentcore", "active_users": 74, "events": 2760}],
  "sentiment": [{"sentiment": "positive", "responses": 6, "avg_time_saved_hours": "4.02"}],
  "themes": [],
  "briefing": null
}
```

`themes: []` and `briefing: null` are **empty states, not errors.** They stay empty until the embedding and briefing functions have run, and the dashboard must render on day one regardless.

The briefing is served from cache rather than generated on request — page loads must not translate into agent invocations.

---

### `GET /v1/metrics/adoption`

Narrower version of the `adoption` block. Query: `days`.

Backs the insight agent's `get_adoption_metrics` tool.

```json
{"agent_id": "slgsai-agent-v1", "window_days": 30,
 "adoption": [{"business_group": "Canada", "division": "Claims",
               "active_users": 18, "events": 118}]}
```

Read it as a ratio, not a count. Claims having 18 users and 118 events against Engineering's 22 users and 1,114 events is the signal: people tried it and stopped.

---

### `GET /v1/metrics/trend`

Active users and events per week. Query: `days`.

```json
{"agent_id": "slgsai-agent-v1", "window_days": 30,
 "trend": [{"week": "2026-08-17", "active_users": 56, "events": 418}]}
```

A raw count cannot show "adoption is lagging" — the shape over time is the answer to that question.

---

### `GET /v1/themes`

Barrier themes ranked by frequency, top 20. Backs the agent's `get_barrier_themes` tool.

```json
{"agent_id": "slgsai-agent-v1",
 "themes": [{"theme_id": "thm_...", "label": "Unclear documentation",
             "member_count": 8, "generated_at": "..."}]}
```

Only themes with a `label` are returned, so partially-clustered data never surfaces half-formed.

---

## Not on the API

**Migrations, seeding and agent registration have no route.** The bootstrap function can drop every table, so it is invoked directly rather than exposed over HTTP.

```json
{"action": "health"}
{"action": "migrate"}
{"action": "register_agent", "agent_id": "slgsai-agent-v1", "threshold_minutes": 2}
{"action": "seed", "agent_id": "slgsai-agent-v1", "days": 30}
{"action": "reset", "confirm": "DELETE ALL DATA"}
```

From CI, use `lambda:InvokeFunction` scoped by IAM to a specific role — not an API route.

---

## Troubleshooting

Work down this list; each step rules out a layer.

| Symptom | Cause |
|---|---|
| No response, fails in milliseconds | DNS. Private DNS is off, so you must use the endpoint hostname. Check the URL. |
| No response, ~5 second timeout | No network route. The caller is not in the VPC, or the endpoint's security group does not allow it on 443. |
| `403 Missing Authentication Token` | **Not an auth problem.** No route matched. Check the resource path exists, the method is defined on it, the stage name is right, and the API was redeployed after the last change. |
| `403 Forbidden` | Resource policy missing, or its `aws:SourceVpce` condition does not match this endpoint. Policy changes are not live until a deployment. |
| `401 Unknown agent or invalid API key` | Wrong key, or the agent is not registered. Re-register to rotate. |
| `500 Internal error` | The Lambda ran and raised. Read that function's CloudWatch logs — the real exception is logged before the generic response is returned. |
| `502 Bad Gateway` | Lambda Proxy integration left unticked, or the handler returned a shape without `statusCode`. |
| First call takes ~2s, later calls fast | Cold start plus VPC ENI attachment. Expected. Fire a warm-up request before a demo. |

### `500` with `resourceArn: None` in the traceback

The function fell into the Data API path because `DB_MODE` is unset. Set the full ec2 group on **that specific function**:

```
DB_MODE=ec2
DB_HOST=<rds endpoint>
DB_PORT=5432
DB_NAME=vectordb
DB_USER=postgres
DB_PASSWORD=<password>
```

Each function needs its own copy, along with VPC config, the psycopg layer at a matching architecture, and `AWSLambdaVPCAccessExecutionRole`. Configuring six functions by hand is how one of them ends up different — this is the argument for applying from Terraform.

### `cannot adapt type 'dict'`

A `jsonb` column was passed a Python dict instead of a JSON string. Wrap it in `json.dumps()`. Affects `metadata` on usage, `value_signals` on feedback, and `citations` on briefings. Only shows up on the psycopg path.

---

## Known gaps

- **`DLQ_URL` is not set.** Failed writes log `No DLQ configured; dropping failed write` and are lost. The code path exists; the queue does not. Fifteen minutes to close, and it converts an architecture claim into something demonstrable.
- **Private DNS is disabled and cannot be enabled** in this account, so every caller needs the endpoint hostname plus `x-apigw-api-id`. The SDK needs an `ADOPTION_TRACKER_API_ID` setting to send that header.
- **Cross-VPC DNS resolution is unverified.** Callers on peered networks may not resolve the endpoint hostname without a shared Route 53 private hosted zone. That lives outside this account.
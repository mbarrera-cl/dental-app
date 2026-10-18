# MCP server (Model Context Protocol)

Hexa exposes its quotation workflow to MCP clients (Claude, Cursor, custom
agents, …) over **Streamable HTTP** and **STDIO**. The implementation uses
[`@rekog/mcp-nest`](https://github.com/rekog-labs/MCP-Nest) v2, which runs as a
NestJS microservice transport and reuses the existing use cases, API keys and
audit trail.

The initial domain is **presupuestos** (quotations), plus the patient and UCO
catalog reads needed to build them. New domains (clinical records, odontogram,
…) are added as new tool classes without touching the transport or security
layers.

---

## HTTP

### Enable and start

```bash
MCP_ENABLED=true npm run dev:all
# or, with an already built backend:
MCP_ENABLED=true node dist/main.js
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_ENABLED` | `false` | Mounts `/mcp` (otherwise the route returns 404) |
| `MCP_SERVER_NAME` | `hexa-dental` | Advertised server name |
| `MCP_SERVER_VERSION` | `1.0.0` | Advertised server version |

The endpoint is `POST /mcp` on the same port as the REST API (default `3000`).

### Authentication

Use an **API key**. Create one in **Mi cuenta → Mis claves de API** (or
`POST /apikeys`) with the scopes the agent needs. Send it as either:

```
Authorization: Bearer hexa_...
X-Api-Key: hexa_...
```

The key acts as its owner: effective permissions are recomputed on every
request as `owner permissions ∩ key scopes`, so revoking the key or changing a
role applies immediately.

### Client configuration

```json
{
  "mcpServers": {
    "hexa": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${HEXA_MCP_API_KEY}"
      }
    }
  }
}
```

### Tools

| Tool | Scope | Write | Notes |
| --- | --- | --- | --- |
| `hexa_whoami` | authenticated | — | Key owner, type and effective scopes |
| `hexa_calc` | authenticated | — | Deterministic calculator: `sum`, `mean`, `min`, `max`, `count`, `median`, `range`, `stddev` over a list of numbers |
| `hexa_patients_search` | `patients:read` | — | RUT or name; max `mcp.maxResults` |
| `hexa_patients_get` | `patients:read` | — | By id or RUT |
| `hexa_uco_search` | `uco:read` | — | Code, name or chapter; CLP price = `units × quotes.ucoRate` |
| `hexa_uco_get` | `uco:read` | — | Exact code + UCO units + CLP price (`units × quotes.ucoRate`) |
| `hexa_quotes_list` | `quotes:read` | — | Patient, status, folio, dates, trash |
| `hexa_quotes_get` | `quotes:read` | — | Lines, totals and patient snapshot |
| `hexa_quotes_versions` | `quotes:read` | — | Version trail with snapshots |
| `hexa_quotes_create` | `quotes:create` | ✅ | Creates a **draft**; price derived from `quotes.ucoRate` when `unitPrice` is omitted |
| `hexa_quotes_update` | `quotes:update` | ✅ | Replaces the lines of any non-deleted quote |
| `hexa_quotes_duplicate` | `quotes:create` | ✅ | New draft version |
| `hexa_quotes_decide_item` | `quotes:update` | ✅ | Approve/reject a line — **confirm** |
| `hexa_quotes_sanction` | `quotes:approve` | ✅ | Approve/reject the quote — **confirm** |
| `hexa_quotes_set_status` | `quotes:approve` | ✅ | Change status: borrador, sin_respuesta, aprobada, rechazada — **confirm** |
| `hexa_quotes_delete` | `quotes:delete` | ✅ | Trash (soft delete) — **confirm** |
| `hexa_quotes_restore` | `quotes:delete` | ✅ | Restore from trash — **confirm** |
| `hexa_activity_list` | `activity:read` or `activity:read-all` | — | Own actions unless the key has `read-all` |

### Prompts

- `presupuesto_desde_arancel` — guides the model through patient → UCO →
  confirmation → `hexa_quotes_create`.
- `resumen_presupuesto` — summarize a quote without modifying it.
- `comparar_presupuestos` — compare two quotes line by line.

Resources are not exposed yet; add them with `@Resource`/`@ResourceTemplate` in
`src/modules/mcp/application/resources/`.

---

## Write safety

Writes are **off by default** and require three independent gates:

1. The API key must have the tool scope (e.g. `quotes:create`).
2. The administrator must enable `mcp.allowWrites` in **Administración →
   Configuración → MCP**.
3. Sensitive actions require `confirm: true` in the tool arguments (after the
   human approves the summary); `mcp.requireConfirmation` controls this check.

Additional limits:

- `mcp.writeRateLimitPerMinute` — per-API-key write budget (in-memory per
  instance; use a shared store when scaling horizontally).
- `mcp.maxResults` — caps every search/list result (default 20, max 100).
- `mcp.redactPii` — masks RUT, email and phone in tool output (recommended when
  the MCP client is an external LLM).
- Every tool call is appended to the activity trail as `mcp.<tool>` with the
  actor (API key), outcome and transport. No arguments are stored.

**Never exposed:** user/role/settings administration, API-key management,
activity purge, UCO catalog writes, quote email sending, patient deletion.

---

## Settings (Administración → Configuración → MCP)

| Key | Default | Meaning |
| --- | --- | --- |
| `mcp.allowWrites` | `false` | Master switch for write tools |
| `mcp.maxResults` | `20` | Max rows per search/list |
| `mcp.writeRateLimitPerMinute` | `20` | Write calls per key per minute |
| `mcp.redactPii` | `false` | Mask RUT/email/phone in output |
| `mcp.requireConfirmation` | `true` | Require `confirm: true` for sensitive actions |
| `activity.captureMcp` | `true` | Audit MCP calls in the activity trail |

---

## STDIO

For a local MCP client that launches a process:

```bash
HEXA_MCP_API_KEY=hexa_... DATABASE_URL=postgresql://hexa:...@localhost:5433/hexa npm run mcp:stdio
```

The process reuses the same database and use cases. `HEXA_MCP_API_KEY` is
**required**; the key is re-authenticated on every tool call, so revoking it
takes effect without restarting. stdout is reserved for the protocol (Nest
logging is disabled); diagnostics go to stderr.

Client configuration:

```json
{
  "mcpServers": {
    "hexa": {
      "command": "npm",
      "args": ["run", "mcp:stdio"],
      "env": {
        "HEXA_MCP_API_KEY": "hexa_...",
        "DATABASE_URL": "postgresql://hexa:...@localhost:5433/hexa"
      }
    }
  }
}
```

> The STDIO process and the HTTP server share the same PostgreSQL database.
> The connection pool handles concurrent writers; each tool call still
> re-authenticates its API key, so revocation is immediate.

---

## Data protection (DeepSeek / external LLMs)

The MCP server itself does **not** call any LLM. When the client is an external
provider (e.g. **DeepSeek via API key**), every tool result — including patient
name, RUT, email and quoted procedures — is sent to that provider. Before using
it with real patients:

- Review the provider's data-retention and training policies; prefer a
  zero-retention tier.
- Enable `mcp.redactPii` and give the agent a key with only the scopes it needs.
- Prefer patient/internal ids over RUTs in prompts when possible.
- Keep `mcp.allowWrites` off until the workflow and confirmations are validated.

---

## Extending

1. Add a facade in `src/modules/mcp/application/facades/<domain>.facade.ts`
   that delegates to the existing use cases and returns plain views.
2. Add a `@McpController()` class with `@Tool` methods in
   `src/modules/mcp/application/tools/<domain>.tools.ts`. Each method calls
   `McpToolRunner.run(ctx, { tool, permissions, write, confirm }, args, handler)`.
3. Register the facade and the controller in `McpModule`.
4. Export the use cases you need from their feature module.

The runner resolves the caller (HTTP principal or STDIO key), enforces
permissions/writes/rate limits, redacts PII, audits the call and returns MCP
content. Tool schemas use Zod v4.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `404` on `/mcp` | `MCP_ENABLED` is not `true` |
| `401` | Missing/invalid API key, or the key owner is disabled |
| `isError: "Missing permission…"` | The key's scopes do not include the tool scope |
| `isError: "Write tools are disabled…"` | Enable `mcp.allowWrites` in settings |
| `isError: "…requires explicit human confirmation"` | Call again with `confirm: true` after approval |
| `isError: "Write rate limit exceeded"` | Wait a minute or raise `mcp.writeRateLimitPerMinute` |
| Tool list empty | The API key has no scopes or the app did not start with `MCP_ENABLED=true` |

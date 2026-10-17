# CaroIA — backend y chat integrado

CaroIA es el asistente de presupuestos de Hexa. La rama
`feat/caro-ia-backend` parte de `feat/caro-ia-ui` y sustituye el gateway
simulado por el backend real: DeepSeek, catálogo MCP, persistencia,
aprobaciones humanas y transcripción Deepgram.

En esta fase CaroIA procesa **texto escrito y audio dictado**. No acepta
adjuntos (PDF, DOCX, imágenes, etc.): el audio se transcribe, se descarta y
solo la transcripción se envía al modelo.

---

## Cómo probarla

```bash
cd /Users/mbarrera/hexa
MCP_ENABLED=true npm run dev:all
```

Abre `http://localhost:4200/caro-ia` o usa el botón **CaroIA** de la cabecera,
junto al icono de actividad. El ítem también aparece en el menú lateral si el
usuario tiene `caroIa:use`.

### Variables de entorno (solo servidor)

En desarrollo, crea `/Users/mbarrera/hexa/.env` a partir de `.env.example` y
completa las claves reales. `scripts/dev-all.sh` carga ese archivo con
`node --env-file-if-exists=.env`; `.env` está ignorado por git y nunca debe
subirse. Después reinicia el servidor:

```bash
cd /Users/mbarrera/hexa
cp .env.example .env
# edita .env con tus claves
MCP_ENABLED=true npm run dev:all
```

En producción (Railway, Docker, etc.) configura las mismas variables en el
panel de variables de entorno del servicio; no las pongas en el frontend ni en
la base de datos.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | — | Obligatoria para responder. Nunca va al frontend ni a la base de datos. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Modelo de chat. |
| `DEEPSEEK_API_URL` | `https://api.deepseek.com` | Base URL compatible con OpenAI. |
| `DEEPGRAM_API_KEY` | — | Obligatoria para transcribir audio. |
| `DEEPGRAM_MODEL` | `nova-3` | Modelo pre-recorded. |
| `DEEPGRAM_LANGUAGE` | `es` | Idioma de transcripción. |
| `DEEPGRAM_API_URL` | `https://api.deepgram.com` | Base URL de Deepgram. |
| `CARO_IA_STREAM_DELAY_MS` | `6` | Retardo entre deltas SSE (0 en pruebas). |

> La clave de DeepSeek que se compartió durante el desarrollo debe rotarse
> antes de usarla. No se guarda en el repositorio, la base de datos ni el
> navegador.

Si falta una clave, la UI muestra un error controlado; no se inventa una
respuesta.

---

## Qué incluye

- **Tabla de conversaciones como vista inicial**, a todo el ancho y con títulos
  largos truncados con `…`.
- **Chat a pantalla completa**, sin scroll de página: solo scrollea el
  historial; composer y botón “Volver a conversaciones” siempre visibles.
- **Conversaciones privadas por usuario**. El administrador tampoco puede ver
  las conversaciones de otra persona (`404`).
- **Texto y audio**: el micrófono transcribe con Deepgram y coloca el texto en
  el composer. El audio no se persiste.
- **Sin adjuntos**: el clip está oculto y el backend rechaza `attachmentIds`.
- **Streaming SSE**: deltas del asistente, chips de tools, citas y tarjetas de
  aprobación (`pk-approval`).
- **Solo MCP**: el modelo debe usar tools; el verificador reemplaza por una
  negativa cualquier respuesta sin evidencia MCP.
- **Escrituras con aprobación**: el modelo propone; el backend guarda los
  argumentos exactos y no ejecuta hasta que el usuario aprueba. La aprobación
  expira, es de un solo uso y se valida contra el usuario y la conversación.
- **Título determinista**: la primera pregunta se usa como título (máximo 80
  caracteres). La conversación se crea recién en el primer envío; “Nueva
  conversación” abre un borrador.
- **Auditoría**: envíos, transcripciones y decisiones de aprobación quedan en
  el historial de actividad (`caroIa.*`), sin guardar contenido sensible.

---

## Arquitectura

```
src/modules/caro-ia/
├── application/
│   ├── caro-ia.service.ts        # turno, streaming, aprobaciones, audio
│   ├── caro-ia.repository.port.ts
│   ├── caro-ia-verifier.ts       # verificador siempre activo
│   ├── caro-ia-retention.service.ts
│   ├── deepseek.client.ts        # puerto + HTTP
│   └── deepgram.client.ts        # puerto + HTTP
├── domain/                       # modelos y errores
├── infrastructure/
│   ├── adapters/persistence/     # PostgreSQL
│   └── http/                     # REST + SSE + multipart
└── caro-ia.module.ts

src/modules/mcp/application/catalog/mcp-tool-catalog.ts
```

`McpToolCatalog` reutiliza las tools MCP existentes, ejecutándolas con el
`Principal` del usuario (no con una API key global). Mantiene permisos,
redacción de PII, rate limit de escrituras y auditoría MCP.

La respuesta de DeepSeek se solicita sin stream al proveedor y el backend
emite los deltas SSE. Esto simplifica el flujo de tool calls y aprobaciones
sin cambiar el contrato de la UI.

---

## API

Todas las rutas requieren sesión y el permiso `caroIa:use`.

```text
GET    /caro-ia/conversations
POST   /caro-ia/conversations
GET    /caro-ia/conversations/:id
PATCH  /caro-ia/conversations/:id
DELETE /caro-ia/conversations/:id
POST   /caro-ia/conversations/:id/messages
POST   /caro-ia/conversations/:id/approvals/:approvalId
POST   /caro-ia/transcribe
```

Los dos endpoints de conversación devuelven **SSE** (`text/event-stream`):

```text
message.delta
tool.start
tool.result
approval.required
message.done
error
```

`POST /caro-ia/transcribe` recibe `multipart/form-data` con el campo `audio` y
devuelve `{ text, confidence, durationSeconds }`.

---

## Persistencia

Tablas en PostgreSQL (creadas por `PostgresDatabase.ensureSchema`):

- `caro_conversations` — dueño, título, fechas, borrado lógico.
- `caro_messages` — rol, contenido, tool calls y citas (`JSONB`).
- `caro_approvals` — tool, argumentos exactos (`JSONB`), resumen, estado y expiración.

No hay tabla de adjuntos. El borrado de una conversación es lógico; la
retención opcional elimina físicamente las conversaciones antiguas y sus
mensajes/aprobaciones en cascada.

---

## Permisos y configuración

Permiso nuevo: **`caroIa:use`**. El rol `admin` lo recibe automáticamente al
sincronizar el catálogo; el menú existente recibe el ítem CaroIA al arrancar.

Settings (`Administración → Configuración → CaroIA`):

| Clave | Defecto | Uso |
| --- | --- | --- |
| `caroIa.allowWrites` | `false` | Permite proponer escrituras (siempre requieren aprobación). |
| `caroIa.retentionDays` | `0` | Retención; `0` conserva para siempre. |
| `caroIa.maxMessageLength` | `4000` | Máximo de caracteres por mensaje. |
| `caroIa.messageRateLimitPerMinute` | `20` | Límite por usuario. |
| `caroIa.maxAudioSeconds` | `120` | Duración máxima del audio. |
| `caroIa.maxAudioBytes` | `10485760` | Tamaño máximo del audio. |

Una escritura requiere, además, `mcp.allowWrites`, el permiso MCP de la tool y
la aprobación humana. El MCP sigue siendo la única fuente de datos.

---

## Tests

```bash
# Backend
npm test
npx vitest run test/caro-ia.e2e-spec.ts --config ./vitest.config.e2e.ts
npx vitest run test/mcp.e2e-spec.ts --config ./vitest.config.e2e.ts

# Frontend
cd frontend
npx ng test shell --watch=false
npx ng test data-access --watch=false
npx ng test ui --watch=false
```

La suite de CaroIA cubre CRUD, stream de lectura con evidencia, creación de
aprobación y ejecución tras aprobar, rechazo de adjuntos, audio transcrito sin
persistencia y aislamiento entre usuarios/admin.

---

## Diferido

- Adjuntos PDF/DOCX/XLSX/CSV/imágenes, OCR y almacenamiento/descarga.
- Streaming nativo de DeepSeek (hoy se hace chunking en el backend).
- Reproductor de audio y audio almacenado.
- OAuth 2.1 para proveedores (la autenticación actual es sesión/API keys).

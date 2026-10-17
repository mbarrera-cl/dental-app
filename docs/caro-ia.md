# CaroIA — vista previa de UI (rama `feat/caro-ia-ui`)

CaroIA es el asistente de presupuestos de Hexa. Esta rama implementa **solo la
experiencia de usuario**, con un gateway simulado; el backend real (MCP,
DeepSeek, Deepgram, persistencia y aprobaciones) llega en
`feat/caro-ia-backend`.

---

## Cómo probarla

```bash
cd /Users/mbarrera/hexa
MCP_ENABLED=true npm run dev:all
```

1. Abre `http://localhost:4200` e inicia sesión.
2. Entra directamente a `http://localhost:4200/caro-ia`.
   - Todavía **no hay ítem en el menú lateral**: el permiso `caroIa:use` y el
     seed del menú se agregan en la rama backend.
3. La cabecera muestra el badge **“Vista previa · datos simulados”**.

Credenciales de desarrollo: `admin@hexa.local` / `Admin123!`.

---

## Qué incluye

- **Chat estilo Gemini/DeepSeek** con `ngx-prompt-kit`:
  - `pk-conversation-list`, `pk-chat-container`, `pk-user-turn`,
    `pk-assistant-turn`, `pk-markdown`, `pk-composer`, `pk-prompt-suggestion`
    y `pk-approval`.
- **Conversaciones simuladas**: agrupadas por Hoy/Ayer/Últimos 7 días/Anteriores,
  búsqueda, renombrar y eliminar.
- **Streaming simulado** con tool calls (`pk-tool` reemplazado por chips
  propios), citas y respuesta markdown.
- **Aprobaciones de escritura**: la conversación incluye un presupuesto por
  crear; al aprobar se simula la creación de `COT-2026-0007`.
- **Negativa fuera de alcance**: preguntas como “¿qué clima hace?” devuelven la
  negativa fija (“solo uso el MCP”).
- **Adjuntos**: botón de archivo del composer con chips de subida/estado
  (simulados). Formatos previstos: PDF, DOCX, XLSX, CSV, TXT, MD, imágenes y
  audio.
- **Audio**: botón de micrófono (`MediaRecorder`), temporizador y transcripción
  simulada que se inserta en el composer. La integración real con **Deepgram**
  se hace en la rama backend.
- **Tabla de conversaciones** como vista inicial (`/caro-ia`): título, último
  mensaje, actualizada, nº de mensajes y acciones. Ocupa todo el ancho y
  trunca los títulos largos con puntos suspensivos.
- **Chat** a pantalla completa, sin cabecera propia ni scroll de página: se
  abre al seleccionar una fila o crear una conversación, y solo scrollea el
  historial. El botón “Volver a conversaciones” regresa a la tabla.
- **i18n ES/EN** y diseño responsive (tabla/tarjetas, composer fijo).

---

## Contrato para el backend

La UI depende solo de `CaroIaGateway` (`projects/data-access/src/lib/caro-ia.gateway.ts`):

```ts
list(query?)            → CaroConversation[]
get(id)                 → CaroConversationDetail
create(input?)          → CaroConversation
rename(id, title)       → CaroConversation
remove(id)              → void
send(conversationId, { content, attachmentIds }) → Observable<CaroStreamEvent>
uploadAttachment(conversationId, file) → CaroAttachment
transcribeAudio(audio)  → CaroTranscription
decideApproval(conversationId, approvalId, decision) → Observable<CaroStreamEvent>
```

Eventos SSE esperados: `message.delta`, `tool.start`, `tool.result`,
`approval.required`, `attachment.processed`, `message.done`, `error`.

La rama backend solo debe:

1. Implementar `CaroIaHttpGateway` con HTTP + SSE.
2. Cambiar el provider en `frontend/projects/shell/src/app/app.config.ts`.
3. Añadir `caroIa:use`, `permissionGuard` en la ruta y el ítem de menú.

---

## Estructura

```
frontend/projects/data-access/src/lib/
├── caro-ia.model.ts        # tipos, eventos y agrupación por fecha
└── caro-ia.gateway.ts      # puerto de la UI

frontend/projects/shell/src/app/caro-ia/
├── caro-ia-page.ts/html    # tabla inicial + chat full-height
├── caro-ia.store.ts        # estado, streaming, adjuntos, aprobaciones
├── caro-ia.mock.ts         # gateway simulado y fixtures
├── caro-audio-recorder.ts  # MediaRecorder + temporizador
└── caro-ia.store.spec.ts   # pruebas del store

frontend/projects/ui/src/lib/prompt-kit/   # componentes generados (código propio)
```

Los componentes de prompt-kit se generaron con `ng add`/`ng generate` y se
adaptaron a Hexa:

- imports `@spartan-ng/helm/*` → `@ui/*`;
- textos de la lista de conversaciones parametrizados (ES/EN);
- `<pk-markdown>` sin imágenes externas (`FORBID_TAGS: ['img']`) para evitar
  fugas por URLs de imágenes;
- estilos de tablas/listas en `projects/shell/src/styles.css`.

---

## Tests

```bash
cd frontend
npx ng test shell --watch=false
npx ng test data-access --watch=false
npx ng test ui --watch=false
```

El store cubre: carga de conversaciones, streaming con tool call, aprobación,
transcripción y CRUD.

---

## Pendiente en `feat/caro-ia-backend`

- Catálogo MCP interno y orquestador DeepSeek (`tool_choice: 'required'`,
  `no_answer`, verificador siempre activo).
- Persistencia de conversaciones/mensajes/adjuntos/aprobaciones.
- Deepgram STT y extracción local de archivos.
- Guardrails configurables, rate limits y auditoría.
- Permiso `caroIa:use`, menú lateral y `permissionGuard`.
- Sustitución del gateway simulado y pruebas e2e reales.

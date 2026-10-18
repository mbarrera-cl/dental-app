# Auditoría de seguridad — estado y controles

Este documento resume la auditoría ejecutada sobre el backend NestJS y los
microfrontends Angular, los controles implementados y los riesgos residuales
aceptados.

## Controles implementados

| Área | Control | Ubicación |
|------|---------|-----------|
| JWT | El arranque falla en producción si `JWT_SECRET` falta, es el secreto de desarrollo o mide < 32 caracteres | `src/shared/security/jwt.ts` |
| JWT | Solo se acepta `alg: HS256`; se validan `iss` y `aud` | `src/shared/security/jwt.ts` |
| JWT | El access token vive en memoria del cliente; el refresh token en cookie httpOnly | `auth.controller.ts`, `refresh-cookie.ts` |
| CSRF | Se rechazan mutaciones con `Origin` no permitido | `origin-guard.middleware.ts` |
| CORS | `CORS_ORIGIN` es obligatorio en producción | `app-setup.ts` |
| Cabeceras | helmet: nosniff, frameguard, HSTS (prod), CORP; CSP en report-only | `app-setup.ts` |
| Rate limiting | Throttler global + límites estrictos en auth y transcripción | `app.module.ts`, controladores |
| Enumeración | Timing igualado con scrypt dummy para emails desconocidos | `password-hasher.ts`, `login.use-case.ts` |
| Fugas | Los errores 500 devuelven un payload genérico | `domain-exception.filter.ts` |
| Exposición | Swagger `/docs` deshabilitado por defecto en producción | `app-setup.ts` |
| XSS | HTML del modelo sanitizado con DOMPurify (solo perfil HTML); emails escapados con `sanitize-html` | `pk-markdown.ts`, `agenda-template.service.ts` |
| SQLi | Consultas parametrizadas; identificadores dinámicos desde literales | repositorios |
| LFI | Assets servidos desde DB; `:variant` validado contra enum | `get-asset.use-case.ts` |
| Uploads | Límite de bytes, magic bytes y `limitInputPixels` de sharp | `clinic-asset.ts`, `sharp-image-processor.ts` |
| MCP | Cada herramienta revalida permisos del `Principal` | `mcp-tool-catalog.ts`, `mcp-tool-runner.ts` |

## Variables de entorno obligatorias en producción

```dotenv
JWT_SECRET=<openssl rand -base64 48>
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

Opcionales: `JWT_ISSUER`, `JWT_AUDIENCE`, `COOKIE_SAMESITE`, `COOKIE_SECURE`,
`THROTTLE_TTL_MS`, `THROTTLE_LIMIT`.

## Riesgos residuales (aceptados y documentados)

1. **Enumeración por bloqueo**: un atacante puede inferir que una cuenta existe
   al recibir `423 Locked` tras N intentos. Se mantiene por usabilidad; el
   rate limiting reduce la viabilidad.
2. **CSP en report-only**: debe promoverse a enforcing tras observar reportes
   en el entorno real (microfrontends, import maps y assets lazy).
3. **Dependencias dev**: `@nestjs/mau`/`undici` presentan CVEs en dependencias
   de desarrollo. Producción queda limpia (`npm audit --omit=dev`).
4. **katex < 0.19** (frontend, severidad baja vía mermaid): actualizar cuando
   mermaid publique una versión compatible.
5. **Retención de auditoría**: `activity_log` guarda IP y User-Agent (PII).
   Definir política de retención/anonimización.
6. **Cookie de refresh**: se mantiene `SameSite=Lax` por defecto. Si un
   despliegue requiere `SameSite=None`, debe usar `Secure` y la guarda de
   Origin ya cubre el vector CSRF.

## Comandos de verificación

```bash
npm audit --omit=dev
npm test
npm run test:e2e
npm run frontend:test
```

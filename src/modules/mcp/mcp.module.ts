import { Module } from '@nestjs/common';
import { MCP_STRATEGY } from '@rekog/mcp-nest';
import { ActivityModule } from '../activity/activity.module.js';
import { ApiKeysModule } from '../apikeys/apikeys.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UcoModule } from '../uco/uco.module.js';
import { McpToolRunner } from './application/base/mcp-tool-runner.js';
import { McpToolCatalog } from './application/catalog/mcp-tool-catalog.js';
import { ActivityFacade } from './application/facades/activity.facade.js';
import { PatientsFacade } from './application/facades/patients.facade.js';
import { QuotesFacade } from './application/facades/quotes.facade.js';
import { UcoFacade } from './application/facades/uco.facade.js';
import { ActivityTools } from './application/tools/activity.tools.js';
import { CalcTools } from './application/tools/calc.tools.js';
import { IdentityTools } from './application/tools/identity.tools.js';
import { PatientsTools } from './application/tools/patients.tools.js';
import { QuotesPrompts } from './application/prompts/quotes.prompts.js';
import { QuotesTools } from './application/tools/quotes.tools.js';
import { UcoTools } from './application/tools/uco.tools.js';
import { McpEnabledGuard } from './infrastructure/http/mcp-enabled.guard.js';
import { McpHttpController } from './infrastructure/http/mcp-http.controller.js';
import { mcpStrategy } from './mcp.strategy.js';

/**
 * MCP composition root. Capability classes live in `controllers` (MCP-Nest v2
 * registers them as Nest microservice message handlers); the strategy is
 * provided so bootstrap code can connect it to the HTTP adapter.
 *
 * Adding a domain: add a facade + a `@McpController` with `@Tool` methods and
 * register both here. The transport and security layers stay untouched.
 */
@Module({
  imports: [SettingsModule, ActivityModule, ApiKeysModule, PatientsModule, UcoModule, QuotesModule],
  controllers: [
    McpHttpController,
    IdentityTools,
    PatientsTools,
    UcoTools,
    QuotesTools,
    QuotesPrompts,
    ActivityTools,
    CalcTools,
  ],
  providers: [
    McpEnabledGuard,
    McpToolRunner,
    McpToolCatalog,
    QuotesTools,
    PatientsTools,
    UcoTools,
    ActivityTools,
    CalcTools,
    PatientsFacade,
    UcoFacade,
    QuotesFacade,
    ActivityFacade,
    { provide: MCP_STRATEGY, useValue: mcpStrategy },
  ],
  exports: [McpToolCatalog],
})
export class McpModule {}

import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { catchError, concatMap, from, mergeMap, throwError, type Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../../../shared/security/authenticated-request.js';
import type { ActivityActorRef, ActivityOutcome } from '../../domain/activity-entry.js';
import { ActivityRecorder, type RecordActivityInput } from '../../application/record-activity.service.js';
import { activityStatusOf } from './activity-status.js';
import {
  ACTIVITY_ACTION_METADATA,
  ACTIVITY_SKIP_METADATA,
  type ActivityActionOptions,
} from './activity-action.decorator.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const MODULE_BY_CONTROLLER: Readonly<Record<string, string>> = {
  ApiKeys: 'apikeys',
  Auth: 'auth',
  CaroIa: 'caroIa',
  Clinic: 'clinic',
  Clinical: 'clinical',
  Consents: 'consents',
  Navigation: 'navigation',
  Patients: 'patients',
  Permissions: 'roles',
  Prescriptions: 'prescriptions',
  Roles: 'roles',
  Settings: 'settings',
  Users: 'users',
};

/**
 * Cross-cutting audit adapter: turns every mutating request (and the few reads
 * that must be audited, like opening a clinical record) into one activity
 * entry. The recorder applies the administrator's settings, so this class only
 * decides *what* the candidate entry is.
 *
 * Ordinary GETs are ignored on purpose: logging every read at scale is noise
 * (and was the source of a former request storm).
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly recorder: ActivityRecorder,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const handler = context.getHandler();
    const controller = context.getClass();

    if (this.reflector.getAllAndOverride<boolean>(ACTIVITY_SKIP_METADATA, [handler, controller])) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method.toUpperCase();
    const isMutation = MUTATION_METHODS.has(method);
    const decorated = this.reflector.get<ActivityActionOptions | undefined>(
      ACTIVITY_ACTION_METADATA,
      handler,
    );

    if (!isMutation && !decorated) {
      return next.handle();
    }

    const options: ResolvedActionOptions =
      decorated === undefined
        ? fallbackOptions(context, method)
        : { ...decorated, module: decorated.module ?? decorated.action.split('.')[0] };
    const statusCode = this.successStatus(context);

    return next.handle().pipe(
      concatMap(async (value: unknown) => {
        await this.record(request, options, 'success', statusCode);

        return value;
      }),
      catchError((error: unknown) =>
        from(this.record(request, options, 'failure', activityStatusOf(error))).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  private successStatus(context: ExecutionContext): number {
    const explicit = this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler());

    if (explicit !== undefined) {
      return explicit;
    }

    return context.switchToHttp().getRequest<AuthenticatedRequest>().method.toUpperCase() === 'POST'
      ? 201
      : 200;
  }

  /** Never throws: a failed audit write must not alter the response. */
  private async record(
    request: AuthenticatedRequest,
    options: ResolvedActionOptions,
    outcome: ActivityOutcome,
    statusCode: number | null,
  ): Promise<void> {
    try {
      await this.recorder.record(this.toInput(request, options, outcome, statusCode));
    } catch (error) {
      this.logger.warn(
        `Activity capture failed for "${options.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private toInput(
    request: AuthenticatedRequest,
    options: ResolvedActionOptions,
    outcome: ActivityOutcome,
    statusCode: number | null,
  ): RecordActivityInput {
    const principal = request.user;
    const actor: ActivityActorRef =
      principal === undefined
        ? { id: null, type: 'anonymous', label: null }
        : { id: principal.userId, type: principal.type };

    const subjectId =
      options.subjectParam === undefined
        ? null
        : ((request.params?.[options.subjectParam] as string | undefined) ?? null);

    const body: unknown = request.body;
    const subjectLabel =
      options.subjectLabel === undefined ? null : options.subjectLabel(body);

    return {
      actor,
      action: options.action,
      module: options.module,
      outcome,
      statusCode,
      method: request.method,
      path: request.path,
      route: routePatternOf(request),
      subject:
        options.subjectType === undefined && subjectId === null
          ? null
          : {
              type: options.subjectType ?? null,
              id: subjectId,
              label: subjectLabel,
            },
      ip: request.ip ?? request.socket?.remoteAddress ?? null,
      userAgent: userAgentOf(request),
      metadata:
        principal?.type === 'apikey' && principal.apiKeyId !== undefined
          ? { apiKeyId: principal.apiKeyId }
          : null,
    };
  }
}

interface ResolvedActionOptions {
  action: string;
  module: string;
  subjectType?: string;
  subjectParam?: string;
  subjectLabel?: (body: unknown) => string | null;
}

/** Safety net for a mutating endpoint that was not annotated. */
function fallbackOptions(context: ExecutionContext, method: string): ResolvedActionOptions {
  const controllerName = context.getClass().name.replace(/Controller$/, '');
  const module = MODULE_BY_CONTROLLER[controllerName] ?? controllerName.toLowerCase();
  const verb =
    method === 'POST'
      ? 'create'
      : method === 'DELETE'
        ? 'delete'
        : method === 'PUT'
          ? 'replace'
          : 'update';

  return { action: `${module}.${verb}`, module };
}

function routePatternOf(request: AuthenticatedRequest): string | null {
  const route = (request as unknown as { route?: { path?: unknown } }).route;
  const path = route?.path;

  return typeof path === 'string' ? path : null;
}

function userAgentOf(request: AuthenticatedRequest): string | null {
  const header = request.headers?.['user-agent'];

  if (typeof header === 'string') {
    return header;
  }

  return Array.isArray(header) ? (header[0] ?? null) : null;
}

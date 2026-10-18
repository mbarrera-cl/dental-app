import { HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';
import { DomainExceptionFilter } from './domain-exception.filter.js';

class TestDomainError extends DomainError {
  constructor(
    readonly kind: DomainErrorKind,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message, { details });
  }
}

function createHost(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps known domain kinds to their status and keeps the message', () => {
    const { host, status, json } = createHost();

    filter.catch(
      new TestDomainError('not_found', 'Patient not found', { id: 'p-1' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'TestDomainError',
      message: 'Patient not found',
      details: { id: 'p-1' },
    });
  });

  it('never leaks internal details for unexpected errors', () => {
    const { host, status, json } = createHost();

    filter.catch(
      new TestDomainError('unexpected', 'relation "users" does not exist', {
        query: 'SELECT * FROM users',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Internal server error',
    });
  });
});

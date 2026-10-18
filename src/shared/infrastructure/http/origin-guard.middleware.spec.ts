import type { Request, Response } from 'express';
import { createOriginGuard } from './origin-guard.middleware.js';

function createResponse(): {
  response: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });

  return { response: { status } as unknown as Response, status, json };
}

function createRequest(method: string, origin?: string): Request {
  return {
    method,
    headers: origin === undefined ? {} : { origin },
  } as unknown as Request;
}

describe('createOriginGuard', () => {
  const guard = createOriginGuard(['http://localhost:4200', 'https://app.example.com']);

  it('allows safe methods regardless of origin', () => {
    const next = vi.fn();
    const { response, status } = createResponse();

    guard(createRequest('GET', 'https://evil.example'), response, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('allows state-changing requests from an allowlisted origin', () => {
    const next = vi.fn();
    const { response, status } = createResponse();

    guard(createRequest('POST', 'https://app.example.com'), response, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('blocks state-changing requests from a foreign origin', () => {
    const next = vi.fn();
    const { response, status, json } = createResponse();

    guard(createRequest('POST', 'https://evil.example'), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Origin not allowed' }),
    );
  });

  it('allows non-browser clients that send no Origin header', () => {
    const next = vi.fn();
    const { response, status } = createResponse();

    guard(createRequest('DELETE'), response, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
});

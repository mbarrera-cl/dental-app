/**
 * Domain model shared by the remotes. Mirrors the JSON returned by the
 * backend (`user-response.dto.ts`).
 */
export interface User {
  id: string;
  email: string;
  name: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Payload accepted by `POST /users` (mirrors the backend validation rules). */
export interface CreateUserPayload {
  name: string;
  email: string;
}

/** Payload accepted by `PATCH /users/:id`: every field is optional. */
export interface UpdateUserPayload {
  name?: string;
  email?: string;
}

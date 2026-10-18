import { Entity } from '../../../shared/domain/entity.js';
import { InvalidConsentError } from './consent.errors.js';

export interface ConsentTemplateProps {
  key: string;
  title: string;
  body: string;
  version: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConsentTemplateProps {
  key: string;
  title: string;
  body: string;
  active?: boolean;
}

export interface UpdateConsentTemplateProps {
  title?: string;
  body?: string;
  active?: boolean;
}

const MAX_KEY_LENGTH = 60;
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 20_000;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A reusable informed-consent text. Editing the title or the body bumps the
 * version, so a signed record can always be traced back to the exact wording
 * the patient accepted.
 */
export class ConsentTemplate extends Entity<ConsentTemplateProps> {
  private constructor(props: ConsentTemplateProps, id?: string) {
    super(props, id);
  }

  static create({
    key,
    title,
    body,
    active = true,
  }: CreateConsentTemplateProps): ConsentTemplate {
    const now = new Date();

    return new ConsentTemplate({
      key: normalizeConsentKey(key),
      title: requireText(title, 'title', MAX_TITLE_LENGTH),
      body: requireText(body, 'body', MAX_BODY_LENGTH),
      version: 1,
      active,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ConsentTemplateProps, id: string): ConsentTemplate {
    return new ConsentTemplate(props, id);
  }

  get key(): string {
    return this.props.key;
  }

  get title(): string {
    return this.props.title;
  }

  get body(): string {
    return this.props.body;
  }

  get version(): number {
    return this.props.version;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Edits the template; a wording change bumps `version`. */
  update({ title, body, active }: UpdateConsentTemplateProps): void {
    let contentChanged = false;

    if (title !== undefined) {
      const normalized = requireText(title, 'title', MAX_TITLE_LENGTH);
      contentChanged = contentChanged || normalized !== this.props.title;
      this.props.title = normalized;
    }

    if (body !== undefined) {
      const normalized = requireText(body, 'body', MAX_BODY_LENGTH);
      contentChanged = contentChanged || normalized !== this.props.body;
      this.props.body = normalized;
    }

    if (active !== undefined) {
      this.props.active = active;
    }

    if (contentChanged) {
      this.props.version += 1;
    }

    this.props.updatedAt = new Date();
  }
}

/** `  Extraccion  ` → `extraccion`; rejects anything that is not a slug. */
export function normalizeConsentKey(value: string): string {
  if (typeof value !== 'string') {
    throw new InvalidConsentError('"key" must be a string');
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length > MAX_KEY_LENGTH) {
    throw new InvalidConsentError(
      `"key" must have between 1 and ${MAX_KEY_LENGTH} characters`,
    );
  }

  if (!KEY_PATTERN.test(normalized)) {
    throw new InvalidConsentError(
      '"key" must be a lowercase slug (letters, digits and hyphens)',
    );
  }

  return normalized;
}

function requireText(value: string, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new InvalidConsentError(`"${field}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidConsentError(`"${field}" must not be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new InvalidConsentError(
      `"${field}" must have at most ${maxLength} characters`,
    );
  }

  return trimmed;
}

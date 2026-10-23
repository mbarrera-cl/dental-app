import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes a small subset of rich text coming from the WYSIWYG editors (plan
 * notes, item notes). The editor produces simple HTML (paragraphs, emphasis,
 * lists); we allow exactly that and discard everything else, so no script,
 * style, event handler or external reference can be stored and later rendered.
 *
 * Returns `''` for content that sanitizes down to nothing.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
  }).trim();
}

/** `true` when the HTML carries no visible content (only empty markup). */
export function isEmptyRichText(html: string): boolean {
  return (
    sanitizeRichText(html)
      .replace(/<(br|hr)\s*\/?>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  );
}

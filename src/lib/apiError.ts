/**
 * Turning an API error payload into a sentence a person can read.
 *
 * Every route in this app answers a validation failure with Zod's issue list
 * (`{ error: error.errors }`) — an array of objects, not a string. Several
 * callers put that value straight into a string-typed error state or a toast,
 * which puts an object into JSX; React then throws "Objects are not valid as a
 * React child" and the ErrorBoundary replaces the whole screen. A one-character
 * full name on the sign-up form was enough to take the page down, and the
 * message that would have explained the problem never appeared.
 *
 * Other callers interpolated the same value into a template literal and showed
 * the user "[object Object]", which is not a crash but is not an error message
 * either.
 *
 * This is the one place that decides what an error payload reads as, so a route
 * that starts returning a different shape is handled everywhere at once.
 */

function issueMessage(issue: unknown): string {
  if (issue && typeof issue === 'object' && 'message' in issue) {
    const message = (issue as { message: unknown }).message;
    if (typeof message === 'string') return message.trim();
  }
  return '';
}

/**
 * @param error  whatever a route returned under `error`
 * @param fallback shown when the payload carries nothing readable
 */
export function errorText(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error.trim();

  // Zod's issue list. Joined rather than reduced to the first one: a form that
  // failed three rules should say so, the way the field-level messages would.
  if (Array.isArray(error)) {
    const messages = error.map(issueMessage).filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }

  const single = issueMessage(error);
  if (single) return single;

  return fallback;
}

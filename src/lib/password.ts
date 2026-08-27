import { z } from 'zod';

/**
 * The one definition of what makes an acceptable password.
 *
 * These rules were previously written out separately in the signup route, the
 * admin account-provisioning route and the login form's client-side check. Three
 * copies of a rule drift: the reset-password page added later would have been a
 * fourth chance to disagree with the other three, and the mismatch only shows up
 * when someone is locked out.
 */
export const PASSWORD_RULES = {
  minLength: 8,
  /** Shown to the user verbatim, so the form and the API say the same thing. */
  summary: 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.',
} as const;

export const passwordSchema = z
  .string()
  .min(PASSWORD_RULES.minLength, `Password must be at least ${PASSWORD_RULES.minLength} characters`)
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/**
 * Client-side check for forms that validate before submitting. Returns the first
 * failing rule's message, or null when the password is acceptable.
 */
export function checkPassword(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  return result.success ? null : result.error.errors[0]?.message ?? 'Invalid password';
}

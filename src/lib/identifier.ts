import { z } from 'zod';

/**
 * The one place that decides what an email or Student ID typed by a person
 * really is.
 *
 * Sign-in used to test the raw text for a literal '@', so an address that looked
 * complete on screen could still be treated as a Student ID or rejected as a
 * wrong password: a full-width '＠' from a phone keyboard, an address copied out
 * of Messenger with invisible bidi marks around it, or a stray space all
 * defeated the check. Every form and route that takes an address goes through
 * here, so the address a parent signs up with is the one they sign in with.
 */

export const STUDENT_ID_PATTERN = /^PUP-\d{4}-[A-Z0-9]+$/;

// Zero-width characters, bidi marks and isolates, the word joiner and the BOM:
// none can be part of an address, and none are removed by trim().
const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁩﻿]/g;

const EMAIL = z.string().email();

/**
 * Folds look-alike characters into their plain forms (NFKC turns '＠' into '@'
 * and full-width letters into ASCII) and drops invisible characters and all
 * whitespace, which no email or Student ID contains.
 */
function clean(raw: string): string {
  return raw.normalize('NFKC').replace(INVISIBLE, '').replace(/\s+/g, '');
}

/** An email address in the form it is stored and compared in: cleaned, lower-case. */
export function normalizeEmail(raw: string): string {
  return clean(raw).toLowerCase();
}

export type Identifier =
  | { kind: 'email'; value: string }
  | { kind: 'student_id'; value: string }
  | { kind: 'invalid'; value: string };

/** Reads a sign-in identifier as an email, a Student ID, or neither. */
export function parseIdentifier(raw: string): Identifier {
  const value = clean(raw);
  const upper = value.toUpperCase();
  if (STUDENT_ID_PATTERN.test(upper)) return { kind: 'student_id', value: upper };
  const email = value.toLowerCase();
  if (EMAIL.safeParse(email).success) return { kind: 'email', value: email };
  return { kind: 'invalid', value };
}

/** zod field for any email a person types: cleaned first, then validated. */
export const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? normalizeEmail(v) : v),
  z.string().email('Invalid email address').max(254)
);

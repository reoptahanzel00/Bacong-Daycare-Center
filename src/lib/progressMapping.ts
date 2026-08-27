/**
 * Translation between the storage layout and the client contract for ECCD
 * progress observations.
 *
 * The UI works in four human-readable domains and three rating labels; the
 * database stores compact domain ids and a status enum. Both the API route and
 * the server-side initial-data loader read the same rows, so these tables live
 * here rather than in either caller — a second copy would drift and silently
 * render raw ids like `socio-emotional` in one path and the label in the other.
 */

export const DOMAIN_LABEL_TO_ID: Record<string, string> = {
  'Motor Skills': 'motor',
  'Language & Communication': 'language',
  'Socio-Emotional': 'socio-emotional',
  'Self-Help & Cognitive': 'self-help',
};

export const DOMAIN_ID_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(DOMAIN_LABEL_TO_ID).map(([label, id]) => [id, label])
);

export const RATING_TO_STATUS: Record<string, string> = {
  'Demonstrates Mastery': 'Present',
  'Developing': 'In_Progress',
  'Developing / Progressing': 'In_Progress',
  'Needs Practice': 'Not_Yet_Observed',
  'Needs Practice / Assistance': 'Not_Yet_Observed',
};

export const STATUS_TO_RATING: Record<string, string> = {
  Present: 'Demonstrates Mastery',
  In_Progress: 'Developing',
  Not_Yet_Observed: 'Needs Practice',
};

interface ObservationRow {
  domain_id?: string;
  observation_date?: string;
  status_rating?: string | null;
  [key: string]: unknown;
}

/** Maps a stored observation row onto the shape the client renders. */
export function toClientObservation(row: ObservationRow) {
  const { domain_id, observation_date, status_rating, ...rest } = row;
  return {
    ...rest,
    domain: (domain_id && DOMAIN_ID_TO_LABEL[domain_id]) || domain_id,
    date: observation_date,
    rating: status_rating ? STATUS_TO_RATING[status_rating] || status_rating : undefined,
  };
}

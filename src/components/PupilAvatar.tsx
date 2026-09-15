import Image from 'next/image';

interface PupilAvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  /** Rendered size in pixels (square). */
  size: number;
  className?: string;
}

/**
 * A pupil's photo when one has been recorded, otherwise their initials.
 *
 * There is deliberately no stock-photo fallback: a placeholder face reads as
 * the child's own picture, which is exactly the kind of inaccurate record the
 * system exists to replace.
 */
export default function PupilAvatar({ src, firstName = '', lastName = '', size, className = '' }: PupilAvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={`${firstName} ${lastName}`.trim() || 'Pupil photo'}
        width={size}
        height={size}
        className={`object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 bg-primary-light text-primary font-extrabold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {initials}
    </span>
  );
}

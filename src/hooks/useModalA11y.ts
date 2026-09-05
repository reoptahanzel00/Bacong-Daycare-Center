'use client';

import { useEffect, useRef } from 'react';

/**
 * Dialog semantics and focus management for the app's modals.
 *
 * Every modal in this app was a plain <div> overlay: no role, no aria-modal, no
 * Escape handler and no focus trap. A keyboard user who opened the pupil form
 * tabbed straight out of it into the page behind, with no way back and no cue
 * that a dialog was still open, and a screen reader was never told a dialog had
 * opened at all.
 *
 * The hook is shared rather than written per modal because there are eleven of
 * them and they will not stay in sync by hand -- and because a modal added
 * later gets this by using the same two lines as its neighbours.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Ids for headings that have none, so aria-labelledby has something to point at. */
let headingSeq = 0;

export interface ModalA11yProps {
  ref: React.RefObject<HTMLDivElement | null>;
  role: 'dialog';
  'aria-modal': true;
  tabIndex: -1;
}

/**
 * Returns props to spread onto a modal's outermost element.
 *
 * ```tsx
 * const dialogProps = useModalA11y(isOpen, onClose);
 * if (!isOpen) return null;
 * return <div {...dialogProps} className="fixed inset-0 ...">
 * ```
 *
 * Call it before any early return: hooks cannot be called conditionally.
 */
export function useModalA11y(isOpen: boolean, onClose: () => void): ModalA11yProps {
  const ref = useRef<HTMLDivElement>(null);

  // Held in a ref so the effect depends on `isOpen` alone. Depending on
  // `onClose` would re-run the whole effect on every parent render, which would
  // yank focus back to the first field while someone was typing in the third.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const node = ref.current;
    if (!isOpen || !node) return;

    // Whatever opened the dialog, so focus can be handed back on close.
    const opener = document.activeElement as HTMLElement | null;

    // Name the dialog from its own heading rather than a prop, so a modal
    // cannot be announced as "dialog" with no title because someone forgot to
    // pass one. Headings here are <h3> by house style; <h1>/<h2> are accepted
    // so this keeps working if that changes.
    const heading = node.querySelector('h1, h2, h3');
    if (heading) {
      if (!heading.id) heading.id = `modal-title-${++headingSeq}`;
      node.setAttribute('aria-labelledby', heading.id);
    }

    // getClientRects() rather than offsetParent: it also excludes controls
    // hidden behind `display: none` in a collapsed section of the form.
    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0
      );

    // Focus enters the dialog. Falling back to the container (tabIndex -1)
    // means even an empty dialog takes focus rather than leaving it behind on
    // the page underneath.
    (focusable()[0] ?? node).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends, so Tab cycles within the dialog instead of walking
      // out into the page behind it.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Back to the button that opened it -- a keyboard user should not be
      // returned to the top of the page after closing a dialog.
      opener?.focus?.();
    };
  }, [isOpen]);

  return { ref, role: 'dialog', 'aria-modal': true, tabIndex: -1 };
}

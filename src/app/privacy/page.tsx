import Link from 'next/link';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice';

/**
 * Privacy notice shown before a parent creates an account.
 *
 * The body text below is a PLACEHOLDER. It describes what this system actually
 * does with personal data, which is the accurate part — but the wording that
 * satisfies RA 10173 has to come from the barangay's Data Protection Officer,
 * not from the people who wrote the software. Replace `NOTICE_BODY` and bump
 * `PRIVACY_NOTICE_VERSION` before launch; the version is stored against each
 * account so a later change can require re-consent.
 */

export const metadata = {
  title: 'Privacy Notice — Barangay Bacong Daycare Center',
};

const NOTICE_BODY: Array<{ heading: string; body: string }> = [
  {
    heading: 'What we collect',
    body:
      "Your child's full name, date of birth, sex, and home address; your name, relationship to the child, and contact number; the sociodemographic details of the ECCD Form (parents' names, ages, occupations and education, number of siblings, birth order); daily attendance; developmental observations against the DepEd ECCD checklist; and height and weight records.",
  },
  {
    heading: 'Why we collect it',
    body:
      'To enrol your child, keep the daily attendance register, record developmental progress against the ECCD checklist, monitor nutrition and growth, and produce the reports the Barangay and the DSWD require.',
  },
  {
    heading: 'Who can see it',
    body:
      'The Daycare Worker and the Barangay Admin can see your child’s full record. Barangay Officials see enrolment and attendance figures for oversight and reporting. Other parents cannot see your child’s record. Access is enforced by the database itself, not only by the screens.',
  },
  {
    heading: 'How long we keep it',
    body:
      'PLACEHOLDER — the retention period must be set by the Barangay and stated here before this notice is published.',
  },
  {
    heading: 'Your rights',
    body:
      'Under the Data Privacy Act of 2012 you may ask to see the information held about you and your child, ask for corrections, object to processing, and complain to the National Privacy Commission. PLACEHOLDER — add the contact details of the Barangay’s Data Protection Officer here.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-line shadow-sm p-8 space-y-6">

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary-light text-primary flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink m-0">Privacy Notice</h1>
            <p className="text-xs text-ink-muted mt-0.5 m-0">
              Barangay Bacong Daycare Center &middot; Data Privacy Act of 2012 (RA 10173)
            </p>
          </div>
        </div>

        {/* Deliberately loud, and deliberately shipped: a silent placeholder is
            how a draft notice ends up published as though it were approved. */}
        <div className="p-4 rounded-2xl bg-warn-light border border-warn-border flex items-start gap-3">
          <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" />
          <p className="text-xs text-warn font-semibold m-0 leading-relaxed">
            This notice is a working draft written by the development team. It must be reviewed
            and replaced with wording approved by the Barangay&rsquo;s Data Protection Officer
            before the system is used with real children&rsquo;s records.
          </p>
        </div>

        <div className="space-y-5">
          {NOTICE_BODY.map((section) => (
            <section key={section.heading} className="space-y-1.5">
              <h2 className="text-sm font-bold text-ink m-0">{section.heading}</h2>
              <p className="text-xs text-ink-muted leading-relaxed m-0">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="pt-4 border-t border-line flex items-center justify-between gap-4">
          <span className="text-[11px] text-ink-subtle">Version: {PRIVACY_NOTICE_VERSION}</span>
          <Link
            href="/login"
            className="text-xs font-bold text-primary hover:text-primary-hover no-underline"
          >
            Back to sign in
          </Link>
        </div>

      </div>
    </div>
  );
}

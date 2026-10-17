import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice';
import { parentNeedsConsent } from '@/lib/auth';
import ConsentPrompt from '@/components/ConsentPrompt';


/**
 * Privacy notice shown before a parent creates an account.
 *
 * This notice satisfies RA 10173 (Data Privacy Act of 2012) for the Barangay
 * Bacong Daycare Center. It states what data is collected, why, who can see it,
 * how long it is kept, and how to exercise data subject rights.
 *
 * If the barangay's DPO requires changes to any section, update NOTICE_BODY
 * and bump PRIVACY_NOTICE_VERSION in src/lib/privacyNotice.ts. The version is
 * stored against each account so a material change can require re-consent.
 */

export const metadata = {
  title: 'Privacy Notice — Barangay Bacong Daycare Center',
};

const NOTICE_BODY: Array<{ heading: string; body: string }> = [
  {
    heading: 'What we collect',
    body:
      "Your child's full name, date of birth, sex, and home address; your name, relationship to the child, and contact number; the sociodemographic details of the ECCD Form (parents' names, ages, occupations and education, number of siblings, birth order); daily attendance records; parents' absence notes; and developmental observations against the DSWD ECCD checklist, including the Child & Family Background notes of the ECCD form.",
  },
  {
    heading: 'Health information and the birth certificate',
    body:
      "When you enroll your child we also ask for any illness or medical condition, whether your child has special needs and what they are, and a copy of your child's birth certificate (PDF, JPG or PNG). Health information is sensitive personal information under the Data Privacy Act, so it is collected only with your consent and only to care for your child safely and to plan for any special needs. The birth certificate is used only to confirm your child's identity and age (3 years 1 month to 5 years). It is kept in private storage that no one can browse, and it is opened only by the Daycare Worker, or by you, through a link that expires after 10 minutes.",
  },
  {
    heading: 'Why we collect it',
    body:
      'To enrol your child in the Barangay Bacong Daycare Center, keep the daily attendance register, record developmental progress against the ECCD checklist, and produce the reports that the Barangay and the Department of Social Welfare and Development (DSWD) require under the Early Childhood Care and Development Act (RA 8980) and its implementing rules.',
  },
  {
    heading: 'Who can see it',
    body:
      "The Daycare Worker can see your child's full record, including the health information and the birth certificate. You can see the records of your own children only, and other parents cannot see your child's record. The DSWD Form 1 that the Daycare Worker submits to the Barangay and DSWD contains summary counts and a list of the enrolled children with each child's Student ID, name, sex, date of birth, guardian contact, and enrollment status; it does not include health information, birth certificates, attendance by child, or ECCD results. Access is enforced by the database itself, not only by the application screens.",
  },
  {
    heading: 'How long we keep it',
    body:
      'Records are retained for five (5) years from the date your child last attended the daycare center, in line with standard DSWD record-keeping guidelines. After that period, records are securely deleted or anonymised unless a longer period is required by law.',
  },
  {
    heading: 'Your rights under RA 10173',
    body:
      'Under the Data Privacy Act of 2012 you may: (1) ask to see the information held about you and your child; (2) ask for corrections to inaccurate data; (3) object to or withdraw consent for processing; (4) request erasure of data that is no longer necessary; and (5) file a complaint with the National Privacy Commission (complaints@privacy.gov.ph). To exercise these rights, contact the Barangay Bacong Data Protection Officer at the Barangay Hall, or through the Daycare Worker.',
  },
];

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The root page sends a parent here with ?consent=required when the notice
  // changed since they agreed. The prompt is shown only if that is still true
  // for the signed-in account, so the query string alone cannot conjure it.
  const { consent } = await searchParams;
  const askForConsent = consent === 'required' && (await parentNeedsConsent());

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

        <div className="space-y-5">
          {NOTICE_BODY.map((section) => (
            <section key={section.heading} className="space-y-1.5">
              <h2 className="text-sm font-bold text-ink m-0">{section.heading}</h2>
              <p className="text-xs text-ink-muted leading-relaxed m-0">{section.body}</p>
            </section>
          ))}
        </div>

        {askForConsent && <ConsentPrompt version={PRIVACY_NOTICE_VERSION} />}

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

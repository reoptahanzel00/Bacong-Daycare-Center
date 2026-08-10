import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  title: 'Barangay Bacong Daycare Center Tracker',
  description: 'Student Progress, Enrollment, and Daily Attendance Tracker with 4-Domain ECCD Evaluation & DSWD PDF Reporting.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bacong Daycare',
  },
};

export function generateViewport() {
  return {
    themeColor: '#2F8F8A',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable} suppressHydrationWarning>
      <body className="font-sans bg-[#FAF8F5] text-[#2B2B2B] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

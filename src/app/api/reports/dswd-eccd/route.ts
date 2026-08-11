import { NextResponse } from 'next/server';
import { getServerSession, authorizeRole } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  if (!authorizeRole(session.role, ['worker', 'official', 'barangay_admin'])) {
    return NextResponse.json(
      { error: 'Unauthorized: Only staff and officials can generate DSWD reports.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const schoolYear = searchParams.get('sy') || 'SY 2025-2026';

  // DSWD Form 1 Summary Metrics
  const dswdReport = {
    barangay: 'Barangay Bacong',
    facilityName: 'Barangay Bacong Daycare Center',
    schoolYear: schoolYear,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalEnrolled: 22,
      malePupils: 12,
      femalePupils: 10,
      averageMonthlyAttendanceRate: 94.2,
      consecutiveAbsenceFlags: 1,
      developmentalObservedCount: 45,
    },
    eccdDomainBreakdown: {
      motorSkills: { evaluated: 22, milestoneAchievedPercent: 91.5 },
      languageCommunication: { evaluated: 22, milestoneAchievedPercent: 88.0 },
      socioEmotional: { evaluated: 22, milestoneAchievedPercent: 95.0 },
      selfHelpCognitive: { evaluated: 22, milestoneAchievedPercent: 92.3 },
    },
  };

  return NextResponse.json(dswdReport);
}

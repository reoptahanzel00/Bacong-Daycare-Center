import { NextResponse } from 'next/server';

export async function GET() {
  // Unauthenticated liveness probe: report readiness only. Environment and
  // version details are withheld so an anonymous caller learns nothing about
  // the deployment.
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}

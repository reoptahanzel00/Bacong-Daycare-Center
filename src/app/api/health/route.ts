import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Barangay Bacong Daycare Center Tracker',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
}

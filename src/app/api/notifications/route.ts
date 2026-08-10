import { NextResponse } from 'next/server';
import { z } from 'zod';

const NotificationSchema = z.object({
  recipient_id: z.string(),
  pupil_id: z.string().optional(),
  type: z.enum(['consecutive_absences', 'announcement', 'milestone']),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  channel: z.enum(['SMS', 'EMAIL', 'PORTAL']).default('PORTAL'),
  severity: z.enum(['high', 'medium', 'info']).default('info'),
});

const mockNotifications = [
  {
    id: 'NOTIF-001',
    recipient_id: 'USR-04',
    pupil_id: 'PUP-2026-002',
    type: 'consecutive_absences',
    title: '⚠️ 3+ Consecutive Absences Alert',
    message: 'Sophia Reyes has been marked absent for 3 consecutive days. Please contact Teacher Teresa at 0917-000-1122.',
    channel: 'SMS & Email Dispatched',
    severity: 'high',
    read: false,
    timestamp: '2026-08-09 09:30 AM',
  },
  {
    id: 'NOTIF-002',
    recipient_id: 'USR-04',
    pupil_id: 'PUP-2026-001',
    type: 'announcement',
    title: '📢 Feeding Program Announcement',
    message: 'Nutrition Month Feeding Program scheduled for Friday, Aug 15. Prepare food containers for pupils.',
    channel: 'PORTAL',
    severity: 'medium',
    read: false,
    timestamp: '2026-08-08 02:15 PM',
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipientId = searchParams.get('recipient_id');

  if (recipientId) {
    const filtered = mockNotifications.filter(n => n.recipient_id === recipientId || n.recipient_id === 'all');
    return NextResponse.json({ notifications: filtered });
  }

  return NextResponse.json({ notifications: mockNotifications });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = NotificationSchema.parse(body);

    const newNotification = {
      id: `NOTIF-${Date.now().toString().slice(-4)}`,
      recipient_id: parsed.recipient_id,
      pupil_id: parsed.pupil_id || '',
      type: parsed.type,
      title: parsed.title,
      message: parsed.message,
      channel: `${parsed.channel} Dispatched`,
      severity: parsed.severity,
      read: false,
      timestamp: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    };

    mockNotifications.unshift(newNotification);

    return NextResponse.json({ success: true, notification: newNotification });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

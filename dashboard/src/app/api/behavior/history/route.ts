import { NextRequest, NextResponse } from 'next/server';

interface LoginEvent {
  id: number;
  login_time: string;
  device: string;
  location: string;
  network: string;
  vpn: boolean;
  score: number;
  reasons: string[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

const mockHistories: Record<string, LoginEvent[]> = {
  'lovind@netengineering-dummy.local': [
    {
      id: 101,
      login_time: '08:42:15',
      device: 'MacBook Pro (macOS)',
      location: 'Bandung, Indonesia',
      network: 'Corporate LAN',
      vpn: false,
      score: 0,
      reasons: [],
      risk: 'LOW'
    },
    {
      id: 102,
      login_time: '13:10:45',
      device: 'MacBook Pro (macOS)',
      location: 'Bandung, Indonesia',
      network: 'Home WiFi',
      vpn: true,
      score: 10,
      reasons: ['No Corporate Network (VPN Active)'],
      risk: 'LOW'
    },
    {
      id: 103,
      login_time: '09:15:30',
      device: 'MacBook Pro (macOS)',
      location: 'Jakarta, Indonesia',
      network: 'Public WiFi (Hotel)',
      vpn: true,
      score: 10,
      reasons: ['No Corporate Network (VPN Active)'],
      risk: 'LOW'
    }
  ],
  'dewi.lestari@netops-dummy.local': [
    {
      id: 201,
      login_time: '02:30:11',
      device: 'iPhone 15 (iOS) - Unknown Device',
      location: 'Singapore, SG',
      network: 'Public WiFi',
      vpn: false,
      score: 80,
      reasons: ['02:30 Night Login (+25)', 'Unknown Device (+30)', 'Unknown Location (+25)'],
      risk: 'HIGH'
    },
    {
      id: 202,
      login_time: '09:12:44',
      device: 'Windows PC (Workstation)',
      location: 'Bandung, Indonesia',
      network: 'Corporate LAN',
      vpn: false,
      score: 0,
      reasons: [],
      risk: 'LOW'
    },
    {
      id: 203,
      login_time: '23:45:02',
      device: 'Linux Server (Ubuntu) - Unknown Device',
      location: 'Moscow, RU',
      network: 'Unknown Network',
      vpn: false,
      score: 85,
      reasons: ['Unknown Location (+25)', 'Unknown Device (+30)', 'Outside Corporate Network (+20)', 'No VPN (+10)'],
      risk: 'HIGH'
    }
  ],
  'budi.santoso@netops-dummy.local': [
    {
      id: 301,
      login_time: '05:15:10',
      device: 'Windows PC (Workstation)',
      location: 'Bandung, Indonesia',
      network: 'Home WiFi',
      vpn: false,
      score: 55,
      reasons: ['05:15 Login (+25)', 'Outside Corporate Network (+20)', 'No VPN (+10)'],
      risk: 'MEDIUM'
    },
    {
      id: 302,
      login_time: '11:20:30',
      device: 'Windows PC (Workstation)',
      location: 'Bandung, Indonesia',
      network: 'Corporate LAN',
      vpn: false,
      score: 0,
      reasons: [],
      risk: 'LOW'
    }
  ]
};

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
  }

  // Find mock history, fallback to a standard normal login list for generic users
  const history = mockHistories[email] || [
    {
      id: 999,
      login_time: '09:00:00',
      device: 'Windows PC (Workstation)',
      location: 'Bandung, Indonesia',
      network: 'Corporate LAN',
      vpn: false,
      score: 0,
      reasons: [],
      risk: 'LOW'
    }
  ];

  return NextResponse.json({ success: true, history });
}

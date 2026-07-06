import { NextRequest, NextResponse } from 'next/server';

export interface AdminLoginEvent {
  id: number;
  email: string;
  division: string;
  login_time: string;
  device: string;
  location: string;
  network: string;
  vpn: boolean;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export async function GET(request: NextRequest) {
  const history: AdminLoginEvent[] = [
    {
      id: 1,
      email: 'rina.kusuma@netengineering-dummy.local',
      division: 'Network Engineering',
      login_time: '2026-07-06 09:00:00',
      device: 'Windows PC',
      location: 'Bandung, Indonesia',
      network: 'Corporate',
      vpn: false,
      risk: 'LOW',
      reason: 'Akses dari jaringan internal kantor',
    },
    {
      id: 2,
      email: 'rina.kusuma@netengineering-dummy.local',
      division: 'Network Engineering',
      login_time: '2026-07-05 23:45:12',
      device: 'Linux PC',
      location: 'Moscow, Russia',
      network: 'Public WiFi',
      vpn: false,
      risk: 'HIGH',
      reason: 'Akses dari negara berisiko tinggi tanpa terowongan VPN korporasi',
    },
    {
      id: 3,
      email: 'dewi.lestari@netops-dummy.local',
      division: 'Network Operations',
      login_time: '2026-07-06 08:30:00',
      device: 'Android Phone',
      location: 'Jakarta, Indonesia',
      network: 'Telkomsel Mobile',
      vpn: false,
      risk: 'LOW',
      reason: 'Lokasi dan perangkat normal',
    },
    {
      id: 4,
      email: 'dewi.lestari@netops-dummy.local',
      division: 'Network Operations',
      login_time: '2026-07-05 02:15:00',
      device: 'MacBook Pro',
      location: 'Singapore',
      network: 'NordVPN Public Server',
      vpn: true,
      risk: 'MEDIUM',
      reason: 'Penggunaan VPN publik pihak ketiga terdeteksi pada jam non-kerja',
    },
    {
      id: 5,
      email: 'lovind@netengineering-dummy.local',
      division: 'IT',
      login_time: '2026-07-06 07:55:00',
      device: 'Windows PC',
      location: 'Bandung, Indonesia',
      network: 'Corporate',
      vpn: false,
      risk: 'LOW',
      reason: 'Akses dari jaringan internal kantor',
    },
    {
      id: 6,
      email: 'budi.santoso@netops-dummy.local',
      division: 'Network Operations',
      login_time: '2026-07-06 08:12:00',
      device: 'Windows PC',
      location: 'Jakarta, Indonesia',
      network: 'Corporate',
      vpn: false,
      risk: 'LOW',
      reason: 'Akses dari jaringan internal kantor',
    },
    {
      id: 7,
      email: 'budi.santoso@netops-dummy.local',
      division: 'Network Operations',
      login_time: '2026-07-05 01:40:22',
      device: 'Windows PC',
      location: 'Jakarta, Indonesia',
      network: 'Indihome Home Net',
      vpn: true,
      risk: 'MEDIUM',
      reason: 'Akses resource kritis (Infrastruktur Core) di luar jam kerja (01:40)',
    }
  ];

  return NextResponse.json({ history });
}

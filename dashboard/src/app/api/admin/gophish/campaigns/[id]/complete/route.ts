import { NextRequest, NextResponse } from 'next/server';
import { fetchFlaskBackend } from '@/lib/backendClient';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetchFlaskBackend(`/api/admin/gophish/campaigns/${id}/complete`, {
      method: 'POST',
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to complete campaign', detail: data.detail },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to connect to backend server', detail: error.message },
      { status: 500 }
    );
  }
}

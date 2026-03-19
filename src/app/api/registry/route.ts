import { NextRequest, NextResponse } from 'next/server';

interface WalletEntry {
  discordId: string;
  wallet: string;
  lastVerified: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SNAPSHOT_SECRET = process.env.SNAPSHOT_SECRET;

async function supabaseRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  });
}

// GET protegido — solo accesible con header Authorization: Bearer <SNAPSHOT_SECRET>
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!SNAPSHOT_SECRET || token !== SNAPSHOT_SECRET) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Read from Supabase
    const res = await supabaseRequest('holder_wallets?select=discord_id,wallet,last_verified');
    if (res.ok) {
      const data: any[] = await res.json();
      const wallets: WalletEntry[] = data.map(row => ({
        discordId: row.discord_id,
        wallet: row.wallet,
        lastVerified: row.last_verified,
      }));
      return NextResponse.json({ success: true, wallets });
    }

    return NextResponse.json({ success: false, error: 'Supabase error' }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — registra wallet en Supabase
export async function POST(request: NextRequest) {
  try {
    const internalSecret = request.headers.get('x-internal-secret');
    if (!process.env.INTERNAL_SECRET || internalSecret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { discordId, wallet } = await request.json();

    if (!discordId || !wallet) {
      return NextResponse.json({ success: false, error: 'Missing discordId or wallet' }, { status: 400 });
    }

    if (!/^\d{17,20}$/.test(discordId)) {
      return NextResponse.json({ success: false, error: 'Discord ID inválido' }, { status: 400 });
    }

    // Save to Supabase (upsert)
    const res = await supabaseRequest('holder_wallets', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        wallet: wallet,
        last_verified: new Date().toISOString(),
      }),
      headers: { 'Prefer': 'resolution=merge-duplicates' },
    });

    if (res.ok) {
      console.log(`✅ Wallet registered in Supabase: ${discordId} -> ${wallet}`);
      return NextResponse.json({ success: true, message: 'Wallet registered' });
    }

    console.error('Supabase error:', await res.text());
    return NextResponse.json({ success: false, error: 'Supabase error' }, { status: 500 });
  } catch (error: any) {
    console.error('Error registering wallet:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

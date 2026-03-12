import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface WalletEntry {
  discordId: string;
  wallet: string;
  lastVerified: string;
}

const REGISTRY_FILE = path.join('/tmp', 'wallet-registry.json');

// Token secreto para proteger el GET de snapshot — debe estar en .env
const SNAPSHOT_SECRET = process.env.SNAPSHOT_SECRET;

function loadRegistry(): WalletEntry[] {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return [];
    const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading wallet registry:', error);
    return [];
  }
}

function saveRegistry(registry: WalletEntry[]): void {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  } catch (error) {
    console.error('Error saving wallet registry:', error);
  }
}

// GET protegido — solo accesible con header Authorization: Bearer <SNAPSHOT_SECRET>
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!SNAPSHOT_SECRET || token !== SNAPSHOT_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    const registry = loadRegistry();
    return NextResponse.json({ success: true, wallets: registry });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — solo se puede llamar desde el propio servidor (verify ya valida la firma)
// Se protege verificando que venga del mismo origen
export async function POST(request: NextRequest) {
  try {
    // Solo permitir llamadas internas (desde /api/verify)
    const internalSecret = request.headers.get('x-internal-secret');
    if (!process.env.INTERNAL_SECRET || internalSecret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    const { discordId, wallet } = await request.json();

    if (!discordId || !wallet) {
      return NextResponse.json({
        success: false,
        error: 'Missing discordId or wallet'
      }, { status: 400 });
    }

    if (!/^\d{17,20}$/.test(discordId)) {
      return NextResponse.json({
        success: false,
        error: 'Discord ID inválido'
      }, { status: 400 });
    }

    const registry = loadRegistry();
    const filtered = registry.filter(entry => entry.discordId !== discordId);
    filtered.push({
      discordId,
      wallet,
      lastVerified: new Date().toISOString(),
    });
    saveRegistry(filtered);

    console.log(`✅ Wallet registered: ${discordId} -> ${wallet}`);
    return NextResponse.json({ success: true, message: 'Wallet registered' });

  } catch (error: any) {
    console.error('Error registering wallet:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

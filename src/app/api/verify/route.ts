import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

// Use Helius RPC from environment variable
const RPC_URL = process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

if (!process.env.SOLANA_RPC_URL && !process.env.HELIUS_RPC_URL) {
  console.warn('⚠️ SOLANA_RPC_URL not configured, using public RPC (rate limited)');
}

// Roles de Holder con IDs directos
const HOLDER_ROLES = [
  { name: 'Camaroncin', id: '1481187002991906947', min: 1_000, max: 900_000 },
  { name: 'Believer', id: '1481092832088424621', min: 1_000_000, max: 3_000_000 },
  { name: 'Ballenita', id: '1481092950191767733', min: 3_000_000, max: 6_000_000 },
  { name: 'Doggyllonario', id: '1481093065396453396', min: 6_000_000, max: 100_000_000 },
];

// Roles de Burn con IDs directos
const BURN_ROLES = [
  { name: 'Bronce', id: '1481095287584985270', min: 10_000, max: 100_000, emoji: '🥉' },
  { name: 'Plata', id: '1481095408389328957', min: 100_000, max: 1_000_000, emoji: '🥈' },
  { name: 'Oro', id: '1481095552224723066', min: 1_000_000, max: Infinity, emoji: '🥇' },
];

// Burn address
const BURN_ADDRESS = 'Burn111111111111111111111111111111111111111';

// Discord API helper
async function discordAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `https://discord.com/api/v10${endpoint}`;
  
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Discord ${res.status}: ${errorText}`);
  }
  
  // Return empty for 204 No Content
  if (res.status === 204) return {};
  
  return res.json();
}

// Get token balance from Solana (EXISTING - DON'T MODIFY)
async function getTokenBalance(wallet: string, mint: string): Promise<number> {
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'doggy-verify',
        method: 'getTokenAccountsByOwner',
        params: [
          wallet,
          { mint: mint },
          { encoding: 'jsonParsed' }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status}`);
    }

    const text = await response.text();
    
    if (!text || text.trim() === '') {
      throw new Error('Empty RPC response');
    }

    const data = JSON.parse(text);
    
    if (data.error) {
      throw new Error(data.error.message || 'RPC error');
    }
    
    if (data.result && data.result.value && data.result.value.length > 0) {
      const accountData = data.result.value[0].account.data;
      if (accountData && accountData.parsed && accountData.parsed.info) {
        const balance = accountData.parsed.info.tokenAmount.uiAmount;
        return balance || 0;
      }
    }
    
    return 0;
  } catch (error: any) {
    console.error('Error getting balance:', error);
    throw new Error('Error al verificar balance');
  }
}

// Get burned tokens using Helius Enhanced API
async function getBurnedAmount(wallet: string): Promise<number> {
  // Extract Helius API key from NEXT_PUBLIC_RPC_URL
  // Format: https://mainnet.helius-rpc.com/?api-key=XXXXX
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL;
  const HELIUS_API_KEY = process.env.HELIUS_API_KEY || rpcUrl?.split('api-key=')[1]?.split('&')[0];
  
  if (!HELIUS_API_KEY) {
    console.error('❌ No Helius API key found in HELIUS_API_KEY or RPC URL');
    return 0;
  }

  const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';

  try {
    // Use Helius Enhanced Transactions API
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}`;
    
    console.log(`🔥 Fetching burns via Helius for ${wallet}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Helius API error: ${response.status}`);
      return 0;
    }
    
    const transactions = await response.json();
    
    if (!Array.isArray(transactions)) {
      console.error('Helius: Invalid response format');
      return 0;
    }

    let totalBurned = 0;

    // Look for transfers to burn address in ALL transactions
    for (const tx of transactions) {
      // Check token transfers
      if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
        for (const transfer of tx.tokenTransfers) {
          // Check if this is DOGGY sent to burn address
          if (
            transfer.mint === DOGGY_MINT &&
            transfer.toUserAccount === BURN_ADDRESS
          ) {
            const amount = transfer.tokenAmount || 0;
            if (amount > 0) {
              totalBurned += amount;
              console.log(`🔥 Found burn: ${amount} DOGGY in tx ${tx.signature}`);
            }
          }
        }
      }
    }

    console.log(`🔥 Total burned: ${totalBurned.toLocaleString()} DOGGY`);
    return totalBurned;

  } catch (error: any) {
    console.error('Error fetching burns from Helius:', error);
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Verify endpoint called');
    
    // Check environment
    if (!DISCORD_TOKEN || !GUILD_ID) {
      console.error('❌ Missing env vars');
      return NextResponse.json({ 
        success: false,
        error: 'Server misconfigured' 
      }, { status: 500 });
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid request body' 
      }, { status: 400 });
    }
    
    const { wallet, discordId, channelId, signature, timestamp } = body;

    // 1. Campos requeridos
    if (!wallet || !discordId || !signature || !timestamp) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (wallet, discordId, signature, timestamp)'
      }, { status: 400 });
    }

    // 2. Formato válido de Discord ID
    if (!/^\d{17,20}$/.test(discordId)) {
      return NextResponse.json({
        success: false,
        error: 'Discord ID inválido'
      }, { status: 400 });
    }

    // 3. Firma no puede tener más de 2 minutos
    if (Date.now() - timestamp > 120_000) {
      return NextResponse.json({
        success: false,
        error: 'Firma expirada, intenta de nuevo desde Discord'
      }, { status: 401 });
    }

    // 4. Verificar firma criptográfica
    try {
      const message = new TextEncoder().encode(
        `Verificar holdings de DOGGY para rol en Discord\n` +
        `Discord ID: ${discordId}\n` +
        `Timestamp: ${timestamp}\n` +
        `Esta firma solo prueba propiedad de la wallet. No se realizarán transacciones.`
      );
      const pubkeyBytes = new PublicKey(wallet).toBytes();
      const sigBytes = new Uint8Array(signature);
      const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);

      if (!valid) {
        console.warn(`🚨 Firma inválida para wallet ${wallet} / discord ${discordId}`);
        return NextResponse.json({
          success: false,
          error: 'Firma inválida. Debes conectar y firmar con tu propia wallet.'
        }, { status: 401 });
      }
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Error verificando firma. Wallet address inválida.'
      }, { status: 400 });
    }

    console.log(`🔍 Verifying: ${discordId} - ${wallet}`);

    // Get holder balance (EXISTING LOGIC - DON'T MODIFY)
    const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';
    const holderBalance = await getTokenBalance(wallet, DOGGY_MINT);
    console.log(`💎 Holder Balance: ${holderBalance.toLocaleString()} DOGGY`);

    // NEW: Get burned amount
    const burnedBalance = await getBurnedAmount(wallet);
    console.log(`🔥 Burned Balance: ${burnedBalance.toLocaleString()} DOGGY`);

    // Find matching holder role (EXISTING LOGIC)
    let holderRole = null;
    for (const r of HOLDER_ROLES) {
      if (holderBalance >= r.min && holderBalance < r.max) {
        holderRole = r;
        break;
      }
    }

    // Find matching burn role (NEW)
    let burnRole = null;
    if (burnedBalance > 0) {
      for (const r of BURN_ROLES) {
        if (burnedBalance >= r.min && burnedBalance < r.max) {
          burnRole = r;
          break;
        }
      }
    }

    // Check if user qualifies for ANY role
    if (!holderRole && !burnRole) {
      return NextResponse.json({ 
        success: false,
        error: `Necesitas mínimo 1,000 DOGGY en holdings o haber quemado 10,000 DOGGY. Tienes: ${holderBalance.toLocaleString()} en holdings y ${burnedBalance.toLocaleString()} quemados.`,
        holderBalance,
        burnedBalance
      }, { status: 400 });
    }

    // Remove old holder roles (EXISTING LOGIC)
    for (const r of HOLDER_ROLES) {
      try {
        await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${r.id}`, 'DELETE');
        console.log(`❌ Removed holder role ${r.name}`);
      } catch (e) {
        // Ignore
      }
    }

    // Remove old burn roles (NEW)
    for (const r of BURN_ROLES) {
      try {
        await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${r.id}`, 'DELETE');
        console.log(`❌ Removed burn role ${r.name}`);
      } catch (e) {
        // Ignore
      }
    }

    // Assign holder role if applicable (EXISTING LOGIC)
    if (holderRole) {
      await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${holderRole.id}`, 'PUT');
      console.log(`✅ Assigned holder role ${holderRole.name} to ${discordId}`);
    }

    // Assign burn role if applicable (NEW)
    if (burnRole) {
      await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${burnRole.id}`, 'PUT');
      console.log(`✅ Assigned burn role ${burnRole.name} to ${discordId}`);
    }

    // Registrar wallet verificada internamente
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/registry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_SECRET || '',
        },
        body: JSON.stringify({ discordId, wallet }),
      });
    } catch (e) {
      console.error('Error registering wallet:', e);
      // No romper el flujo si falla el registro
    }

    // Return success response
    return NextResponse.json({ 
      success: true,
      holderRole: holderRole?.name || null,
      burnRole: burnRole?.name || null,
      holderBalance: holderBalance,
      burnedBalance: burnedBalance,
      message: `¡Roles asignados!`
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Verify error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Internal error' 
    }, { status: 500 });
  }
}

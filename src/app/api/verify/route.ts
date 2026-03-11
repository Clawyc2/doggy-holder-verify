import { NextRequest, NextResponse } from 'next/server';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Roles de Holder con IDs directos
const HOLDER_ROLES = [
  { name: 'Believer', id: '1481092832088424621', min: 1_000_000, max: 3_000_000 },
  { name: 'Ballenita', id: '1481092950191767733', min: 3_000_000, max: 6_000_000 },
  { name: 'Doggyllonario', id: '1481093065396453396', min: 6_000_000, max: 10_000_000 },
];

// Discord API helper
async function discordAPI(endpoint: string, method: string = 'GET', body?: any) {
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
    const error = await res.text();
    throw new Error(`Discord API error: ${res.status} - ${error}`);
  }
  
  return res.json();
}

// Get token balance from Solana
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

    const data = await response.json();
    
    if (data.result && data.result.value && data.result.value.length > 0) {
      const balance = data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw new Error('Error al verificar balance. Intenta de nuevo en unos momentos.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, discordId, signature } = await request.json();

    if (!wallet || !discordId) {
      return NextResponse.json({ 
        error: 'Falta wallet o discordId' 
      }, { status: 400 });
    }

    console.log(`🔍 Verificando: ${discordId} - ${wallet}`);

    // Verify holdings on-chain
    const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';
    const balance = await getTokenBalance(wallet, DOGGY_MINT);

    console.log(`💎 Balance: ${balance.toLocaleString()} DOGGY`);

    // Determine role based on holdings
    let role = null;
    for (const r of HOLDER_ROLES) {
      if (balance >= r.min && balance < r.max) {
        role = r;
        break;
      }
    }

    if (!role) {
      return NextResponse.json({ 
        error: `Necesitas mínimo 1M DOGGY para obtener un rol. Tienes: ${balance.toLocaleString()} DOGGY`,
        balance 
      }, { status: 400 });
    }

    // Remove old holder roles
    for (const r of HOLDER_ROLES) {
      try {
        await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${r.id}`, 'DELETE');
        console.log(`❌ Removido rol ${r.name}`);
      } catch (e) {
        // Ignore if user doesn't have the role
      }
    }

    // Add new role
    await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${role.id}`, 'PUT');
    console.log(`✅ Rol ${role.name} asignado a ${discordId}`);

    return NextResponse.json({ 
      success: true,
      role: role.name,
      balance: balance,
      message: `¡Rol ${role.name} asignado!`
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const ROLES = [
  { name: 'DoggyHolder', min: 1_000, max: 100_000 },
  { name: 'DoggyOG', min: 100_000, max: 500_000 },
  { name: 'DoggyMaxi', min: 500_000, max: Infinity },
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
    throw new Error('Failed to verify balance. Please try again in a moment.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, discordId, signature } = await request.json();

    if (!wallet || !discordId) {
      return NextResponse.json({ 
        error: 'Missing wallet or discordId' 
      }, { status: 400 });
    }

    console.log(`🔍 Verificando: ${discordId} - ${wallet}`);

    // Verify holdings on-chain
    const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';
    const balance = await getTokenBalance(wallet, DOGGY_MINT);

    console.log(`💎 Balance: ${balance} DOGGY`);

    // Determine role
    let role = null;
    for (const r of ROLES) {
      if (balance >= r.min && balance < r.max) {
        role = r.name;
        break;
      }
    }

    if (!role) {
      return NextResponse.json({ 
        error: 'No tienes suficientes DOGGY (mínimo 1,000)',
        balance 
      }, { status: 400 });
    }

    // Get all roles from Discord
    const roles = await discordAPI(`/guilds/${GUILD_ID}/roles`);
    const targetRole = roles.find((r: any) => r.name === role);

    if (!targetRole) {
      return NextResponse.json({ 
        error: `Rol "${role}" no encontrado en Discord` 
      }, { status: 404 });
    }

    // Remove old holder roles
    for (const r of ROLES) {
      const oldRole = roles.find((ro: any) => ro.name === r.name);
      if (oldRole) {
        try {
          await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${oldRole.id}`, 'DELETE');
          console.log(`❌ Removido rol ${r.name}`);
        } catch (e) {
          // Ignore if user doesn't have the role
        }
      }
    }

    // Add new role
    await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${targetRole.id}`, 'PUT');
    console.log(`✅ Rol ${role} asignado a ${discordId}`);

    return NextResponse.json({ 
      success: true,
      role: role,
      balance: balance,
      message: `¡Rol ${role} asignado!`
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno' 
    }, { status: 500 });
  }
}

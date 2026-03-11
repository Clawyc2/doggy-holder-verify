import { NextRequest, NextResponse } from 'next/server';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Roles de Holder con IDs directos
const HOLDER_ROLES = [
  { name: 'Camaroncin', id: '1481187002991906947', min: 1_000, max: 900_000 },
  { name: 'Believer', id: '1481092832088424621', min: 1_000_000, max: 3_000_000 },
  { name: 'Ballenita', id: '1481092950191767733', min: 3_000_000, max: 6_000_000 },
  { name: 'Doggyllonario', id: '1481093065396453396', min: 6_000_000, max: 100_000_000 },
];

// Discord API helper
async function discordAPI(endpoint: string, method: string = 'GET'): Promise<any> {
  const url = `https://discord.com/api/v10${endpoint}`;
  
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Discord API error ${res.status}:`, errorText);
    throw new Error(`Discord API error: ${res.status}`);
  }
  
  return res.json();
}

// Get token balance from Solana RPC
async function getTokenBalance(wallet: string, mint: string): Promise<number> {
  try {
    console.log(`📡 Querying RPC: ${RPC_URL}`);
    
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
    console.log('📦 RPC response length:', text.length);
    
    if (!text || text.trim() === '') {
      throw new Error('RPC response is empty');
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ JSON parse error. Response preview:', text.substring(0, 200));
      throw new Error('Invalid JSON from RPC');
    }
    
    if (data.error) {
      console.error('❌ RPC error:', data.error);
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
    console.error('❌ Error getting balance:', error);
    throw new Error('Error al verificar balance. Intenta de nuevo.');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Log environment check
    console.log('🔧 Environment check:', {
      DISCORD_TOKEN: DISCORD_TOKEN ? `✅ ${DISCORD_TOKEN.substring(0, 10)}...` : '❌ Missing',
      GUILD_ID: GUILD_ID || '❌ Missing',
      RPC_URL: RPC_URL,
    });
    
    // Check environment variables
    if (!DISCORD_TOKEN || !GUILD_ID) {
      return NextResponse.json({ 
        error: 'Server configuration error. Contact admin.',
        details: 'Missing Discord credentials'
      }, { status: 500 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ 
        error: 'Invalid request body' 
      }, { status: 400 });
    }
    
    const { wallet, discordId, signature } = body;

    if (!wallet || !discordId) {
      return NextResponse.json({ 
        error: 'Missing wallet or discordId' 
      }, { status: 400 });
    }

    console.log(`🔍 Verifying: ${discordId} - ${wallet}`);

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
        error: `Necesitas mínimo 1,000 DOGGY. Tienes: ${balance.toLocaleString()} DOGGY`,
        balance 
      }, { status: 400 });
    }

    // Remove old holder roles
    for (const r of HOLDER_ROLES) {
      try {
        await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${r.id}`, 'DELETE');
        console.log(`❌ Removed role ${r.name}`);
      } catch (e) {
        // Ignore if user doesn't have the role
      }
    }

    // Add new role
    await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${role.id}`, 'PUT');
    console.log(`✅ Role ${role.name} assigned to ${discordId}`);

    return NextResponse.json({ 
      success: true,
      role: role.name,
      balance: balance,
      message: `¡Rol ${role.name} asignado!`
    });

  } catch (error: any) {
    console.error('❌ Error in verify:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

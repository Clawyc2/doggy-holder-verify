import { NextRequest, NextResponse } from 'next/server';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

// Use Helius RPC for better reliability
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=b534340e-8d88-4146-9bef-bb2140de44d7';

// Roles de Holder con IDs directos
const HOLDER_ROLES = [
  { name: 'Camaroncin', id: '1481187002991906947', min: 1_000, max: 900_000 },
  { name: 'Believer', id: '1481092832088424621', min: 1_000_000, max: 3_000_000 },
  { name: 'Ballenita', id: '1481092950191767733', min: 3_000_000, max: 6_000_000 },
  { name: 'Doggyllonario', id: '1481093065396453396', min: 6_000_000, max: 100_000_000 },
];

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

// Send message to Discord channel
async function sendDiscordMessage(channelId: string, content: any): Promise<void> {
  try {
    await discordAPI(`/channels/${channelId}/messages`, 'POST', content);
  } catch (error) {
    console.error('Error sending Discord message:', error);
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
    
    const { wallet, discordId, channelId } = body;

    if (!wallet || !discordId) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing wallet or discordId' 
      }, { status: 400 });
    }

    console.log(`🔍 Verifying: ${discordId} - ${wallet}`);

    // Get balance
    const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';
    const balance = await getTokenBalance(wallet, DOGGY_MINT);

    console.log(`💎 Balance: ${balance.toLocaleString()} DOGGY`);

    // Find matching role
    let role = null;
    for (const r of HOLDER_ROLES) {
      if (balance >= r.min && balance < r.max) {
        role = r;
        break;
      }
    }

    if (!role) {
      return NextResponse.json({ 
        success: false,
        error: `Necesitas mínimo 1,000 DOGGY. Tienes: ${balance.toLocaleString()} DOGGY`,
        balance 
      }, { status: 400 });
    }

    // Remove old roles
    for (const r of HOLDER_ROLES) {
      try {
        await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${r.id}`, 'DELETE');
        console.log(`❌ Removed ${r.name}`);
      } catch (e) {
        // Ignore
      }
    }

    // Add new role
    await discordAPI(`/guilds/${GUILD_ID}/members/${discordId}/roles/${role.id}`, 'PUT');
    console.log(`✅ Assigned ${role.name} to ${discordId}`);

    // Send confirmation message to channel if channelId provided
    if (channelId) {
      const roleEmojis: Record<string, string> = {
        'Camaroncin': '🦐',
        'Believer': '💎',
        'Ballenita': '🐋',
        'Doggyllonario': '🚀',
      };
      
      await sendDiscordMessage(channelId, {
        embeds: [{
          title: '✅ Rol Asignado',
          description: `¡<@${discordId}> ha verificado sus holdings!`,
          color: 0x00AE86,
          fields: [
            {
              name: '💎 Balance',
              value: `${balance.toLocaleString()} DOGGY`,
              inline: true
            },
            {
              name: '🏆 Rol',
              value: `${roleEmojis[role.name] || '⭐'} **${role.name}**`,
              inline: true
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Doggy BOT • Verificación automática'
          }
        }]
      });
    }

    // Return success response
    return NextResponse.json({ 
      success: true,
      role: role.name,
      balance: balance,
      message: `¡Rol ${role.name} asignado!`
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Verify error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Internal error' 
    }, { status: 500 });
  }
}

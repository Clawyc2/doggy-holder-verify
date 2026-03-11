import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    DISCORD_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✅ presente' : '❌ faltante',
    GUILD_ID: process.env.DISCORD_GUILD_ID || '❌ faltante',
    DOGGY_TOKEN: process.env.DOGGY_TOKEN_MINT ? '✅ presente' : '❌ faltante',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'no configurado',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ presente' : '❌ faltante',
  });
}

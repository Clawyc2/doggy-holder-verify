"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';

const ROLES = [
  { name: 'Camaroncin', id: '1481187002991906947', min: 1_000, max: 900_000, emoji: '🦐' },
  { name: 'Believer', id: '1481092832088424621', min: 1_000_000, max: 3_000_000, emoji: '💎' },
  { name: 'Ballenita', id: '1481092950191767733', min: 3_000_000, max: 6_000_000, emoji: '🐋' },
  { name: 'Doggyllonario', id: '1481093065396453396', min: 6_000_000, max: 100_000_000, emoji: '🚀' },
];

export default function Home() {
  const { publicKey, connected, signMessage } = useWallet();
  const { connection } = useConnection();
  const [discordId, setDiscordId] = useState<string>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [assignedRole, setAssignedRole] = useState('');

  // Get Discord ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordParam = params.get('discord');
    if (discordParam) {
      setDiscordId(discordParam);
      setVerifying(true);
    }
  }, []);

  // Fetch DOGGY balance when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
    }
  }, [connected, publicKey]);

  const fetchBalance = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching DOGGY balance for:', publicKey.toBase58());
      
      // Get all token accounts for this wallet
      const tokenAccounts = await connection.getParsedProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        {
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 32, bytes: publicKey.toBase58() } },
          ],
        }
      );

      console.log('📦 Found token accounts:', tokenAccounts.length);

      // Find DOGGY token account
      let doggyBalance = 0;
      for (const account of tokenAccounts) {
        const accountInfo: any = account.account;
        const mintAddress = accountInfo.data.parsed.info.mint;
        
        if (mintAddress === DOGGY_MINT) {
          doggyBalance = accountInfo.data.parsed.info.tokenAmount.uiAmount || 0;
          console.log(`✅ Found DOGGY: ${doggyBalance}`);
          break;
        }
      }

      setBalance(doggyBalance);
      
      if (doggyBalance === 0) {
        setError('No tienes DOGGY en esta wallet');
      }
      
    } catch (err: any) {
      console.error('❌ Error fetching balance:', err);
      setError('Error al consultar balance. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getRole = () => {
    if (balance === null) return null;
    for (const r of ROLES) {
      if (balance >= r.min && balance < r.max) {
        return r;
      }
    }
    return null;
  };

  const handleAssignRole = async () => {
    if (!publicKey || !discordId || !signMessage) {
      setError('Falta información para asignar rol');
      return;
    }

    setAssigningRole(true);
    setError(null);

    try {
      // Sign message to prove wallet ownership
      const message = new TextEncoder().encode(
        `Verificar DOGGY holdings\n` +
        `Discord ID: ${discordId}\n` +
        `Wallet: ${publicKey.toBase58()}\n` +
        `Balance: ${balance}\n` +
        `Timestamp: ${Date.now()}`
      );

      let signature;
      try {
        signature = await signMessage(message);
      } catch (signError: any) {
        setError('Firma rechazada. Necesitas firmar para continuar.');
        setAssigningRole(false);
        return;
      }

      console.log('📤 Sending role assignment request...');

      // Call API to assign role
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          discordId: discordId,
          signature: Array.from(signature),
        }),
      });

      const text = await response.text();
      console.log('📥 Response:', text);

      if (!text) {
        setError('El servidor no respondió');
        setAssigningRole(false);
        return;
      }

      const result = JSON.parse(text);

      if (response.ok && result.success) {
        setSuccess(true);
        setAssignedRole(result.role);
      } else {
        setError(result.error || 'Error al asignar rol');
      }
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err?.message || 'Error al asignar rol');
    } finally {
      setAssigningRole(false);
    }
  };

  const role = getRole();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🐕 DOGGY Holder Verification
          </h1>
          <p className="text-gray-400 text-lg">
            Verifica tus holdings y obtén tu rol en Discord
          </p>
        </div>

        {/* No Discord ID */}
        {!verifying && (
          <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-8 border border-red-700 text-center">
            <p className="text-red-400">
              ⚠️ Usa el botón "Verificar" desde Discord
            </p>
          </div>
        )}

        {/* Step 1: Connect Wallet */}
        {verifying && !connected && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Paso 1: Conecta tu Wallet</h3>
            <p className="text-gray-400 mb-6">Conecta la wallet que tiene tus DOGGY</p>
            <div className="flex justify-center mb-6 relative z-50">
              <WalletMultiButton />
            </div>
          </div>
        )}

        {/* Step 2: Show Balance */}
        {verifying && connected && (
          <div className="space-y-6">
            {/* Loading */}
            {loading && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-white">Consultando tus DOGGY...</p>
              </div>
            )}

            {/* Balance Display */}
            {!loading && balance !== null && (
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur-sm rounded-2xl p-8 border border-blue-700">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-2">Tu Balance de DOGGY:</p>
                  <p className="text-5xl font-bold text-white mb-4">
                    {balance.toLocaleString()} 🐕
                  </p>
                  
                  {role ? (
                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mt-4">
                      <p className="text-green-400 text-sm">Rol que obtendrás:</p>
                      <p className="text-3xl font-bold text-white">
                        {role.emoji} {role.name}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mt-4">
                      <p className="text-red-400">
                        ❌ No tienes suficientes DOGGY para un rol
                      </p>
                      <p className="text-red-300 text-sm mt-2">
                        Mínimo requerido: 1,000 DOGGY
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-6 border border-red-700 text-center">
                <p className="text-red-400">{error}</p>
                <button
                  onClick={fetchBalance}
                  className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Assign Role Button */}
            {!loading && !error && role && !success && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
                <h3 className="text-xl font-bold text-white mb-4">
                  Paso 2: Obtener Rol en Discord
                </h3>
                <p className="text-gray-400 mb-6">
                  Firma un mensaje para probar que eres dueño de esta wallet
                </p>
                <button
                  onClick={handleAssignRole}
                  disabled={assigningRole}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningRole ? 'Asignando Rol...' : `🎯 Asignar Rol ${role.emoji} ${role.name}`}
                </button>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="bg-green-900/20 backdrop-blur-sm rounded-2xl p-8 border border-green-700 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  ¡Rol Asignado!
                </h2>
                <p className="text-gray-300 mb-4">
                  Tu rol <span className="font-bold text-blue-400">@{assignedRole}</span> ha sido asignado en Discord
                </p>
                <p className="text-gray-400 text-sm">
                  ✅ Puedes cerrar esta página
                </p>
              </div>
            )}

            {/* Roles Info */}
            {!success && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">💎 Roles Disponibles</h3>
                <div className="space-y-2 text-sm">
                  {ROLES.map((r) => (
                    <div key={r.name} className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                      <span>{r.emoji} {r.name}</span>
                      <span className="text-blue-400">
                        {r.min >= 1000000 ? `${r.min/1000000}M` : `${r.min/1000}K`}
                        {r.max < 100000000 ? ` - ${r.max >= 1000000 ? `${r.max/1000000}M` : `${r.max/1000}K`}` : '+'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-gray-500 text-sm text-center">
        <p>Creado con ❤️ por Clawy</p>
        <a
          href="https://solscan.io/token/BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline mt-2 inline-block"
        >
          Ver DOGGY en Solscan
        </a>
      </div>
    </div>
  );
}

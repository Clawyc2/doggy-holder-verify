"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

const DOGGY_MINT = 'BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump';

const HOLDER_ROLES = [
  { name: 'Camaroncin', id: '1481187002991906947', min: 1_000, max: 900_000, emoji: '🦐' },
  { name: 'Believer', id: '1481092832088424621', min: 1_000_000, max: 3_000_000, emoji: '💎' },
  { name: 'Ballenita', id: '1481092950191767733', min: 3_000_000, max: 6_000_000, emoji: '🐋' },
  { name: 'Doggyllonario', id: '1481093065396453396', min: 6_000_000, max: 100_000_000, emoji: '🚀' },
];

const BURN_ROLES = [
  { name: 'Bronce', id: '1481095287584985270', min: 10_000, max: 100_000, emoji: '🥉' },
  { name: 'Plata', id: '1481095408389328957', min: 100_000, max: 1_000_000, emoji: '🥈' },
  { name: 'Oro', id: '1481095552224723066', min: 1_000_000, max: Infinity, emoji: '🥇' },
];

export default function Home() {
  const { publicKey, connected, signMessage, disconnect, connect } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [discordId, setDiscordId] = useState<string>('');
  const [channelId, setChannelId] = useState<string>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [burnedBalance, setBurnedBalance] = useState<number | null>(null);
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [assignedHolderRole, setAssignedHolderRole] = useState('');
  const [assignedBurnRole, setAssignedBurnRole] = useState('');
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  
  // Combined wallet address from adapter or local Phantom browser connection
  const activeWalletAddress = publicKey?.toBase58() || walletPublicKey;
  
  // Detect if mobile
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Detect if inside Phantom browser (not extension on desktop)
  // En desktop, window.solana.isPhantom es la extensión, no el browser
  const isPhantomBrowser = typeof window !== 'undefined' && 
    !!(window as any).solana?.isPhantom &&
    isMobile; // Solo es Phantom browser si es móvil
  
  // Custom connect handler for mobile
  const handleConnectWallet = async () => {
    try {
      if (isPhantomBrowser) {
        // Dentro del Phantom browser — conectar directo con window.solana
        // NO usar el adapter porque puede estar en estado inconsistente después de disconnect
        const provider = (window as any).solana;
        if (provider && provider.connect) {
          const resp = await provider.connect();
          console.log('✅ Connected via Phantom browser:', resp.publicKey.toString());
          // Guardar publicKey localmente
          setWalletPublicKey(resp.publicKey.toString());
          // Forzar actualización del estado
          setIsConnected(true);
        } else {
          console.error('❌ Phantom provider not available');
          setError('Phantom no está disponible. Intenta recargar la página.');
        }
      } else if (isMobile) {
        // Mobile normal — abrir en Phantom browser
        const currentUrl = encodeURIComponent(window.location.href);
        const refUrl = encodeURIComponent(window.location.origin);
        const phantomBrowserLink = `https://phantom.app/ul/browse/${currentUrl}?ref=${refUrl}`;
        window.location.href = phantomBrowserLink;
      } else {
        // On desktop: Open modal
        setVisible(true);
      }
    } catch (err) {
      console.error('Connect error:', err);
    }
  };

  // Close wallet menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get Discord ID and Channel ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordParam = params.get('discord');
    const channelParam = params.get('channel');
    if (discordParam) {
      setDiscordId(discordParam);
      setVerifying(true);
    }
    if (channelParam) {
      setChannelId(channelParam);
    }
  }, []);

  // Fetch DOGGY balance when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setIsConnected(true);
      fetchBalance();
    } else if (!connected) {
      setIsConnected(false);
    }
  }, [connected, publicKey]);
  
  // Also fetch when walletPublicKey changes (Phantom browser)
  useEffect(() => {
    if (walletPublicKey && isPhantomBrowser) {
      fetchBalance();
    }
  }, [walletPublicKey]);

  const fetchBalance = useCallback(async () => {
    // Usar activeWalletAddress que funciona tanto en adapter como Phantom browser
    if (!activeWalletAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching DOGGY balance for:', activeWalletAddress);
      
      // Get all token accounts for this wallet
      const tokenAccounts = await connection.getParsedProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        {
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 32, bytes: activeWalletAddress } },
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
        setError('Esta wallet no tiene DOGGY tokens. Conecta la wallet que tiene tus DOGGY.');
      }
      
    } catch (err: any) {
      console.error('❌ Error fetching balance:', err);
      setBalance(0);
      setError('No se pudo conectar a la red de Solana. Verifica tu conexión a internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [activeWalletAddress, connection]);

  const getHolderRole = () => {
    if (balance === null) return null;
    for (const r of HOLDER_ROLES) {
      if (balance >= r.min && balance < r.max) {
        return r;
      }
    }
    return null;
  };

  const handleAssignRole = async () => {
    if (!activeWalletAddress || !discordId) {
      setError('Falta información para asignar rol');
      return;
    }

    const holderRole = getHolderRole();

    setAssigningRole(true);
    setError(null);

    try {
      // Step 1: Sign message to prove wallet ownership
      const timestamp = Date.now();

      const message = new TextEncoder().encode(
        `Verificar holdings de DOGGY para rol en Discord\n` +
        `Discord ID: ${discordId}\n` +
        `Timestamp: ${timestamp}\n` +
        `Esta firma solo prueba propiedad de la wallet. No se realizarán transacciones.`
      );

      let signature: Uint8Array;
      
      // En Phantom browser, usar window.solana directamente
      if (isPhantomBrowser) {
        try {
          const provider = (window as any).solana;
          const signResult = await provider.signMessage(message);
          signature = signResult.signature;
        } catch (signError: any) {
          setError("Firma rechazada. Necesitas firmar el mensaje para continuar.");
          setAssigningRole(false);
          return;
        }
      } else {
        // En desktop, usar el adapter
        if (!signMessage) {
          setError('Falta información para asignar rol');
          setAssigningRole(false);
          return;
        }
        try {
          signature = await signMessage(message);
        } catch (signError: any) {
          setError("Firma rechazada. Necesitas firmar el mensaje para continuar.");
          setAssigningRole(false);
          return;
        }
      }

      console.log('📤 Enviando solicitud de asignación de rol...');
      
      // Step 2: Call API to verify and assign role
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: activeWalletAddress,
          discordId: discordId,
          channelId: channelId,
          signature: Array.from(signature),
          timestamp,
        }),
      });

      console.log('📥 Response status:', response.status);
      
      // Try to read response as text first
      let responseText = '';
      try {
        responseText = await response.text();
        console.log('📥 Response text:', responseText);
      } catch (readError) {
        console.error('❌ Error reading response:', readError);
        setError('Error al leer respuesta del servidor');
        setAssigningRole(false);
        return;
      }

      // Check if response is empty
      if (!responseText || responseText.trim() === '') {
        setError('El servidor no respondió. Intenta de nuevo.');
        setAssigningRole(false);
        return;
      }

      // Try to parse JSON
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('📥 Parsed result:', result);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        setError('Error al procesar respuesta del servidor');
        setAssigningRole(false);
        return;
      }

      // Check if successful
      if (response.ok && result.success) {
        setSuccess(true);
        setAssignedHolderRole(result.holderRole || '');
        setAssignedBurnRole(result.burnRole || '');
        setBurnedBalance(result.burnedBalance || 0);
      } else {
        setError(result.error || 'Error al asignar rol');
        setAssigningRole(false);
      }
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err?.message || 'Error al asignar rol');
      setAssigningRole(false);
    }
  };

  const holderRole = getHolderRole();

  const handleDisconnect = async () => {
    try {
      // Si estamos dentro del Phantom browser, desconectar también window.solana
      if (isPhantomBrowser) {
        const provider = (window as any).solana;
        if (provider?.disconnect) {
          await provider.disconnect();
        }
      }
      disconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
      disconnect(); // forzar de todas formas
    } finally {
      setIsConnected(false); // forzar desconectado inmediatamente
      setWalletPublicKey(null); // limpiar publicKey local
      setShowWalletMenu(false);
      setBalance(null);
      setError(null);
      setSuccess(false);
      setAssignedHolderRole('');
      setAssignedBurnRole('');
      setBurnedBalance(null);
    }
  };

  const handleChangeWallet = async () => {
    if (isPhantomBrowser) {
      // Dentro de Phantom browser: desconectar y mostrar instrucciones
      await handleDisconnect();
      setError('Para cambiar de cuenta: ve a Phantom → Ajustes → Cambiar cuenta. Luego toca "Conectar Wallet" de nuevo.');
    } else {
      // Desktop y mobile normal — modal normal, NO TOCAR
      setVisible(true);
      setShowWalletMenu(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8 relative">
      {/* Wallet Button (Top Right) */}
      {isConnected && activeWalletAddress && (
        <div className="fixed top-4 right-4 z-50" ref={walletMenuRef}>
          <button
            onClick={() => setShowWalletMenu(!showWalletMenu)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 flex items-center gap-2 transition"
          >
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-white text-sm font-mono">
              {activeWalletAddress.slice(0, 4)}...{activeWalletAddress.slice(-4)}
            </span>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${showWalletMenu ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Dropdown Menu */}
          {showWalletMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
              <button
                onClick={handleChangeWallet}
                className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {isPhantomBrowser ? 'Cambiar cuenta' : 'Cambiar wallet'}
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 transition flex items-center gap-2 border-t border-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Desconectar
              </button>
            </div>
          )}
        </div>
      )}
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Verificación DOGGY
          </h1>
          <p className="text-gray-400 text-lg">
            Verifica tus holdings de DOGGY para desbloquear roles en Discord
          </p>
        </div>

        {/* No Discord ID */}
        {!verifying && (
          <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-8 border border-red-700 text-center">
            <p className="text-red-400">
              ⚠️ No se detectó Discord ID. Usa el botón "Verificar" desde Discord.
            </p>
          </div>
        )}

        {/* Step 1: Connect Wallet */}
        {verifying && !isConnected && !success && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Paso 1: Conectar Wallet</h3>
            <p className="text-gray-400 mb-6">Conecta la wallet que tiene tus DOGGY</p>
            <div className="flex justify-center mb-6 relative z-50">
              {isPhantomBrowser || isMobile ? (
                // Mobile or Phantom browser: Custom button
                <button
                  onClick={handleConnectWallet}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 12a9 9 0 11-9 9 9 9 01-9-9 9 9 009-9zm-9 13a1 1 0 100-2 1 1 0 000 2zm0-6a1 1 0 100-2 1 1 0 000 2z"/>
                  </svg>
                  {isPhantomBrowser ? 'Conectar Wallet' : 'Abrir en Phantom'}
                </button>
              ) : (
                // Desktop: Use standard modal
                <WalletMultiButton />
              )}
            </div>
            <p className="text-gray-500 text-sm">
              Discord ID: {discordId}
            </p>
          </div>
        )}

        {/* Step 2: Show Balance */}
        {/* Step 2: Show Balance */}
        {verifying && isConnected && (
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
                    {balance.toLocaleString()} DOGGY
                  </p>
                  
                  {holderRole ? (
                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mt-4">
                      <p className="text-green-400 text-sm">Rol de Holder que obtendrás:</p>
                      <p className="text-3xl font-bold text-white mt-2">
                        {holderRole.emoji} {holderRole.name}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mt-4">
                      <p className="text-red-400 text-sm">❌ No tienes suficientes DOGGY para rol de Holder</p>
                      <p className="text-white text-sm mt-2">
                        Mínimo requerido: 1,000 DOGGY
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-6 border border-red-700">
                <p className="text-red-400 text-center">{error}</p>
                <button
                  onClick={fetchBalance}
                  className="mt-4 w-full px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Assign Role Button */}
            {!loading && !error && holderRole && !success && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 text-center">
                  Paso 2: Obtener Rol en Discord
                </h3>
                <p className="text-gray-400 mb-6 text-center">
                  Firma un mensaje para probar que eres dueño de esta wallet
                </p>
                <button
                  onClick={handleAssignRole}
                  disabled={assigningRole}
                  className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningRole ? '⏳ Verificando...' : '🎯 Verificar y Asignar Roles'}
                </button>
                <p className="text-gray-500 text-sm mt-4 text-center">
                  Wallet: {activeWalletAddress?.slice(0, 8)}...{activeWalletAddress?.slice(-8)}
                </p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="bg-green-900/20 backdrop-blur-sm rounded-2xl p-8 border border-green-700 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-white mb-4">¡Verificación Completa!</h2>
                
                <div className="space-y-4">
                  {assignedHolderRole && (
                    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                      <p className="text-blue-400 text-sm">Rol de Holder:</p>
                      <p className="text-2xl font-bold text-white">{assignedHolderRole}</p>
                    </div>
                  )}
                  
                  {assignedBurnRole && (
                    <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
                      <p className="text-orange-400 text-sm">Rol de Burner:</p>
                      <p className="text-2xl font-bold text-white">{assignedBurnRole}</p>
                    </div>
                  )}
                  
                  {!assignedBurnRole && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      {burnedBalance !== null && burnedBalance > 0 ? (
                        <>
                          <p className="text-orange-400 text-sm">🔥 Has quemado: <span className="font-bold text-white">{burnedBalance.toLocaleString()} DOGGY</span></p>
                          <p className="text-gray-400 text-xs mt-2">
                            Necesitas <span className="text-orange-400 font-bold">10,000 DOGGY</span> quemados para obtener el rol Bronce
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            Te faltan <span className="text-white font-bold">{(10_000 - burnedBalance).toLocaleString()} DOGGY</span>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-400 text-sm">🔥 No has quemado DOGGY</p>
                          <p className="text-gray-500 text-xs mt-2">
                            Quema DOGGY para obtener roles de burner (mínimo <span className="text-orange-400 font-bold">10,000</span>)
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-gray-400 text-sm mt-6">
                  ✅ Se ha enviado confirmación al canal de Discord
                </p>
                <p className="text-gray-500 text-sm mt-4">
                  Puedes cerrar esta página
                </p>
              </div>
            )}

            {/* Roles Info */}
            {!success && !loading && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4" style={{color: 'white'}}>💎 Roles de Holder Disponibles</h3>
                <div className="space-y-2 text-sm">
                  {HOLDER_ROLES.map((r) => (
                    <div key={r.name} className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                      <span style={{color: 'white'}}>{r.emoji} {r.name}</span>
                      <span className="text-blue-400 font-bold">
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
        <a
          href="https://solscan.io/token/BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          Ver DOGGY en Solscan
        </a>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  const { publicKey, connected, signMessage } = useWallet();
  const [discordId, setDiscordId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [assignedRole, setAssignedRole] = useState('');
  const [balance, setBalance] = useState<number>(0);

  // Get Discord ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordParam = params.get('discord');
    if (discordParam) {
      setDiscordId(discordParam);
      setVerifying(true);
    }
  }, []);

  const handleVerify = useCallback(async () => {
    if (!publicKey || !discordId || !signMessage) {
      setError("Wallet o Discord no detectados");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Sign message to prove wallet ownership
      const message = new TextEncoder().encode(
        `Verificar holdings de DOGGY para rol en Discord\n` +
        `Discord ID: ${discordId}\n` +
        `Timestamp: ${Date.now()}\n` +
        `Esta firma solo prueba propiedad de la wallet. No se realizarán transacciones.`
      );

      let signature: Uint8Array;
      try {
        signature = await signMessage(message);
      } catch (signError: any) {
        setError("Firma rechazada. Necesitas firmar el mensaje para continuar.");
        setLoading(false);
        return;
      }

      // Step 2: Call API to verify and assign role
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          discordId: discordId,
          signature: Array.from(signature),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess(true);
        setAssignedRole(result.role);
        setBalance(result.balance);
      } else {
        setError(result.error || 'Error en la verificación');
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "Error al verificar");
    } finally {
      setLoading(false);
    }
  }, [publicKey, discordId, signMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🐕 Verificación DOGGY
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
        {verifying && !connected && !success && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Paso 1: Conectar Wallet</h3>
            <p className="text-gray-400 mb-6">Conecta tu wallet de Solana para continuar</p>
            <div className="flex justify-center mb-6 relative z-50">
              <WalletMultiButton />
            </div>
            <p className="text-gray-500 text-sm">
              Discord ID: {discordId}
            </p>
          </div>
        )}

        {/* Step 2: Sign & Verify */}
        {verifying && connected && !loading && !success && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Paso 2: Verificar Holdings</h3>
            <p className="text-gray-400 mb-6">
              Haz clic en el botón para firmar un mensaje y verificar tu balance de DOGGY.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                🔒 Se te pedirá firmar un mensaje. Esto solo prueba propiedad de la wallet. No se realizarán transacciones.
              </p>
            </div>
            <button
              onClick={handleVerify}
              className="px-8 py-3 bg-doggy-primary hover:bg-doggy-accent text-white font-bold rounded-lg transition"
            >
              🎯 Verificar y Obtener Rol
            </button>
            <p className="text-gray-500 text-sm mt-4">
              Conectada: {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-doggy-primary mx-auto mb-4"></div>
            <p className="text-white">Verificando tus holdings de DOGGY...</p>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="bg-green-900/20 backdrop-blur-sm rounded-2xl p-8 border border-green-700 text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-4">¡Verificación Completa!</h2>
            <p className="text-gray-300 mb-4">
              Tu rol <span className="font-bold text-doggy-primary">@{assignedRole}</span> ha sido asignado automáticamente.
            </p>
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm">Tu Balance de DOGGY:</p>
              <p className="text-3xl font-bold text-white">{balance.toLocaleString()} DOGGY</p>
            </div>
            <p className="text-gray-400 text-sm">
              ✅ Puedes cerrar esta página y volver a Discord.
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-8 border border-red-700 text-center mb-6">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={handleVerify}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Intentar de Nuevo
            </button>
          </div>
        )}

        {/* Roles Info */}
        {verifying && !success && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              💎 Roles de Holder
            </h3>
            <div className="space-y-3 text-gray-300">
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>🦐 Camaroncin</span>
                <span className="text-doggy-primary font-bold">1K – 900K DOGGY</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>💎 Believer</span>
                <span className="text-doggy-primary font-bold">1M – 3M DOGGY</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>🐋 Ballenita</span>
                <span className="text-doggy-primary font-bold">3M – 6M DOGGY</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>🚀 Doggyllonario</span>
                <span className="text-doggy-primary font-bold">6M+ DOGGY</span>
              </div>
            </div>
            <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                📌 Mínimo requerido: 1,000 DOGGY para obtener el primer rol.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-gray-500 text-sm">
        Creado con ❤️ por Clawy •{" "}
        <a
          href="https://solscan.io/token/BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump"
          target="_blank"
          rel="noopener noreferrer"
          className="text-doggy-primary hover:underline"
        >
          Ver DOGGY en Solscan
        </a>
      </div>
    </div>
  );
}

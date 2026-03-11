"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { verifyTokenHoldings, formatTokenAmount, TokenVerification } from "@/lib/tokenVerification";

export default function VerifyPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [verification, setVerification] = useState<TokenVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyWallet = useCallback(async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await verifyTokenHoldings(publicKey.toBase58());
      setVerification(result);
    } catch (err) {
      setError("Error al verificar la wallet. Por favor intenta de nuevo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      verifyWallet();
    }
  }, [connected, publicKey, verifyWallet]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🐕 Verificación Doggy
          </h1>
          <p className="text-gray-400 text-lg">
            Verifica tus holdings de $DOGGY para desbloquear roles en Discord
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 mb-6 relative z-50">
          <div className="flex justify-center mb-6">
            <WalletMultiButton />
          </div>

          {publicKey && (
            <div className="text-center text-gray-400 text-sm">
              Conectado: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-doggy-primary mx-auto mb-4"></div>
            <p className="text-white">Verificando tu wallet...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-8 border border-red-700 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={verifyWallet}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Verification Results */}
        {verification && !loading && (
          <div className="space-y-4">
            {/* Holdings Card */}
            <div className={`backdrop-blur-sm rounded-2xl p-8 border ${
              verification.isHolder 
                ? "bg-green-900/20 border-green-700" 
                : "bg-gray-800/50 border-gray-700"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Holdings</p>
                  <p className="text-3xl font-bold text-white">
                    {formatTokenAmount(verification.holding)} DOGGY
                  </p>
                </div>
                {verification.isHolder ? (
                  <div className="text-5xl">✅</div>
                ) : (
                  <div className="text-5xl">❌</div>
                )}
              </div>
              {verification.isHolder && (
                <p className="text-green-400 mt-4">
                  ✨ ¡Calificas para el rol HOLDER!
                </p>
              )}
            </div>

            {/* Burns Card */}
            <div className={`backdrop-blur-sm rounded-2xl p-8 border ${
              verification.hasBurned 
                ? "bg-orange-900/20 border-orange-700" 
                : "bg-gray-800/50 border-gray-700"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Quemados</p>
                  <p className="text-3xl font-bold text-white">
                    {formatTokenAmount(verification.burned)} DOGGY
                  </p>
                </div>
                {verification.hasBurned ? (
                  <div className="text-5xl">🔥</div>
                ) : (
                  <div className="text-5xl">⚪</div>
                )}
              </div>
              {verification.hasBurned && (
                <p className="text-orange-400 mt-4">
                  🔥 ¡Calificas para el rol BURNER!
                </p>
              )}
            </div>

            {/* Discord Instructions */}
            {(verification.isHolder || verification.hasBurned) && (
              <div className="bg-blue-900/20 backdrop-blur-sm rounded-2xl p-8 border border-blue-700">
                <h3 className="text-xl font-bold text-white mb-4">
                  📋 Siguientes pasos
                </h3>
                <ol className="text-gray-300 space-y-2">
                  <li>1. Has verificado la propiedad de esta wallet</li>
                  <li>2. Copia tu dirección de wallet abajo</li>
                  <li>3. Usa <code className="bg-gray-800 px-2 py-1 rounded">/verify</code> en Discord</li>
                  <li>4. Pega tu dirección de wallet cuando te lo pida</li>
                </ol>
                <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                  <code className="text-doggy-primary break-all">
                    {publicKey?.toBase58()}
                  </code>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions for non-connected users */}
        {!connected && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              Cómo funciona
            </h3>
            <ol className="text-gray-300 space-y-3">
              <li className="flex items-start">
                <span className="bg-doggy-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">1</span>
                Conecta tu wallet de Solana
              </li>
              <li className="flex items-start">
                <span className="bg-doggy-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">2</span>
                Verificamos tus holdings de DOGGY
              </li>
              <li className="flex items-start">
                <span className="bg-doggy-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">3</span>
                Obtén tu código de verificación para Discord
              </li>
            </ol>
            <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-yellow-400 text-sm">
                ⚠️ La firma de este mensaje solo demostrará que eres el propietario de la cuenta seleccionada.
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

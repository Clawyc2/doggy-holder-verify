"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { verifyTokenHoldings, formatTokenAmount, TokenVerification } from "@/lib/tokenVerification";

export default function VerifyPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const [verification, setVerification] = useState<TokenVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleSignMessage = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Esta wallet no soporta firma de mensajes. Intenta con Phantom o Solflare.");
      return;
    }

    setSigning(true);
    setError(null);

    try {
      // Mensaje claro y transparente - SOLO VERIFICA PROPIEDAD
      const message = `Verificación Doggy BOT

Firma este mensaje para demostrar que eres el propietario de esta wallet.

⚠️ Esta firma NO autoriza ninguna transacción ni gasto de fondos.
⚠️ Solo verifica que tienes acceso a esta wallet.
⚠️ Es seguro y gratuito.

Timestamp: ${Date.now()}`;
      
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);

      // Firma exitosa
      setSigned(true);
      
      // Ahora sí verificamos los holdings
      setLoading(true);
      const result = await verifyTokenHoldings(publicKey.toBase58());
      setVerification(result);
    } catch (err: any) {
      console.error("Error al firmar:", err);
      if (err.message?.includes("User rejected")) {
        setError("Firma rechazada. Debes firmar el mensaje para verificar tu wallet.");
      } else {
        setError(err.message || "Error al firmar el mensaje");
      }
    } finally {
      setSigning(false);
      setLoading(false);
    }
  }, [publicKey, signMessage]);

  // Reset cuando cambia la wallet
  useEffect(() => {
    setSigned(false);
    setVerification(null);
    setError(null);
  }, [publicKey?.toBase58()]);

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

        {/* Sign Message Button */}
        {connected && !signed && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 mb-6">
            <div className="text-center">
              <p className="text-gray-300 mb-6">
                Wallet conectada. Ahora firma un mensaje para verificar que eres el dueño.
              </p>
              
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
                <p className="text-yellow-400 text-sm mb-2">
                  ⚠️ <strong>¿Qué hace esta firma?</strong>
                </p>
                <ul className="text-yellow-300 text-sm text-left space-y-1">
                  <li>• Demuestra que eres dueño de esta wallet</li>
                  <li>• <strong>NO</strong> autoriza ninguna transacción</li>
                  <li>• <strong>NO</strong> gasta nada (es gratuito)</li>
                  <li>• Solo verificamos tus holdings de DOGGY</li>
                </ul>
              </div>

              <button
                onClick={handleSignMessage}
                disabled={signing}
                className="px-8 py-3 bg-doggy-primary hover:bg-orange-500 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {signing ? "Abre tu wallet para firmar..." : "🔐 Firmar mensaje para verificar"}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-doggy-primary mx-auto mb-4"></div>
            <p className="text-white">Verificando tus holdings de DOGGY...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-8 border border-red-700 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={handleSignMessage}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Verification Results */}
        {verification && signed && !loading && (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="bg-green-900/20 backdrop-blur-sm rounded-2xl p-6 border border-green-700 text-center">
              <p className="text-green-400 text-lg">✅ Wallet verificada correctamente</p>
            </div>

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
                  <li>1. Has verificado la propiedad de esta wallet ✅</li>
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
                Conecta tu wallet de Solana (Phantom, Solflare)
              </li>
              <li className="flex items-start">
                <span className="bg-doggy-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">2</span>
                Firma un mensaje para verificar propiedad
              </li>
              <li className="flex items-start">
                <span className="bg-doggy-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">3</span>
                Verificamos tus holdings de DOGGY
              </li>
              <li className="flex items-start">
                <span className="bg-doggy-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">4</span>
                Obtén acceso a roles en Discord
              </li>
            </ol>
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <p className="text-blue-400 text-sm">
                💡 <strong>¿Por qué firmar?</strong> La firma demuestra que tienes acceso a la wallet sin revelar tu private key. Es 100% seguro y gratuito.
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

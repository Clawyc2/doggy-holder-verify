"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { verifyTokenHoldings, formatTokenAmount } from "@/lib/tokenVerification";

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
        `Verify DOGGY holdings for Discord role\n` +
        `Discord ID: ${discordId}\n` +
        `Timestamp: ${Date.now()}\n` +
        `This signature only proves wallet ownership. No transactions will be made.`
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
            🐕 Doggy Verification
          </h1>
          <p className="text-gray-400 text-lg">
            Verify your DOGGY holdings to unlock Discord roles
          </p>
        </div>

        {/* No Discord ID */}
        {!verifying && (
          <div className="bg-red-900/20 backdrop-blur-sm rounded-2xl p-8 border border-red-700 text-center">
            <p className="text-red-400">
              ⚠️ No Discord ID detected. Please use the "Verify" button from Discord.
            </p>
          </div>
        )}

        {/* Step 1: Connect Wallet */}
        {verifying && !connected && !success && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Step 1: Connect Wallet</h3>
            <p className="text-gray-400 mb-6">Connect your Solana wallet to continue</p>
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
            <h3 className="text-xl font-bold text-white mb-2">Step 2: Verify Holdings</h3>
            <p className="text-gray-400 mb-6">
              Click the button below to sign a message and verify your DOGGY balance.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                🔒 You will be asked to sign a message. This only proves wallet ownership. No transactions will be made.
              </p>
            </div>
            <button
              onClick={handleVerify}
              className="px-8 py-3 bg-doggy-primary hover:bg-doggy-accent text-white font-bold rounded-lg transition"
            >
              🎯 Verify & Get Role
            </button>
            <p className="text-gray-500 text-sm mt-4">
              Connected: {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-doggy-primary mx-auto mb-4"></div>
            <p className="text-white">Verifying your DOGGY holdings...</p>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="bg-green-900/20 backdrop-blur-sm rounded-2xl p-8 border border-green-700 text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-4">¡Verification Complete!</h2>
            <p className="text-gray-300 mb-4">
              Your role <span className="font-bold text-doggy-primary">@{assignedRole}</span> has been assigned automatically.
            </p>
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm">Your DOGGY Balance:</p>
              <p className="text-3xl font-bold text-white">{balance.toLocaleString()} DOGGY</p>
            </div>
            <p className="text-gray-400 text-sm">
              ✅ You can close this page and return to Discord.
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
              Try Again
            </button>
          </div>
        )}

        {/* Roles Info */}
        {verifying && !success && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              💎 Available Roles
            </h3>
            <div className="space-y-3 text-gray-300">
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>• DoggyHolder</span>
                <span className="text-doggy-primary font-bold">1K - 100K DOGGY</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>• DoggyOG</span>
                <span className="text-doggy-primary font-bold">100K - 500K DOGGY</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                <span>• DoggyMaxi</span>
                <span className="text-doggy-primary font-bold">500K+ DOGGY</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-gray-500 text-sm">
        Created with ❤️ by Clawy •{" "}
        <a
          href="https://solscan.io/token/BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump"
          target="_blank"
          rel="noopener noreferrer"
          className="text-doggy-primary hover:underline"
        >
          View DOGGY on Solscan
        </a>
      </div>
    </div>
  );
}

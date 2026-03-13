"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { 
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache
} from "@solana-mobile/wallet-adapter-mobile";

require("@solana/wallet-adapter-react-ui/styles.css");

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
  // Use RPC from environment variable
  // NEXT_PUBLIC_RPC_URL must be set in Vercel environment variables
  const endpoint = useMemo(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      console.error('❌ NEXT_PUBLIC_RPC_URL not configured');
      return 'https://api.mainnet-beta.solana.com'; // Fallback to public RPC
    }
    return rpcUrl;
  }, []);
  
  // Check if mobile
  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const wallets = useMemo(
    () => {
      if (isMobile) {
        // Mobile: Only mobile wallet adapter (no desktop wallets)
        return [
          new SolanaMobileWalletAdapter({
            addressSelector: createDefaultAddressSelector(),
            appIdentity: {
              name: 'DOGGY Holder Verify',
              uri: 'https://doggy-bot.vercel.app',
            },
            authorizationResultCache: createDefaultAuthorizationResultCache(),
            cluster: 'mainnet-beta',
            onWalletNotFound: async () => {
              window.open('https://phantom.app/', '_blank');
            },
          }),
        ];
      } else {
        // Desktop: Standard wallets
        return [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
        ];
      }
    },
    [isMobile]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

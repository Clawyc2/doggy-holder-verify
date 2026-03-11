import { Connection, PublicKey } from "@solana/web3.js";

const DOGGY_TOKEN_MINT = "BS7HxRitaY5ipGfbek1nmatWLbaS9yoWRSEQzCb3pump";
const BURN_ADDRESS = "Burn111111111111111111111111111111111111111";

export interface TokenVerification {
  holding: number;
  burned: number;
  isHolder: boolean;
  hasBurned: boolean;
}

export async function verifyTokenHoldings(
  walletAddress: string
): Promise<TokenVerification> {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const walletPubkey = new PublicKey(walletAddress);
  const tokenMint = new PublicKey(DOGGY_TOKEN_MINT);
  const burnPubkey = new PublicKey(BURN_ADDRESS);

  try {
    // Get token accounts for the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { mint: tokenMint }
    );

    let holding = 0;
    
    // Sum up all token accounts for this mint
    for (const account of tokenAccounts.value) {
      const info = account.account.data.parsed.info;
      holding += parseFloat(info.tokenAmount.uiAmount || "0");
    }

    // Get burned tokens (transfers to burn address)
    const burnAccountInfo = await connection.getParsedTokenAccountsByOwner(
      burnPubkey,
      { mint: tokenMint }
    );

    let totalBurned = 0;
    
    // We need to check signatures to see if this wallet sent to burn address
    // This is expensive, so for MVP we'll check the burn address total
    for (const account of burnAccountInfo.value) {
      const info = account.account.data.parsed.info;
      totalBurned += parseFloat(info.tokenAmount.uiAmount || "0");
    }

    // For individual wallet burn verification, we'd need to parse transaction history
    // For now, return holdings and indicate if they're a holder
    const burned = await getWalletBurnAmount(connection, walletPubkey, tokenMint, burnPubkey);

    return {
      holding,
      burned,
      isHolder: holding > 0,
      hasBurned: burned > 0,
    };
  } catch (error) {
    console.error("Error verifying tokens:", error);
    return {
      holding: 0,
      burned: 0,
      isHolder: false,
      hasBurned: false,
    };
  }
}

async function getWalletBurnAmount(
  connection: Connection,
  walletPubkey: PublicKey,
  tokenMint: PublicKey,
  burnPubkey: PublicKey
): Promise<number> {
  try {
    // Get recent signatures for this wallet
    const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit: 100 });
    
    let burnTotal = 0;

    // Check each transaction to see if it was a burn
    for (const sig of signatures) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature);
        
        if (tx?.meta?.postTokenBalances && tx.meta.preTokenBalances) {
          // Look for transfers to burn address
          for (let i = 0; i < tx.transaction.message.accountKeys.length; i++) {
            const account = tx.transaction.message.accountKeys[i];
            if (account.pubkey.equals(burnPubkey) || account.pubkey.equals(walletPubkey)) {
              const postBalance = tx.meta.postTokenBalances.find(
                b => b.accountIndex === i && b.mint === tokenMint.toBase58()
              );
              const preBalance = tx.meta.preTokenBalances.find(
                b => b.accountIndex === i && b.mint === tokenMint.toBase58()
              );

              if (preBalance && postBalance) {
                const diff = parseFloat(preBalance.uiAmount || "0") - parseFloat(postBalance.uiAmount || "0");
                if (diff > 0) {
                  burnTotal += diff;
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip failed transaction parses
      }
    }

    return burnTotal;
  } catch (error) {
    console.error("Error getting burn amount:", error);
    return 0;
  }
}

export function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toFixed(2);
}

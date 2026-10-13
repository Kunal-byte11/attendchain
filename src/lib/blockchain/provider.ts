import { ethers } from "ethers";
import { logger } from "@/lib/logger";

export interface NetworkConfig {
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  31337: {
    chainId: 31337,
    chainName: "Hardhat Localhost",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: [
      process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || "http://127.0.0.1:8545",
      "http://localhost:8545",
    ],
    blockExplorerUrls: [],
  },
  11155111: {
    chainId: 11155111,
    chainName: "Ethereum Sepolia Testnet",
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "SEP",
      decimals: 18,
    },
    rpcUrls: [
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_PRIMARY_URL ||
        "https://rpc.sepolia.org",
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_FALLBACK_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com",
    ],
    blockExplorerUrls: [
      process.env.NEXT_PUBLIC_SEPOLIA_EXPLORER_URL ||
        "https://sepolia.etherscan.io",
    ],
  },
};

export class RpcUnavailableError extends Error {
  public readonly code = "RPC_UNAVAILABLE";
  public readonly attempts: { url: string; error: string; latencyMs: number }[];

  constructor(
    message: string,
    attempts: { url: string; error: string; latencyMs: number }[]
  ) {
    super(message);
    this.name = "RpcUnavailableError";
    this.attempts = attempts;
  }
}

/**
 * Executes a read operation against a sequence of RPC endpoints with fallback & latency tracking (TR-013).
 */
export async function executeWithFailover<T>(
  rpcUrls: string[],
  operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
  options?: { maxTimeoutMs?: number }
): Promise<{ result: T; successfulRpcUrl: string; latencyMs: number }> {
  if (!rpcUrls || rpcUrls.length === 0) {
    throw new RpcUnavailableError("No RPC URLs provided for execution", []);
  }

  const timeoutMs = options?.maxTimeoutMs ?? 8000;
  const attempts: { url: string; error: string; latencyMs: number }[] = [];

  for (const url of rpcUrls) {
    const startTime = Date.now();
    try {
      const provider = new ethers.JsonRpcProvider(url, undefined, {
        staticNetwork: true,
      });

      const result = await Promise.race([
        operation(provider),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`RPC timeout exceeded (${timeoutMs}ms)`)),
            timeoutMs
          )
        ),
      ]);

      const latencyMs = Date.now() - startTime;
      return { result, successfulRpcUrl: url, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg =
        err instanceof Error ? err.message : "Unknown RPC execution error";
      attempts.push({ url, error: errorMsg, latencyMs });
      logger.warn("RPC node execution failed; attempting fallback", {
        eventCode: "RPC_NODE_FAILOVER_ATTEMPT",
        failedUrl: url,
        latencyMs,
        error: errorMsg,
      });
    }
  }

  throw new RpcUnavailableError(
    `All ${rpcUrls.length} RPC endpoints failed or timed out.`,
    attempts
  );
}

/**
 * Returns a static FallbackProvider instance with primary and fallback endpoints.
 */
export function getReadProvider(chainId: number): ethers.FallbackProvider {
  const config = SUPPORTED_NETWORKS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const providers = config.rpcUrls.map((url, index) => {
    const jsonRpc = new ethers.JsonRpcProvider(url, chainId, {
      staticNetwork: true,
    });
    return {
      provider: jsonRpc,
      priority: index + 1,
      weight: 1,
      stallTimeout: 1500,
    };
  });

  return new ethers.FallbackProvider(providers, 1);
}

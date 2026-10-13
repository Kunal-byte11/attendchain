"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ethers } from "ethers";
import { SUPPORTED_NETWORKS, type NetworkConfig } from "./provider";
import { logger } from "@/lib/logger";

export interface Eip1193Provider {
  request: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
}

export type WalletConnectionState =
  | "disconnected"
  | "connecting"
  | "connected-unverified"
  | "authenticated"
  | "wrong-network";

export interface WalletContextValue {
  account: string | null;
  chainId: number | null;
  state: WalletConnectionState;
  isSupportedNetwork: boolean;
  activeNetworkConfig: NetworkConfig | null;
  error: string | null;
  isMetaMaskAvailable: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  switchNetwork: (targetChainId: number) => Promise<boolean>;
  getBrowserProvider: () => ethers.BrowserProvider | null;
  getSigner: () => Promise<ethers.JsonRpcSigner | null>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [state, setState] = useState<WalletConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] =
    useState<boolean>(false);

  const getEthereum = useCallback((): Eip1193Provider | null => {
    if (typeof window === "undefined") return null;
    const win = window as unknown as { ethereum?: Eip1193Provider };
    return win.ethereum ?? null;
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    setIsMetaMaskAvailable(Boolean(ethereum));
  }, [getEthereum]);

  const isSupportedNetwork =
    chainId !== null && Boolean(SUPPORTED_NETWORKS[chainId]);
  const activeNetworkConfig =
    chainId !== null ? (SUPPORTED_NETWORKS[chainId] ?? null) : null;

  const handleAccountsChanged = useCallback((accounts: unknown) => {
    const accList = accounts as string[];
    if (!accList || accList.length === 0) {
      setAccount(null);
      setState("disconnected");
      setError(null);
    } else {
      const checksummed = ethers.getAddress(accList[0]!);
      setAccount(checksummed);
      setState((prev) =>
        prev === "wrong-network" ? "wrong-network" : "connected-unverified"
      );
      setError(null);
    }
  }, []);

  const handleChainChanged = useCallback((rawChainId: unknown) => {
    const parsedId =
      typeof rawChainId === "string"
        ? parseInt(rawChainId, 16)
        : Number(rawChainId);
    setChainId(parsedId);

    if (!SUPPORTED_NETWORKS[parsedId]) {
      setState("wrong-network");
      setError(
        `Unsupported network (Chain ID: ${parsedId}). Please switch to Sepolia or Hardhat.`
      );
    } else {
      setState((prev) =>
        prev === "wrong-network" ? "connected-unverified" : prev
      );
      setError(null);
    }
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    // Check currently connected account without prompting
    ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        handleAccountsChanged(accounts);
        return ethereum.request({ method: "eth_chainId" });
      })
      .then((hexChainId) => {
        handleChainChanged(hexChainId);
      })
      .catch((err: unknown) => {
        logger.warn("Failed to initialize wallet state", {
          eventCode: "WALLET_INITIALIZATION_FAILED",
          error: err instanceof Error ? err.message : String(err),
        });
      });

    const onAccounts = (acc: unknown) => handleAccountsChanged(acc);
    const onChain = (c: unknown) => handleChainChanged(c);
    const onDisconnect = () => {
      setAccount(null);
      setState("disconnected");
    };

    ethereum.on("accountsChanged", onAccounts);
    ethereum.on("chainChanged", onChain);
    ethereum.on("disconnect", onDisconnect);

    return () => {
      ethereum.removeListener("accountsChanged", onAccounts);
      ethereum.removeListener("chainChanged", onChain);
      ethereum.removeListener("disconnect", onDisconnect);
    };
  }, [getEthereum, handleAccountsChanged, handleChainChanged]);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setError("MetaMask or compatible Web3 wallet not detected.");
      return null;
    }

    try {
      setState("connecting");
      setError(null);

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        setState("disconnected");
        return null;
      }

      const checksummed = ethers.getAddress(accounts[0]!);
      setAccount(checksummed);

      const hexChainId = (await ethereum.request({
        method: "eth_chainId",
      })) as string;
      const parsedId = parseInt(hexChainId, 16);
      setChainId(parsedId);

      if (!SUPPORTED_NETWORKS[parsedId]) {
        setState("wrong-network");
        setError(
          `Connected to unsupported network (${parsedId}). Please switch to Ethereum Sepolia or Hardhat Localhost.`
        );
      } else {
        setState("connected-unverified");
      }

      return checksummed;
    } catch (err: unknown) {
      setState("disconnected");
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      logger.error("Wallet connection failed", {
        eventCode: "WALLET_CONNECTION_ERROR",
        error: message,
      });
      return null;
    }
  }, [getEthereum]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setState("disconnected");
    setError(null);
  }, []);

  const switchNetwork = useCallback(
    async (targetChainId: number): Promise<boolean> => {
      const ethereum = getEthereum();
      if (!ethereum) return false;

      const hexChainId = `0x${targetChainId.toString(16)}`;
      const targetConfig = SUPPORTED_NETWORKS[targetChainId];

      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        });
        setChainId(targetChainId);
        setState("connected-unverified");
        setError(null);
        return true;
      } catch (switchError: unknown) {
        // Error code 4902 indicates chain has not been added to wallet
        const errorRecord = switchError as { code?: number };
        if (errorRecord.code === 4902 && targetConfig) {
          try {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: hexChainId,
                  chainName: targetConfig.chainName,
                  nativeCurrency: targetConfig.nativeCurrency,
                  rpcUrls: targetConfig.rpcUrls,
                  blockExplorerUrls: targetConfig.blockExplorerUrls,
                },
              ],
            });
            setChainId(targetChainId);
            setState("connected-unverified");
            setError(null);
            return true;
          } catch (addError: unknown) {
            const addMsg =
              addError instanceof Error
                ? addError.message
                : "Failed to add chain";
            setError(addMsg);
            return false;
          }
        }

        const msg =
          switchError instanceof Error
            ? switchError.message
            : "Failed to switch chain";
        setError(msg);
        return false;
      }
    },
    [getEthereum]
  );

  const getBrowserProvider = useCallback((): ethers.BrowserProvider | null => {
    const ethereum = getEthereum();
    if (!ethereum) return null;
    return new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
  }, [getEthereum]);

  const getSigner =
    useCallback(async (): Promise<ethers.JsonRpcSigner | null> => {
      const provider = getBrowserProvider();
      if (!provider) return null;
      try {
        return await provider.getSigner();
      } catch {
        return null;
      }
    }, [getBrowserProvider]);

  const value: WalletContextValue = {
    account,
    chainId,
    state,
    isSupportedNetwork,
    activeNetworkConfig,
    error,
    isMetaMaskAvailable,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    getBrowserProvider,
    getSigner,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

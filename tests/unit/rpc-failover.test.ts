import { describe, it, expect, vi } from "vitest";
import {
  executeWithFailover,
  RpcUnavailableError,
  SUPPORTED_NETWORKS,
} from "@/lib/blockchain/provider";
import { ethers } from "ethers";

describe("RPC Failover Wrapper (TR-013, NFR-002, NFR-003)", () => {
  it("executes successfully on primary RPC when primary is healthy", async () => {
    const urls = ["http://primary-rpc.local", "http://fallback-rpc.local"];
    let callCount = 0;

    const op = vi.fn(async (_provider: ethers.JsonRpcProvider) => {
      callCount++;
      return 42;
    });

    const result = await executeWithFailover(urls, op);
    expect(result.result).toBe(42);
    expect(result.successfulRpcUrl).toBe("http://primary-rpc.local");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(callCount).toBe(1);
  });

  it("fails over to secondary RPC when primary returns 429 or 503 error", async () => {
    const urls = ["http://rate-limited.local", "http://healthy-fallback.local"];

    const op = vi.fn(async (provider: ethers.JsonRpcProvider) => {
      // Access private or internal target URL
      const currentUrl = (
        provider as unknown as { _getConnection(): { url: string } }
      )._getConnection().url;
      if (currentUrl === "http://rate-limited.local") {
        throw new Error("HTTP 429 Too Many Requests (Rate limit exceeded)");
      }
      return "fallback_success";
    });

    const result = await executeWithFailover(urls, op);
    expect(result.result).toBe("fallback_success");
    expect(result.successfulRpcUrl).toBe("http://healthy-fallback.local");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("throws RpcUnavailableError containing all attempts when all RPCs fail", async () => {
    const urls = ["http://down-1.local", "http://down-2.local"];

    const op = vi.fn(async () => {
      throw new Error("503 Service Unavailable");
    });

    await expect(executeWithFailover(urls, op)).rejects.toThrow(
      RpcUnavailableError
    );

    try {
      await executeWithFailover(urls, op);
    } catch (err: unknown) {
      const rpcErr = err as RpcUnavailableError;
      expect(rpcErr.code).toBe("RPC_UNAVAILABLE");
      expect(rpcErr.attempts).toHaveLength(2);
      expect(rpcErr.attempts[0]?.url).toBe("http://down-1.local");
      expect(rpcErr.attempts[1]?.url).toBe("http://down-2.local");
    }
  });

  it("enforces timeout on slow hanging RPC nodes and switches to secondary", async () => {
    const urls = ["http://hanging-rpc.local", "http://fast-fallback.local"];

    const op = vi.fn(async (provider: ethers.JsonRpcProvider) => {
      const currentUrl = (
        provider as unknown as { _getConnection(): { url: string } }
      )._getConnection().url;
      if (currentUrl === "http://hanging-rpc.local") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return "too_late";
      }
      return "fast_result";
    });

    const result = await executeWithFailover(urls, op, { maxTimeoutMs: 100 });
    expect(result.result).toBe("fast_result");
    expect(result.successfulRpcUrl).toBe("http://fast-fallback.local");
  });

  it("rejects empty URL list", async () => {
    await expect(executeWithFailover([], vi.fn())).rejects.toThrow(
      RpcUnavailableError
    );
  });

  it("validates supported networks configuration structure", () => {
    expect(SUPPORTED_NETWORKS[31337]).toBeDefined();
    expect(SUPPORTED_NETWORKS[31337]?.chainName).toContain("Hardhat");
    expect(SUPPORTED_NETWORKS[11155111]).toBeDefined();
    expect(SUPPORTED_NETWORKS[11155111]?.chainName).toContain("Sepolia");
  });
});

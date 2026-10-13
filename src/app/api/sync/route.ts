import { NextResponse } from "next/server";
import { z } from "zod";
import deploymentsData from "@/lib/blockchain/deployments.json";
import { getReadProvider } from "@/lib/blockchain/provider";
import { syncBlockchainEvents } from "@/lib/blockchain/sync";
import { logger } from "@/lib/logger";

const syncRequestSchema = z.object({
  chainId: z.number().int().positive().optional().default(31337),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte transaction hash")
    .optional(),
  fromBlock: z.number().int().nonnegative().optional(),
  toBlock: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty or non-JSON body defaults to empty object
      body = {};
    }

    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid sync request parameters.",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { chainId, txHash, fromBlock, toBlock } = parsed.data;

    // Resolve contract address for chainId
    // If deployments matches chainId, use its address, else fallback or error
    let contractAddress: string | undefined;
    if (deploymentsData.chainId === chainId) {
      contractAddress = deploymentsData.contracts.AttendChainRegistry.address;
    } else {
      contractAddress = process.env.NEXT_PUBLIC_ATTENDCHAIN_REGISTRY_ADDRESS;
    }

    if (!contractAddress) {
      return NextResponse.json(
        {
          error: {
            code: "CONTRACT_NOT_DEPLOYED",
            message: `AttendChainRegistry contract address not configured for chainId ${chainId}.`,
          },
        },
        { status: 500 }
      );
    }

    const provider = getReadProvider(chainId);

    const syncResult = await syncBlockchainEvents(provider, contractAddress, {
      chainId,
      txHash,
      fromBlock,
      toBlock,
    });

    logger.info("Blockchain event synchronization executed successfully", {
      eventCode: "BLOCKCHAIN_SYNC_SUCCESS",
      chainId: syncResult.chainId,
      processedEvents: syncResult.processedEvents,
      latestSyncedBlock: syncResult.latestSyncedBlock,
      syncedRecordsCount: syncResult.syncedRecordsCount,
    });

    return NextResponse.json({
      success: true,
      data: syncResult,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Sync execution failed";
    logger.error("Blockchain event synchronization failed", {
      eventCode: "BLOCKCHAIN_SYNC_ERROR",
      error: errorMsg,
    });

    return NextResponse.json(
      {
        error: {
          code: "SYNC_EXECUTION_FAILED",
          message: errorMsg,
        },
      },
      { status: 500 }
    );
  }
}

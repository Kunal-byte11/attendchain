import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import { POST as nonceHandler } from "@/app/api/auth/nonce/route";
import { POST as verifyHandler } from "@/app/api/auth/verify/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { resetMemoryDb, getMemoryDb } from "@/lib/db/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

describe("EIP-4361 SIWE Auth Integration Suite (T-009, TR-002, NFR-005)", () => {
  // Hardhat Account #0 (Admin)
  const adminWallet = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  // Hardhat Account #1 (Teacher)
  const teacherWallet = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  );
  // Fresh unregistered wallet
  const randomWallet = ethers.Wallet.createRandom();

  beforeEach(() => {
    resetMemoryDb();
  });

  it("authenticates registered admin with single-use SIWE nonce and returns session cookie", async () => {
    // 1. Request nonce
    const nonceReq = new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: adminWallet.address }),
    });
    const nonceRes = await nonceHandler(nonceReq);
    expect(nonceRes.status).toBe(200);

    const nonceData = await nonceRes.json();
    expect(nonceData.nonce).toBeDefined();
    expect(nonceData.message).toContain(adminWallet.address);

    // 2. Wallet signs the EIP-4361 challenge
    const signature = await adminWallet.signMessage(nonceData.message);

    // 3. Verify signature
    const verifyReq = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: adminWallet.address,
        message: nonceData.message,
        signature,
      }),
    });
    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(200);

    const verifyData = await verifyRes.json();
    expect(verifyData.user.role).toBe("ADMIN");
    expect(verifyData.user.walletAddress).toBe(adminWallet.address);

    // 4. Assert HttpOnly cookie
    const setCookie = verifyRes.cookies.get(SESSION_COOKIE_NAME);
    expect(setCookie).toBeDefined();
    expect(setCookie?.httpOnly).toBe(true);

    const sessionPayload = await verifySessionToken(setCookie!.value);
    expect(sessionPayload?.role).toBe("ADMIN");
    expect(sessionPayload?.sub).toBe(adminWallet.address);
  });

  it("rejects replayed nonce (single-use enforcement)", async () => {
    const nonceReq = new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: teacherWallet.address }),
    });
    const nonceRes = await nonceHandler(nonceReq);
    const nonceData = await nonceRes.json();
    const signature = await teacherWallet.signMessage(nonceData.message);

    const verifyReq1 = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: teacherWallet.address,
        message: nonceData.message,
        signature,
      }),
    });
    const verifyRes1 = await verifyHandler(verifyReq1);
    expect(verifyRes1.status).toBe(200);

    // Second attempt with identical signature must return 401 NONCE_ALREADY_USED
    const verifyReq2 = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: teacherWallet.address,
        message: nonceData.message,
        signature,
      }),
    });
    const verifyRes2 = await verifyHandler(verifyReq2);
    expect(verifyRes2.status).toBe(401);
    const errData = await verifyRes2.json();
    expect(errData.error.code).toBe("NONCE_ALREADY_USED");
  });

  it("rejects expired nonce (>5m TTL)", async () => {
    const nonceReq = new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: teacherWallet.address }),
    });
    const nonceRes = await nonceHandler(nonceReq);
    const nonceData = await nonceRes.json();

    // Manually expire nonce in test DB
    const db = getMemoryDb();
    const record = db.nonces.get(nonceData.nonce);
    expect(record).toBeDefined();
    record!.expiresAt = Date.now() - 1000; // Expired 1 second ago

    const signature = await teacherWallet.signMessage(nonceData.message);
    const verifyReq = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: teacherWallet.address,
        message: nonceData.message,
        signature,
      }),
    });
    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(401);
    const errData = await verifyRes.json();
    expect(errData.error.code).toBe("NONCE_EXPIRED");
  });

  it("rejects forged signature from wrong signer", async () => {
    const nonceReq = new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: adminWallet.address }),
    });
    const nonceRes = await nonceHandler(nonceReq);
    const nonceData = await nonceRes.json();

    // Attacker signs message using randomWallet instead of adminWallet
    const forgedSignature = await randomWallet.signMessage(nonceData.message);

    const verifyReq = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: adminWallet.address,
        message: nonceData.message,
        signature: forgedSignature,
      }),
    });
    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(401);
    const errData = await verifyRes.json();
    expect(errData.error.code).toBe("INVALID_SIGNATURE");
  });

  it("binds new wallet to synthetic student profile via valid claim code", async () => {
    // Student SYN-2026-007 (Rohan Kulkarni) has claimCode: CLAIM-SYN-007 and no bound wallet
    const nonceReq = new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: randomWallet.address }),
    });
    const nonceRes = await nonceHandler(nonceReq);
    const nonceData = await nonceRes.json();
    const signature = await randomWallet.signMessage(nonceData.message);

    const verifyReq = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: randomWallet.address,
        message: nonceData.message,
        signature,
        studentClaimCode: "CLAIM-SYN-007",
      }),
    });
    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();

    expect(verifyData.user.role).toBe("STUDENT");
    expect(verifyData.user.walletAddress).toBe(randomWallet.address);

    const db = getMemoryDb();
    const boundUser = db.users.get(randomWallet.address.toLowerCase());
    expect(boundUser).toBeDefined();
    expect(boundUser?.role).toBe("STUDENT");
  });

  it("clears session cookie on logout", async () => {
    const logoutRes = await logoutHandler();
    expect(logoutRes.status).toBe(200);
    const cookie = logoutRes.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });
});

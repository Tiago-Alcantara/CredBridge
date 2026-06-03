import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDepositStage, submitDepositStage } from "@/lib/api/investments";
import { runOnChainDeposit } from "./sign-deposit";

vi.mock("@/lib/api/investments", () => ({
  buildDepositStage: vi.fn(),
  submitDepositStage: vi.fn(),
}));

describe("runOnChainDeposit", () => {
  const transactionId = "txn-abc123";
  const privyAddress = "GPRIVYSTELLARADDRESS";
  const signRawHash = vi.fn().mockResolvedValue({ signature: "0xsig" });
  const onStage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    signRawHash.mockResolvedValue({ signature: "0xsig" });

    vi.mocked(buildDepositStage).mockImplementation((_id, stage) => {
      if (stage === "approve") {
        return Promise.resolve({ xdr: "approve-xdr", hashToSign: "approveHashHex", signerPublicKey: "GSIGNER" });
      }
      return Promise.resolve({ xdr: "deposit-xdr", hashToSign: "depositHashHex", signerPublicKey: "GSIGNER" });
    });

    vi.mocked(submitDepositStage).mockImplementation((_id, stage) => {
      if (stage === "approve") {
        return Promise.resolve({ hash: "APPROVE_HASH", status: "APPROVED" });
      }
      return Promise.resolve({ hash: "DEPOSIT_HASH", status: "COMPLETED" });
    });
  });

  it("calls buildDepositStage for approve then deposit in order", async () => {
    await runOnChainDeposit({ transactionId, privyAddress, signRawHash, onStage });

    expect(buildDepositStage).toHaveBeenCalledTimes(2);
    expect(buildDepositStage).toHaveBeenNthCalledWith(1, transactionId, "approve");
    expect(buildDepositStage).toHaveBeenNthCalledWith(2, transactionId, "deposit");
  });

  it("prefixes each hashToSign with 0x and calls signRawHash with the correct address and chainType", async () => {
    await runOnChainDeposit({ transactionId, privyAddress, signRawHash, onStage });

    expect(signRawHash).toHaveBeenCalledTimes(2);
    expect(signRawHash).toHaveBeenNthCalledWith(1, {
      address: privyAddress,
      chainType: "stellar",
      hash: "0xapproveHashHex",
    });
    expect(signRawHash).toHaveBeenNthCalledWith(2, {
      address: privyAddress,
      chainType: "stellar",
      hash: "0xdepositHashHex",
    });
  });

  it("returns depositHash from the deposit stage submit result, not the approve stage result", async () => {
    const result = await runOnChainDeposit({ transactionId, privyAddress, signRawHash, onStage });

    expect(result.depositHash).toBe("DEPOSIT_HASH");
  });

  it("fires onStage callback for approve then deposit in order", async () => {
    await runOnChainDeposit({ transactionId, privyAddress, signRawHash, onStage });

    expect(onStage).toHaveBeenCalledTimes(2);
    expect(onStage).toHaveBeenNthCalledWith(1, "approve");
    expect(onStage).toHaveBeenNthCalledWith(2, "deposit");
  });

  it("throws when the deposit stage submit returns an empty hash", async () => {
    vi.mocked(submitDepositStage).mockImplementation((_id, stage) => {
      if (stage === "approve") {
        return Promise.resolve({ hash: "APPROVE_HASH", status: "APPROVED" });
      }
      return Promise.resolve({ hash: "", status: "PENDING" });
    });

    await expect(
      runOnChainDeposit({ transactionId, privyAddress, signRawHash, onStage }),
    ).rejects.toThrow("Depósito on-chain não retornou hash da etapa de depósito");
  });
});

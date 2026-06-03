import { buildDepositStage, submitDepositStage, type DepositStage } from "@/lib/api/investments";

type SignRawHash = (input: {
  address: string;
  chainType: "stellar";
  hash: `0x${string}`;
}) => Promise<{ signature: string }>;

export async function runOnChainDeposit(params: {
  transactionId: string;
  privyAddress: string;
  signRawHash: SignRawHash;
  onStage?: (stage: DepositStage) => void;
}): Promise<{ depositHash: string }> {
  const stages: DepositStage[] = ["approve", "deposit"];
  let depositHash = "";

  for (const stage of stages) {
    params.onStage?.(stage);
    const built = await buildDepositStage(params.transactionId, stage);
    const { signature } = await params.signRawHash({
      address: params.privyAddress,
      chainType: "stellar",
      hash: `0x${built.hashToSign}`,
    });
    const result = await submitDepositStage(params.transactionId, stage, built.xdr, signature);
    if (stage === "deposit") {
      depositHash = result.hash;
    }
  }

  if (!depositHash) {
    throw new Error("Depósito on-chain não retornou hash da etapa de depósito");
  }

  return { depositHash };
}

export interface LinkedAccount {
  type?: string;
  address?: string;
  chainType?: string;
  chain_type?: string;
}

export function findPrivyStellarWalletAddress(
  linkedAccounts: LinkedAccount[] | undefined,
): string | null {
  const stellarWallet = linkedAccounts?.find(
    (linkedAccount) =>
      linkedAccount.type === "wallet" &&
      (linkedAccount.chainType === "stellar" ||
        linkedAccount.chain_type === "stellar") &&
      typeof linkedAccount.address === "string",
  );

  return stellarWallet?.address ?? null;
}

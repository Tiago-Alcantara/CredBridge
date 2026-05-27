import { useCallback, useState } from 'react';
import { useUser } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { useGetWallet } from '@/lib/api/wallet';
import {
  type CreateFinancialAuthorizationInput,
  useCreateFinancialAuthorizationChallenge,
  useVerifyFinancialAuthorization,
} from '@/lib/api/financial-authorizations';

interface LinkedAccount {
  type?: string;
  address?: string;
  chainType?: string;
  chain_type?: string;
}

function findPrivyStellarWalletAddress(
  linkedAccounts: LinkedAccount[] | undefined,
): string | null {
  const stellarWallet = linkedAccounts?.find(
    (linkedAccount) =>
      linkedAccount.type === 'wallet' &&
      (linkedAccount.chainType === 'stellar' ||
        linkedAccount.chain_type === 'stellar') &&
      typeof linkedAccount.address === 'string',
  );

  return stellarWallet?.address ?? null;
}

export function useFinancialAuthorization(_userEmail?: string | null) {
  const { data: wallet } = useGetWallet();
  const { user } = useUser();
  const { signRawHash } = useSignRawHash();
  const createChallenge = useCreateFinancialAuthorizationChallenge();
  const verifyAuthorization = useVerifyFinancialAuthorization();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const authorize = useCallback(
    async (input: CreateFinancialAuthorizationInput): Promise<string> => {
      setIsAuthorizing(true);
      try {
        const privyWalletAddress =
          wallet?.walletType === 'privy_stellar'
            ? wallet.contractId
            : findPrivyStellarWalletAddress(
                user?.linkedAccounts as LinkedAccount[] | undefined,
              );

        if (!privyWalletAddress) {
          throw new Error('Privy Stellar wallet is required for financial authorization');
        }

        const challenge = await createChallenge.mutateAsync(input);
        const signature = await signRawHash({
          address: privyWalletAddress,
          chainType: 'stellar',
          hash: `0x${challenge.payloadHash}`,
        });
        const verifiedAuthorization = await verifyAuthorization.mutateAsync({
          authorizationId: challenge.authorizationId,
          payloadHash: challenge.payloadHash,
          assertion: {
            type: 'privy_raw_hash',
            address: privyWalletAddress,
            signature: signature.signature,
          },
        });

        return verifiedAuthorization.authorizationId;
      } finally {
        setIsAuthorizing(false);
      }
    },
    [createChallenge, signRawHash, user, verifyAuthorization, wallet],
  );

  return { authorize, isAuthorizing };
}

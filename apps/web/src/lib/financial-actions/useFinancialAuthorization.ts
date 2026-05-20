import { useCallback, useState } from 'react';
import { useGetWallet, useCreateWallet } from '@/lib/api/wallet';
import {
  type CreateFinancialAuthorizationInput,
  useCreateFinancialAuthorizationChallenge,
  useVerifyFinancialAuthorization,
} from '@/lib/api/financial-authorizations';
import {
  registerAndDeployWallet,
  signFinancialAuthorization,
} from '@/lib/wallet/passkey-client';

export function useFinancialAuthorization(userEmail?: string | null) {
  const { data: wallet, refetch } = useGetWallet();
  const createWallet = useCreateWallet();
  const createChallenge = useCreateFinancialAuthorizationChallenge();
  const verifyAuthorization = useVerifyFinancialAuthorization();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const authorize = useCallback(
    async (input: CreateFinancialAuthorizationInput): Promise<string> => {
      if (!userEmail) {
        throw new Error('User email is required for wallet setup');
      }

      setIsAuthorizing(true);
      try {
        let currentWallet = wallet;
        if (!currentWallet || currentWallet.walletType !== 'smart_account') {
          const createdWallet = await registerAndDeployWallet(userEmail);
          await createWallet.mutateAsync(createdWallet);
          const refreshedWallet = await refetch();
          currentWallet = refreshedWallet.data;
        }

        const challenge = await createChallenge.mutateAsync(input);
        const assertion = await signFinancialAuthorization(
          challenge.payloadHash,
          currentWallet?.passkeyId,
        );
        const verifiedAuthorization = await verifyAuthorization.mutateAsync({
          authorizationId: challenge.authorizationId,
          payloadHash: challenge.payloadHash,
          assertion,
        });

        return verifiedAuthorization.authorizationId;
      } finally {
        setIsAuthorizing(false);
      }
    },
    [createChallenge, createWallet, refetch, userEmail, verifyAuthorization, wallet],
  );

  return { authorize, isAuthorizing };
}

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
      setIsAuthorizing(true);
      try {
        let currentWallet = wallet;
        let currentPasskeyId = currentWallet?.passkeyId;
        if (!currentWallet || currentWallet.walletType !== 'smart_account') {
          if (!userEmail) {
            throw new Error('User email is required for wallet setup');
          }

          const createdWallet = await registerAndDeployWallet(userEmail);
          currentPasskeyId = createdWallet.keyId;
          await createWallet.mutateAsync(createdWallet);
          const refreshedWallet = await refetch();
          currentWallet = refreshedWallet.data;
          currentPasskeyId = currentWallet?.passkeyId ?? currentPasskeyId;
        }

        if (!currentPasskeyId) {
          throw new Error('Passkey credential is required for financial authorization');
        }

        const challenge = await createChallenge.mutateAsync(input);
        const assertion = await signFinancialAuthorization(challenge.payloadHash, currentPasskeyId);
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

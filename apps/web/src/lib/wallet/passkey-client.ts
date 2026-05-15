import { PasskeyKit } from 'passkey-kit';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

export class PasskeyAbortedError extends Error {
  constructor() {
    super('Passkey registration cancelled by user');
    this.name = 'PasskeyAbortedError';
  }
}

function getNetworkPassphrase(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? MAINNET_PASSPHRASE
    : TESTNET_PASSPHRASE;
}

export async function registerAndDeployWallet(
  userEmail: string,
): Promise<{ contractId: string; keyId: string }> {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;
  const walletWasmHash = process.env.NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH;

  if (!rpcUrl || !walletWasmHash) {
    throw new Error(
      'Stellar env vars are not configured (NEXT_PUBLIC_STELLAR_RPC_URL, NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH)',
    );
  }

  const account = new PasskeyKit({
    rpcUrl,
    networkPassphrase: getNetworkPassphrase(),
    walletWasmHash,
  });

  let keyIdBase64: string;
  let contractId: string;
  let signedTxXdr: string;

  try {
    const result = await account.createWallet('CredBridge', userEmail);
    if (!result.signedTx) {
      throw new Error('passkey-kit did not return a signed transaction');
    }
    keyIdBase64 = result.keyIdBase64;
    contractId = result.contractId;
    // signedTx is a Transaction object; serialize to base64-encoded XDR envelope
    signedTxXdr = result.signedTx.toXDR();
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new PasskeyAbortedError();
    }
    throw err;
  }

  // Submit the signed transaction to Stellar RPC
  const sendResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: { transaction: signedTxXdr },
    }),
  });

  if (!sendResponse.ok) {
    throw new Error(`Stellar RPC error: ${sendResponse.status}`);
  }

  const sendResult = await sendResponse.json() as {
    result?: { hash?: string; status?: string };
    error?: unknown;
  };

  if (sendResult.error) {
    throw new Error(`Stellar transaction rejected: ${JSON.stringify(sendResult.error)}`);
  }

  const sendStatus = sendResult.result?.status;
  if (sendStatus === 'ERROR' || sendStatus === 'TRY_AGAIN_LATER') {
    throw new Error(`Stellar RPC rejected transaction: ${sendStatus}`);
  }

  const txHash = sendResult.result?.hash;
  if (!txHash) {
    throw new Error('Stellar RPC did not return a transaction hash');
  }

  // Poll until the transaction is confirmed on-chain
  const POLL_INTERVAL_MS = 2000;
  const POLL_TIMEOUT_MS = 30000;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let confirmed = false;

  while (Date.now() < deadline) {
    const pollResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getTransaction',
        params: { hash: txHash },
      }),
    });

    if (pollResponse.ok) {
      const pollResult = await pollResponse.json() as {
        result?: { status?: string };
        error?: unknown;
      };

      const status = pollResult.result?.status;
      if (status === 'SUCCESS') { confirmed = true; break; }
      if (status === 'FAILED') {
        throw new Error('Stellar wallet deployment transaction failed on-chain');
      }
      // NOT_FOUND or PENDING — wait and retry
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (!confirmed) {
    throw new Error('Stellar wallet deployment timed out after 30 seconds');
  }

  return { contractId, keyId: keyIdBase64 };
}

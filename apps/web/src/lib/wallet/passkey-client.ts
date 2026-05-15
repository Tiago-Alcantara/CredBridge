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
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL!;
  const walletWasmHash = process.env.NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH!;

  const account = new PasskeyKit({
    rpcUrl,
    networkPassphrase: getNetworkPassphrase(),
    walletWasmHash,
  });

  let keyIdBase64: string;
  let contractId: string;
  let signedTx: string;

  try {
    const result = await account.createWallet('CredBridge', userEmail);
    keyIdBase64 = result.keyIdBase64;
    contractId = result.contractId;
    // signedTx is a Transaction object; serialize to base64-encoded XDR envelope
    signedTx = result.signedTx.toXDR();
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new PasskeyAbortedError();
    }
    throw err;
  }

  // Submit the signed transaction to Stellar RPC
  const rpcResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: { transaction: signedTx },
    }),
  });

  if (!rpcResponse.ok) {
    throw new Error(`Stellar RPC error: ${rpcResponse.status}`);
  }

  const rpcResult = await rpcResponse.json() as { result?: { status?: string }; error?: unknown };
  if (rpcResult.error) {
    throw new Error(`Stellar transaction failed: ${JSON.stringify(rpcResult.error)}`);
  }

  return { contractId, keyId: keyIdBase64 };
}

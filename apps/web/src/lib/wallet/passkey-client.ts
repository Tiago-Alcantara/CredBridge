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

  const { PasskeyKit } = await import('passkey-kit');

  const account = new PasskeyKit({
    rpcUrl,
    networkPassphrase: getNetworkPassphrase(),
    walletWasmHash,
  });

  let createResult: Awaited<ReturnType<typeof account.createWallet>>;

  try {
    createResult = await account.createWallet('CredBridge', userEmail);
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new PasskeyAbortedError();
    }
    throw err;
  }

  if (!createResult.signedTx) {
    throw new Error('passkey-kit did not return a signed transaction');
  }

  const { keyIdBase64, contractId } = createResult;
  const rpc = account.rpc!;

  const sendResponse = await rpc.sendTransaction(createResult.signedTx);

  if (sendResponse.status === 'ERROR' || sendResponse.status === 'TRY_AGAIN_LATER') {
    throw new Error(`Stellar RPC rejected transaction: ${sendResponse.status}`);
  }

  const POLL_INTERVAL_MS = 2000;
  const deadline = Date.now() + 30_000;
  let confirmed = false;

  while (Date.now() < deadline) {
    const poll = await rpc.getTransaction(sendResponse.hash);
    if (poll.status === 'SUCCESS') { confirmed = true; break; }
    if (poll.status === 'FAILED') {
      throw new Error('Stellar wallet deployment transaction failed on-chain');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (!confirmed) {
    throw new Error('Stellar wallet deployment timed out after 30 seconds');
  }

  return { contractId, keyId: keyIdBase64 };
}

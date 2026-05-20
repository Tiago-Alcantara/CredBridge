const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const UNCOMPRESSED_P256_PUBLIC_KEY_SIZE = 65;
const UNCOMPRESSED_P256_PREFIX = 0x04;
const ATTESTATION_PUBLIC_KEY_PREFIX = new Uint8Array([
  0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
]);

interface RegistrationResponseFields {
  publicKey?: string;
  authenticatorData?: string;
  attestationObject?: string;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function base64urlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function readRegistrationResponse(rawResponse: unknown): RegistrationResponseFields {
  if (!isRecord(rawResponse) || !isRecord(rawResponse.response)) {
    throw new Error('passkey-kit did not return a registration response');
  }

  const response = rawResponse.response;
  return {
    publicKey: typeof response.publicKey === 'string' ? response.publicKey : undefined,
    authenticatorData: typeof response.authenticatorData === 'string'
      ? response.authenticatorData
      : undefined,
    attestationObject: typeof response.attestationObject === 'string'
      ? response.attestationObject
      : undefined,
  };
}

function isUncompressedP256PublicKey(publicKey: Uint8Array): boolean {
  return publicKey.length === UNCOMPRESSED_P256_PUBLIC_KEY_SIZE
    && publicKey[0] === UNCOMPRESSED_P256_PREFIX;
}

function sliceLastUncompressedPublicKey(bytes: Uint8Array): Uint8Array | null {
  const publicKey = bytes.slice(bytes.length - UNCOMPRESSED_P256_PUBLIC_KEY_SIZE);
  return isUncompressedP256PublicKey(publicKey) ? publicKey : null;
}

function readPublicKeyFromAuthenticatorData(authenticatorDataBase64url: string): Uint8Array | null {
  const authenticatorData = base64urlToBytes(authenticatorDataBase64url);
  if (authenticatorData.length < 132) {
    return null;
  }

  const credentialIdLength = (authenticatorData[53] << 8) | authenticatorData[54];
  const xStartIndex = 65 + credentialIdLength;
  const yStartIndex = 100 + credentialIdLength;
  const x = authenticatorData.slice(xStartIndex, xStartIndex + 32);
  const y = authenticatorData.slice(yStartIndex, yStartIndex + 32);

  if (x.length !== 32 || y.length !== 32) {
    return null;
  }

  const publicKey = new Uint8Array(UNCOMPRESSED_P256_PUBLIC_KEY_SIZE);
  publicKey[0] = UNCOMPRESSED_P256_PREFIX;
  publicKey.set(x, 1);
  publicKey.set(y, 33);

  return isUncompressedP256PublicKey(publicKey) ? publicKey : null;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    let matches = true;

    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return index;
    }
  }

  return -1;
}

function readPublicKeyFromAttestationObject(attestationObjectBase64url: string): Uint8Array | null {
  const attestationObject = base64urlToBytes(attestationObjectBase64url);
  const prefixStartIndex = indexOfBytes(attestationObject, ATTESTATION_PUBLIC_KEY_PREFIX);
  if (prefixStartIndex < 0) {
    return null;
  }

  const xStartIndex = prefixStartIndex + ATTESTATION_PUBLIC_KEY_PREFIX.length;
  const yStartIndex = xStartIndex + 35;
  const x = attestationObject.slice(xStartIndex, xStartIndex + 32);
  const y = attestationObject.slice(yStartIndex, yStartIndex + 32);

  if (x.length !== 32 || y.length !== 32) {
    return null;
  }

  const publicKey = new Uint8Array(UNCOMPRESSED_P256_PUBLIC_KEY_SIZE);
  publicKey[0] = UNCOMPRESSED_P256_PREFIX;
  publicKey.set(x, 1);
  publicKey.set(y, 33);

  return isUncompressedP256PublicKey(publicKey) ? publicKey : null;
}

function extractPublicKeyFromRegistrationResponse(rawResponse: unknown): string {
  const response = readRegistrationResponse(rawResponse);

  if (response.publicKey) {
    const directPublicKey = sliceLastUncompressedPublicKey(base64urlToBytes(response.publicKey));
    if (directPublicKey) {
      return bytesToBase64url(directPublicKey);
    }
  }

  if (response.authenticatorData) {
    const authenticatorDataPublicKey = readPublicKeyFromAuthenticatorData(response.authenticatorData);
    if (authenticatorDataPublicKey) {
      return bytesToBase64url(authenticatorDataPublicKey);
    }
  }

  if (response.attestationObject) {
    const attestationPublicKey = readPublicKeyFromAttestationObject(response.attestationObject);
    if (attestationPublicKey) {
      return bytesToBase64url(attestationPublicKey);
    }
  }

  throw new Error('passkey-kit did not return a usable public key');
}

export async function registerAndDeployWallet(
  userEmail: string,
): Promise<{ contractId: string; keyId: string; publicKey: string }> {
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

  const publicKey = extractPublicKeyFromRegistrationResponse(createResult.rawResponse);

  return { contractId, keyId: keyIdBase64, publicKey };
}

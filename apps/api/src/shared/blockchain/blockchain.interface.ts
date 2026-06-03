export interface TokenizeNfeInput {
  key: string;
  value: number;
  dueDate: Date;
  xmlHash: string | null;
  ownerUserId: string;
}

export interface PayPmeInput {
  pmeUserId: string;
  amountBrl: number;
  memo: string;
}

export interface TransferNftToInvestorInput {
  receivableKey: string;
  investorUserId: string;
}

export interface ChargeInvestorInput {
  investorUserId: string;
  amountBrl: number;
  memo: string;
}

export interface BuyTokenizedInvoiceInput {
  sellerAddress: string;
  invoiceKey: string;
  xmlHash: string;
  value: number;
}

export interface UnsignedSorobanTx {
  /** Base64 transaction envelope XDR, simulated + assembled, unsigned. */
  xdr: string;
  /** Hex-encoded 32-byte transaction hash the wallet must sign. */
  hashToSign: string;
  /** Stellar public key (G...) expected to provide the signature. */
  signerPublicKey: string;
}

export interface Scaled {
  /** Valor bruto em stroops (menor unidade do token), como string para preservar precisão. */
  raw: string;
  /** Valor já convertido para a unidade humana (raw / 10**decimals). */
  value: number;
}

export interface PoolStatus {
  poolContractId: string;
  brltTokenId: string;
  shareTokenId: string;
  admin: string;
  operator: string;
  paused: boolean;
  brltDecimals: number;
  shareDecimals: number;
  nav: Scaled;
  cashBalance: Scaled;
  totalPrincipal: Scaled;
  totalShares: Scaled;
  /** Preço da cota em BRLT por cota (raw escalado por 1e9). */
  sharePrice: { raw: string; value: number };
}

export interface InvestorShares {
  address: string;
  shares: Scaled;
  estimatedValueBrl: number;
}

export interface BlockchainService {
  registerProof(hash: string): Promise<string>;
  tokenizeNfe(data: TokenizeNfeInput): Promise<string>;
  payPme(data: PayPmeInput): Promise<string>;
  transferNftToInvestor(data: TransferNftToInvestorInput): Promise<string>;
  transferNftToPlatform(receivableKey: string): Promise<string>;
  chargeInvestor(data: ChargeInvestorInput): Promise<string>;
  settlePayment(data: {
    receivableId: string;
    amount: number;
    destination: string;
  }): Promise<string>;
  getTransactionStatus(
    txHash: string,
  ): Promise<'pending' | 'success' | 'failed'>;
  createCustodialWallet(googleId: string): Promise<string>;
  fundAccountFromPlatform(
    destination: string,
    startingBalance?: string,
  ): Promise<string | null>;
  prepareAssignment(
    receivableKey: string,
    pmeAddress: string,
  ): Promise<{ unsignedXdr: string; hashToSign: string }>;
  submitSignedAssignment(
    unsignedXdr: string,
    signatureHex: string,
    pmeAddress: string,
  ): Promise<string>;
  buyTokenizedInvoiceInPool(data: BuyTokenizedInvoiceInput): Promise<string>;
  mintBrlt(toAddress: string, amount: number): Promise<string>;
  /** Build the BRLT approve(investor -> pool) tx, source = investor Privy address. */
  buildApproveTx(investorAddress: string, amountBrl: number): Promise<UnsignedSorobanTx>;
  /** Build the Pool deposit(investor, amount) tx, source = investor Privy address. */
  buildDepositTx(investorAddress: string, amountBrl: number): Promise<UnsignedSorobanTx>;
  /** Attach a Privy ed25519 signature to an unsigned XDR and submit via RPC; resolves to the confirmed tx hash. */
  submitSignedTx(input: {
    xdr: string;
    signerPublicKey: string;
    signatureHex: string;
  }): Promise<string>;
  /** Lê o estado on-chain da liquidity pool (read-only, via simulação). */
  getPoolStatus(): Promise<PoolStatus>;
  /** Lê o saldo de cotas (share token) de um endereço Stellar. */
  getInvestorShares(address: string): Promise<InvestorShares>;
}

export const BLOCKCHAIN_SERVICE = Symbol('BLOCKCHAIN_SERVICE');

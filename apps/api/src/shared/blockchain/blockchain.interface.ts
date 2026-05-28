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
  fundAccountFromPlatform(
    destination: string,
    startingBalance?: string,
  ): Promise<string | null>;
  getNativeXlmBalance(walletAddress: string): Promise<number>;
  ensureAccountHasMinimumXlm(
    destination: string,
    minimumBalance?: string,
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
}

export const BLOCKCHAIN_SERVICE = Symbol('BLOCKCHAIN_SERVICE');

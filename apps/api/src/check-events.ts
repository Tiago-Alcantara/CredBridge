import { rpc } from '@stellar/stellar-sdk';

async function main() {
  const server = new rpc.Server('https://soroban-testnet.stellar.org');
  const txHash = 'fb60d3a44e8641b8c1071fa3652b9ed4fa3a58babfbd816dd410d57843a41268';
  
  console.log(`Fetching events for transaction: ${txHash}...`);
  const result = (await server.getTransaction(txHash)) as any;
  console.log('Status:', result.status);
  console.log('resultXdr toJSON:', JSON.stringify(result.resultXdr, null, 2));
}

main().catch(console.error);

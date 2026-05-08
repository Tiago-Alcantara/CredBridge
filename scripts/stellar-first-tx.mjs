/**
 * First Stellar Testnet Transaction
 *
 * Flow:
 *   1. Generate two keypairs (Alice = sender, Bob = receiver)
 *   2. Fund Alice via Friendbot (10 000 XLM testnet)
 *   3. CreateAccount: Alice → Bob (100 XLM starting balance)
 *   4. Sign + submit via Stellar RPC
 *   5. Print hash + Stellar Expert link as proof
 */

import {Keypair, Networks, TransactionBuilder, BASE_FEE, Operation, Horizon,} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";

async function fundViaFriendbot(publicKey) {
  const url = `${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Friendbot failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data;
}

async function main() {
  console.log("=== Stellar Testnet — First Transaction ===\n");

  // 1. Generate keypairs
  const alice = Keypair.random();
  const bob = Keypair.random();

  console.log("Alice (sender)");
  console.log("  Public Key :", alice.publicKey());
  console.log("  Secret Key :", alice.secret());
  console.log("\nBob (receiver)");
  console.log("  Public Key :", bob.publicKey());
  console.log("  Secret Key :", bob.secret());
  console.log();

  // 2. Fund Alice via Friendbot
  console.log("Funding Alice via Friendbot...");
  const fbResult = await fundViaFriendbot(alice.publicKey());
  console.log("  Friendbot tx hash:", fbResult.hash ?? fbResult.id ?? "(see response)");
  console.log();

  // 3. Load Alice's account
  const server = new Horizon.Server(HORIZON_URL);
  const aliceAccount = await server.loadAccount(alice.publicKey());
  console.log("Alice account loaded. Sequence:", aliceAccount.sequenceNumber());

  // 4. Build CreateAccount transaction (Alice → Bob, 100 XLM)
  const tx = new TransactionBuilder(aliceAccount, { fee: BASE_FEE,networkPassphrase: Networks.TESTNET,}).addOperation(Operation.createAccount({destination: bob.publicKey(),startingBalance: "100",})).setTimeout(30).build();


  // 5. Sign
  tx.sign(alice);
  console.log("Transaction XDR (signed):");
  console.log(" ", tx.toXDR());
  console.log();

  // 6. Submit
  console.log("Submitting...");
  const result = await server.submitTransaction(tx);

  console.log("\n=== SUCCESS ===");
  console.log("Hash   :", result.hash);
  console.log("Ledger :", result.ledger);
  console.log("Link   :", `${EXPLORER_BASE}/${result.hash}`);
}

main().catch((err) => {
  console.error("\nERROR:", err?.response?.data ?? err.message ?? err);
  process.exit(1);
});

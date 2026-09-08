import { checkTradeIntent } from "./policy.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("PASS:", message);
  }
}

const r1 = checkTradeIntent("BTCUSDT", "BUY", 30);
assert(r1.allowed === true, "trade within per-transaction and daily limit is allowed");

const r2 = checkTradeIntent("BTCUSDT", "BUY", 100);
assert(r2.allowed === false, "trade exceeding per-transaction limit is denied");
assert(r2.reason.includes("per_transaction_limit_exceeded"), "denial reason mentions per-transaction limit");

const r3 = checkTradeIntent("ETHUSDT", "BUY", 45);
assert(r3.allowed === true, "second trade still within daily limit is allowed (cumulative 75)");

const r4 = checkTradeIntent("ETHUSDT", "BUY", 45);
assert(r4.allowed === true, "third trade still within daily limit is allowed (cumulative 120)");

const r5 = checkTradeIntent("BTCUSDT", "SELL", 45);
assert(r5.allowed === true, "fourth trade still within daily limit is allowed (cumulative 165)");

const r6 = checkTradeIntent("BTCUSDT", "BUY", 40);
assert(r6.allowed === false, "fifth trade pushing projected total over daily limit is denied (165+40=205)");
assert(r6.reason.includes("daily_limit_exceeded"), "denial reason mentions daily limit");

const r7 = checkTradeIntent(null, "BUY", 10);
assert(r7.allowed === false, "missing symbol is denied as invalid intent");

console.log("Done.");

import { checkPaymentIntent } from "./policy.js";

const p1 = checkPaymentIntent("https://api.example.com/premium-data", 20);
assert(p1.allowed === true, "payment within limits is allowed");

const p2 = checkPaymentIntent("https://api.example.com/premium-data", 100);
assert(p2.allowed === false, "payment exceeding per-transaction limit is denied");
assert(p2.reason.includes("per_transaction_limit_exceeded"), "payment denial reason mentions per-transaction limit");

console.log("Payment tests done.");

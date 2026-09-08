import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEND_LOG_FILE = path.join(__dirname, "spend-log.json");

const PER_TRANSACTION_MAX_USD = 50;
const DAILY_MAX_USD = 200;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const CAST = path.join(process.env.HOME, ".foundry", "bin", "cast");
const TRADE_LOG_ADDRESS = "0x86b8ED1803c99768D67a81ed1d1a1F9f8f517269";

function readSpendLog() {
  if (!fs.existsSync(SPEND_LOG_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(SPEND_LOG_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function writeSpendLog(entries) {
  fs.writeFileSync(SPEND_LOG_FILE, JSON.stringify(entries, null, 2));
}

function getCumulativeSpendUsd() {
  const entries = readSpendLog();
  const cutoff = Date.now() - WINDOW_MS;
  return entries
    .filter((e) => e.timestamp >= cutoff)
    .reduce((sum, e) => sum + e.usdValue, 0);
}

function recordSpend(usdValue) {
  const entries = readSpendLog();
  entries.push({ timestamp: Date.now(), usdValue });
  writeSpendLog(entries);
}

function recordOnChain(verdict, label, action, usdValue, detail) {
  if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
    return { skipped: true, reason: "PRIVATE_KEY or RPC_URL not set" };
  }
  try {
    const result = execFileSync(
      CAST,
      [
        "send",
        TRADE_LOG_ADDRESS,
        "logDecision(string,string,string,string,string)",
        verdict,
        label,
        action,
        String(usdValue),
        detail,
        "--private-key",
        process.env.PRIVATE_KEY,
        "--rpc-url",
        process.env.RPC_URL,
      ],
      { encoding: "utf-8" }
    );
    return { skipped: false, output: result };
  } catch (e) {
    return { skipped: false, error: e.message };
  }
}

function checkSpendIntent(label, action, usdValue) {
  if (!label || !action || typeof usdValue !== "number" || usdValue <= 0) {
    const onChain = recordOnChain("DENIED", String(label), String(action), usdValue || 0, "invalid_intent");
    return { allowed: false, reason: "invalid_intent", onChain };
  }

  if (usdValue > PER_TRANSACTION_MAX_USD) {
    const reason = `per_transaction_limit_exceeded: $${usdValue} exceeds max $${PER_TRANSACTION_MAX_USD}`;
    const onChain = recordOnChain("DENIED", label, action, usdValue, reason);
    return { allowed: false, reason, onChain };
  }

  const cumulative = getCumulativeSpendUsd();
  const projected = cumulative + usdValue;

  if (projected > DAILY_MAX_USD) {
    const reason = `daily_limit_exceeded: projected total $${projected.toFixed(2)} exceeds max $${DAILY_MAX_USD}`;
    const onChain = recordOnChain("DENIED", label, action, usdValue, reason);
    return { allowed: false, reason, onChain };
  }

  recordSpend(usdValue);
  const reason = `within limits: $${usdValue} (daily total now $${projected.toFixed(2)} / $${DAILY_MAX_USD})`;
  const onChain = recordOnChain("ALLOWED", label, action, usdValue, reason);

  return { allowed: true, reason, onChain };
}

export function checkTradeIntent(symbol, side, usdValue) {
  return checkSpendIntent(symbol, side, usdValue);
}

export function checkPaymentIntent(resourceUrl, usdValue) {
  return checkSpendIntent(resourceUrl, "PAY", usdValue);
}

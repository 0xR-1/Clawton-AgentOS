import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkTradeIntent, checkPaymentIntent } from "./policy.js";

const server = new McpServer({
  name: "clawton-agentos",
  version: "1.0.0",
});

server.registerTool(
  "check_trade_intent",
  {
    title: "Check Trade Intent Against Policy",
    description:
      "Evaluates a proposed Binance trade against a per-transaction spend cap and a rolling daily cumulative spend cap before it is forwarded to the official Binance MCP server for execution. Call this BEFORE calling any Binance MCP trading tool.",
    inputSchema: {
      symbol: z.string().describe("Trading pair symbol, e.g. BTCUSDT"),
      side: z.enum(["BUY", "SELL"]).describe("Trade side"),
      usdValue: z.number().describe("Estimated USD value of the trade"),
    },
  },
  async ({ symbol, side, usdValue }) => {
    const result = checkTradeIntent(symbol, side, usdValue);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.allowed,
    };
  }
);

server.registerTool(
  "check_payment_intent",
  {
    title: "Check x402 Payment Intent Against Policy",
    description:
      "Evaluates a proposed x402 protocol payment against a per-transaction spend cap and a rolling daily cumulative spend cap, shared with trade intents. Call this BEFORE signing or sending any x402 payment.",
    inputSchema: {
      resourceUrl: z.string().describe("The x402-protected resource URL being paid for"),
      usdValue: z.number().describe("Estimated USD value of the payment"),
    },
  },
  async ({ resourceUrl, usdValue }) => {
    const result = checkPaymentIntent(resourceUrl, usdValue);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.allowed,
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

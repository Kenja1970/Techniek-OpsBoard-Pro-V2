// Regression test for the agent proxy's tolerant model-JSON parser.
//
// Why this exists: `response_format: {type:"json_object"}` is a request, not a
// guarantee. Anthropic models via OpenRouter intermittently wrapped the object
// in a ```json fence, JSON.parse threw, and a perfectly good answer was thrown
// away as a failure — roughly one call in four in live testing.
//
// The parser may only ever RECOVER an object the model actually sent. It must
// never manufacture one, and must never pass off part of some other structure
// as the contract object — the client validates every action it contains, but
// it should not be handed garbage in the first place.
//
// Run: node tests/agent-proxy-parse.test.mjs   (exit 0 = pass)

import { parseModelJson } from "../server/agent-proxy.mjs";

const OBJ = '{"narrative":"ok","actions":[]}';

const cases = [
  // --- shapes that MUST be recovered ---
  ["plain object", OBJ, true],
  ["```json fence (the live bug)", "```json\n" + OBJ + "\n```", true],
  ["bare ``` fence", "```\n" + OBJ + "\n```", true],
  ["fence with CRLF line endings", "```json\r\n" + OBJ + "\r\n```", true],
  ["leading prose then object", "Here you go:\n" + OBJ, true],
  ["object then trailing prose", OBJ + "\nHope that helps.", true],
  ["surrounding whitespace", "\n\n  " + OBJ + "  \n", true],

  // --- shapes that MUST be rejected ---
  ["empty string", "", false],
  ["whitespace only", "   \n  ", false],
  ["pure prose, no JSON", "I cannot answer that.", false],
  ["JSON array, not our contract", '[{"op":"move","cardId":"k1"}]', false],
  ["fenced array", "```json\n" + '[{"op":"move"}]' + "\n```", false],
  ["bare quoted string", '"just a string"', false],
  ["bare number", "42", false],
  ["null", "null", false],
  ["truncated object", '{"narrative":"ok","acti', false],
];

let pass = 0;
const failures = [];

for (const [name, input, shouldParse] of cases) {
  const result = parseModelJson(input);
  const got = !!result.parsed;
  if (got === shouldParse) {
    pass++;
  } else {
    failures.push(`${name}: expected parsed=${shouldParse}, got ${got}`);
  }
}

// Content fidelity: recovery must preserve the payload, not just parse.
const fenced = parseModelJson("```json\n" + '{"narrative":"hello","actions":[{"op":"move"}]}' + "\n```");
if (fenced.parsed?.narrative === "hello" && fenced.parsed?.actions?.length === 1) pass++;
else failures.push("fenced payload was not preserved intact");

// A rejected parse must explain itself, so the UI can surface a real reason.
const rejected = parseModelJson("I cannot answer that.");
if (rejected.parseError && rejected.parseError.length > 0) pass++;
else failures.push("rejected parse returned no parseError");

const total = cases.length + 2;
for (const f of failures) console.error("  FAIL  " + f);
console.log(`${pass}/${total} agent-proxy parser checks pass`);
process.exit(failures.length === 0 ? 0 : 1);

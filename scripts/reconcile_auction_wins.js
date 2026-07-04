// One-time data correction: resets each member's auction_wins to match
// the actual count of "Auction Win" entries in their own tx_log.
//
// Root cause: a historical duplicate-win-processing bug (fixed later by
// adding the auction_win_claims cross-session lock) let the same auction
// close event get processed by more than one racing browser tab before
// that lock existed. Each duplicate bumped auction_wins up independently,
// compounding the stored number over time, while tx_log — being appended
// to from each tab's own local snapshot — didn't necessarily grow the
// same way. The number and the log diverged well before the more recent
// atomic-increment fix (increment_auction_win), which only prevents new
// instances of a narrower version of this race going forward. It cannot
// retroactively fix numbers that were already wrong.
//
// tx_log is treated as the source of truth here since it's the same
// itemized record a player's own activity history is built from.
//
// Usage:
//   node scripts/reconcile_auction_wins.js          (dry run — prints the plan, writes nothing)
//   node scripts/reconcile_auction_wins.js --apply  (writes the corrected auction_wins to Supabase)
//
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (same
// credentials the app itself already uses to write to the members table).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
const envText = fs.readFileSync(envPath, "utf8");
function getEnvVar(name) {
  const line = envText.split("\n").find(l => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in .env`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
}

const SUPA_URL = getEnvVar("VITE_SUPABASE_URL");
const SUPA_KEY = getEnvVar("VITE_SUPABASE_ANON_KEY");
const APPLY = process.argv.includes("--apply");

async function main() {
  const res = await fetch(`${SUPA_URL}/rest/v1/members?select=id,name,auction_wins,tx_log`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`Failed to load members: HTTP ${res.status}`);
  const members = await res.json();

  const changes = [];
  for (const m of members) {
    let txLog = [];
    try { txLog = typeof m.tx_log === "string" ? JSON.parse(m.tx_log) : (m.tx_log || []); } catch {}
    const trueWins = txLog.filter(e => e.logType === "Auction Win").length;
    const stored = m.auction_wins || 0;
    if (stored !== trueWins) changes.push({ id: m.id, name: m.name, from: stored, to: trueWins });
  }

  changes.sort((a, b) => b.from - a.from);
  console.log(`${changes.length} of ${members.length} members need correction:\n`);
  for (const c of changes) console.log(`  ${c.name}: ${c.from} -> ${c.to}`);

  if (!APPLY) {
    console.log("\nDry run only — no writes made. Re-run with --apply to write these changes.");
    return;
  }

  console.log("\nApplying...");
  let ok = 0, failed = 0;
  for (const c of changes) {
    const r = await fetch(`${SUPA_URL}/rest/v1/members?id=eq.${encodeURIComponent(c.id)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ auction_wins: c.to }),
    });
    if (r.ok) { ok++; } else { failed++; console.error(`  FAILED ${c.name}: HTTP ${r.status}`); }
  }
  console.log(`\nDone: ${ok} updated, ${failed} failed.`);
}

main().catch(e => { console.error(e); process.exit(1); });

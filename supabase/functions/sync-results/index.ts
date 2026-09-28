import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Source of truth for the deployed `sync-results` edge function (v9 was only
// on Supabase until 2026-09-28). Deploy: supabase functions deploy sync-results

// ============================================
// Scoring constants — duplicated from src/core/types.ts
// Keep in sync with the app-side constants!
// ============================================
const BRACKET_ESCALATING = {
  WINNER_BONUS: 50,
} as const;

const WEEKLY_SCORING = {
  CORRECT_VOTE_OUT: 10,
  CORRECT_IMMUNITY: 10,
} as const;

// ============================================
// Scoring functions — duplicated from src/core/scoring.ts
// Keep in sync with the app-side functions!
// ============================================
function scoreWeeklyPick(
  pickedEliminatedId: number | null,
  pickedImmunityId: number | null,
  actualEliminatedId: number | null,
  actualImmunityId: number | null
): number {
  let points = 0;
  if (actualEliminatedId !== null && pickedEliminatedId === actualEliminatedId) {
    points += WEEKLY_SCORING.CORRECT_VOTE_OUT;
  }
  if (actualImmunityId !== null && pickedImmunityId === actualImmunityId) {
    points += WEEKLY_SCORING.CORRECT_IMMUNITY;
  }
  return points;
}

// ============================================
// Wiki parsing
// ============================================
const WIKI_API = "https://survivor.fandom.com/api.php";

interface ParsedEpisode {
  number: number;
  eliminatedNames: string[];
  immunityWinnerName: string | null;
  voteDetail: string | null;
}

interface ParsedSeason {
  episodes: ParsedEpisode[];
  /** Name from the finale's "Sole Survivor" row, once the jury vote is posted. */
  winnerName: string | null;
}

async function fetchWikiHtml(seasonNumber: number): Promise<string> {
  const templatePage = `Template:S${seasonNumber}epguide`;
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(templatePage)}&prop=text&format=json&formatversion=2`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Wiki API returned ${resp.status}: ${resp.statusText}`);
  }
  const json = await resp.json();
  if (json.error) {
    throw new Error(`Wiki API error: ${json.error.info}`);
  }
  return json.parse.text;
}

// Names that indicate no result yet — skip these
const PLACEHOLDER_NAMES = /^(tbd|none|n\/a|tba)$/i;

/**
 * Names in an "Eliminated" cell. Handles the formats the wiki actually uses:
 * "Aaliyah(6-2)", "Q(5-1)", "Tiffany(4-1)3" (footnote), "Kyle2" (no vote),
 * and joint boots like "Chrissy& Coach(10-1-1)5" (S50 Double Duo).
 */
function namesFromCell(raw: string): string[] {
  const beforeVote = raw.split("(")[0].replace(/\d+$/, "").trim();
  return beforeVote
    .split(/\s*(?:&|,|\band\b)\s*/)
    .map((n) => n.trim())
    .filter((n) => /^[A-Za-z][A-Za-z .'-]*$/.test(n) && !PLACEHOLDER_NAMES.test(n));
}

/**
 * Parse the episode guide table using a 2D grid approach.
 *
 * The wiki table uses complex rowspan/colspan (e.g., Episode header is
 * colspan=2 rowspan=2, each episode spans 5 data rows via rowspan=5).
 * A simple cell-index approach breaks because physical cell counts
 * vary per row. Instead we:
 *   1. Build a full grid[row][col] resolving ALL rowspan/colspan
 *   2. Scan header rows in the grid to find column indices
 *   3. Read data rows from the grid, deduplicating rowspan repeats
 */
function parseEpisodeTable(html: string): ParsedSeason {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse HTML");

  const table = doc.querySelector("table.wikitable");
  if (!table) throw new Error("No wikitable found in HTML");

  const rows = table.querySelectorAll("tr");
  if (rows.length === 0) throw new Error("No rows in table");

  // ── Step 1: Build 2D grid resolving all rowspan/colspan ──
  const occupied = new Map<string, string>();
  const grid: string[][] = [];

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].querySelectorAll("th, td");
    grid[r] = [];
    let cellIdx = 0;
    let c = 0;

    while (cellIdx < cells.length) {
      while (occupied.has(`${r},${c}`)) {
        grid[r][c] = occupied.get(`${r},${c}`)!;
        c++;
      }

      const cell = cells[cellIdx];
      const text = (cell.textContent || "").trim();
      const rowspan = parseInt(cell.getAttribute("rowspan") || "1");
      const colspan = parseInt(cell.getAttribute("colspan") || "1");

      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (dr === 0 && dc === 0) {
            grid[r][c] = text;
          } else {
            occupied.set(`${r + dr},${c + dc}`, text);
          }
        }
      }

      c += colspan;
      cellIdx++;
    }

    while (occupied.has(`${r},${c}`)) {
      grid[r][c] = occupied.get(`${r},${c}`)!;
      c++;
    }
  }

  // ── Step 2: Find column indices from header rows ──
  let eliminatedColIdx = -1;
  let immunityColIdx = -1;
  const episodeColIdx = 0;

  for (let r = 0; r < Math.min(3, grid.length); r++) {
    for (let c = 0; c < (grid[r]?.length || 0); c++) {
      const text = (grid[r][c] || "").toLowerCase();
      if (
        eliminatedColIdx === -1 &&
        (text.includes("eliminated") || text.includes("voted out"))
      ) {
        eliminatedColIdx = c;
      }
      if (
        immunityColIdx === -1 &&
        text.includes("immunity") &&
        !text.includes("reward")
      ) {
        immunityColIdx = c;
      }
    }
  }

  // A silent fallback to guessed columns could score the wrong people.
  if (eliminatedColIdx === -1 || immunityColIdx === -1) {
    throw new Error(
      `Could not find table columns (eliminated=${eliminatedColIdx}, immunity=${immunityColIdx}) — wiki layout changed?`,
    );
  }

  // ── Step 3: Extract episode data from grid rows ──
  const results: ParsedEpisode[] = [];
  const processedRows = new Set<string>();
  let winnerName: string | null = null;

  for (let r = 2; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length === 0) continue;

    // Finale jury rows ("Joe(8-3-0) | Second Runner-Up", "Aubry(8-3-0) |
    // Sole Survivor") sit inside the finale's episode rowspan. Finalists were
    // NOT eliminated — never score these rows; just capture the winner.
    if (row.some((cell) => /runner-up|sole survivor/i.test(cell || ""))) {
      if (row.some((cell) => /^sole survivor$/i.test((cell || "").trim()))) {
        const [name] = namesFromCell((row[eliminatedColIdx] || "").replace(/\s+/g, " ").trim());
        if (name) winnerName = name;
      }
      continue;
    }

    const epText = row[episodeColIdx] || "";
    const epMatch = epText.match(/(\d+)/);
    if (!epMatch) continue;
    const epNumber = parseInt(epMatch[1]);

    const elimRaw = (row[eliminatedColIdx] || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!elimRaw || PLACEHOLDER_NAMES.test(elimRaw)) continue;

    const dedupeKey = `${epNumber}:${elimRaw}`;
    if (processedRows.has(dedupeKey)) continue;
    processedRows.add(dedupeKey);

    const eliminatedNames = namesFromCell(elimRaw);
    if (eliminatedNames.length === 0) continue;

    const voteMatch = elimRaw.match(/\(([^)]+)\)/);
    const voteDetail = voteMatch ? voteMatch[1] : null;

    const immText = (row[immunityColIdx] || "")
      .replace(/\s+/g, " ")
      .trim();
    let immunityWinnerName: string | null = null;
    if (immText && !PLACEHOLDER_NAMES.test(immText)) {
      immunityWinnerName = immText;
    }

    // Handle double tribal (same episode number, different eliminated)
    const existing = results.find((ep) => ep.number === epNumber);
    if (existing) {
      existing.eliminatedNames.push(...eliminatedNames);
    } else {
      results.push({
        number: epNumber,
        eliminatedNames,
        immunityWinnerName,
        voteDetail,
      });
    }
  }

  return { episodes: results, winnerName };
}

// ============================================
// SHA-256 hash for idempotency
// ============================================
async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================
// Bracket scoring: Escalating Survival
// ============================================
interface CastawayRecord {
  id: number;
  is_eliminated: boolean;
  elimination_episode: number | null;
  elimination_order: number | null;
}

interface BracketPick {
  id: number;
  user_id: string;
  castaway_id: number;
  predicted_position: number;
}

/**
 * Idempotent: recomputes and upserts every member's score for one episode,
 * so re-running it (e.g. once the winner is known) is safe.
 */
async function scoreBracketLeaguesForEpisode(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  seasonId: number,
  episodeNumber: number,
  allCastaways: CastawayRecord[],
  winnerId: number | null,
  isFinaleEpisode: boolean,
  errors: string[],
): Promise<number> {
  let scoresWritten = 0;

  // "Still in" = not eliminated, or eliminated after this episode
  const actualStillInIds = new Set<number>(
    allCastaways
      .filter(
        (c) =>
          !c.is_eliminated ||
          (c.elimination_episode !== null && c.elimination_episode > episodeNumber)
      )
      .map((c) => c.id)
  );

  const totalElims = allCastaways.filter(
    (c) =>
      c.is_eliminated &&
      c.elimination_episode !== null &&
      c.elimination_episode <= episodeNumber
  ).length;

  const totalCastaways = allCastaways.length;

  const { data: leagues, error: leaguesErr } = await supabase
    .from("leagues")
    .select("id, start_episode")
    .eq("season_id", seasonId)
    .eq("game_type", "bracket");

  if (leaguesErr) {
    errors.push(`Bracket scoring: failed to fetch leagues — ${leaguesErr.message}`);
    return 0;
  }

  for (const league of leagues ?? []) {
    if (episodeNumber < league.start_episode) continue;

    const { data: members, error: membersErr } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id);

    if (membersErr) {
      errors.push(`Bracket scoring league ${league.id}: failed to fetch members — ${membersErr.message}`);
      continue;
    }

    const { data: allPicks, error: picksErr } = await supabase
      .from("bracket_picks")
      .select("id, user_id, castaway_id, predicted_position")
      .eq("league_id", league.id);

    if (picksErr) {
      errors.push(`Bracket scoring league ${league.id}: failed to fetch picks — ${picksErr.message}`);
      continue;
    }

    const scoreRows: {
      league_id: string;
      user_id: string;
      episode_number: number;
      episode_score: number;
    }[] = [];

    for (const member of members ?? []) {
      const userPicks: BracketPick[] =
        (allPicks ?? []).filter(
          (p: BracketPick) => p.user_id === member.user_id
        );

      if (userPicks.length === 0) continue;

      let correct = 0;
      for (const pick of userPicks) {
        if (
          pick.predicted_position > totalElims &&
          actualStillInIds.has(pick.castaway_id)
        ) {
          correct++;
        }
      }
      let episodeScore = episodeNumber * correct;

      if (isFinaleEpisode && winnerId !== null) {
        const winnerPick = userPicks.find(
          (p) =>
            p.castaway_id === winnerId &&
            p.predicted_position === totalCastaways
        );
        if (winnerPick) {
          episodeScore += BRACKET_ESCALATING.WINNER_BONUS;
        }
      }

      scoreRows.push({
        league_id: league.id,
        user_id: member.user_id,
        episode_number: episodeNumber,
        episode_score: episodeScore,
      });
    }

    if (scoreRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("bracket_episode_scores")
        .upsert(scoreRows, {
          onConflict: "league_id,user_id,episode_number",
        });
      if (upsertErr) {
        errors.push(`Bracket scoring league ${league.id}: upsert failed — ${upsertErr.message}`);
      } else {
        scoresWritten += scoreRows.length;
      }
    }
  }

  return scoresWritten;
}

// ============================================
// Main handler
// ============================================
Deno.serve(async (req: Request) => {
  // --- AUTH ---
  // Set ADMIN_SECRET (supabase secrets set ADMIN_SECRET=...) to close this
  // endpoint; until then anyone can trigger a sync ("dev" mode).
  const adminSecret = Deno.env.get("ADMIN_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  let triggerSource = "unknown";
  if (adminSecret && token === adminSecret) {
    triggerSource = "manual";
  } else if (token === serviceRoleKey) {
    triggerSource = "cron";
  } else if (!adminSecret) {
    triggerSource = "dev";
  } else {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const errors: string[] = [];
  let episodesUpdated = 0;
  let picksScored = 0;

  try {
    const { data: season, error: seasonErr } = await supabase
      .from("seasons")
      .select("id, number, winner_id")
      .eq("is_active", true)
      .single();

    if (seasonErr || !season) {
      return jsonResponse({ status: "no_active_season", message: "No active season found" });
    }

    let html: string;
    try {
      html = await fetchWikiHtml(season.number);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Wiki fetch failed: ${msg}`);
      await insertSyncLog(supabase, triggerSource, 0, 0, errors, null);
      return jsonResponse({ status: "wiki_fetch_failed", errors }, 502);
    }

    // --- Idempotency check ---
    const wikiHash = await hashContent(html);
    const { data: lastSync } = await supabase
      .from("sync_log")
      .select("wiki_hash")
      .order("ran_at", { ascending: false })
      .limit(1)
      .single();

    if (lastSync?.wiki_hash === wikiHash) {
      return jsonResponse({
        status: "no_change",
        message: "Wiki data unchanged since last sync",
        wiki_hash: wikiHash,
      });
    }

    let parsed: ParsedSeason;
    try {
      parsed = parseEpisodeTable(html);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Parse failed: ${msg}`);
      await insertSyncLog(supabase, triggerSource, 0, 0, errors, wikiHash);
      return jsonResponse({ status: "parse_failed", errors }, 500);
    }
    const parsedEpisodes = parsed.episodes;

    if (parsedEpisodes.length === 0) {
      await insertSyncLog(supabase, triggerSource, 0, 0, [], wikiHash);
      return jsonResponse({
        status: "no_results",
        message: "No episode results found in wiki (season may not have started)",
        wiki_hash: wikiHash,
      });
    }

    // --- Load name aliases (with collision detection) ---
    const { data: castawayRows } = await supabase
      .from("castaways")
      .select("id")
      .eq("season_id", season.id);

    const { data: aliases } = await supabase
      .from("name_aliases")
      .select("castaway_id, alias")
      .in("castaway_id", (castawayRows || []).map((c: { id: number }) => c.id));

    const aliasMap = new Map<string, number>();
    const ambiguousAliases = new Set<string>();
    for (const a of aliases || []) {
      const key = a.alias.toLowerCase();
      if (aliasMap.has(key) && aliasMap.get(key) !== a.castaway_id) {
        errors.push(
          `ALIAS COLLISION: "${a.alias}" maps to castaway ${aliasMap.get(key)} AND ${a.castaway_id}. ` +
          `Add disambiguated aliases (e.g., last name or initial) for these castaways.`
        );
        ambiguousAliases.add(key);
        aliasMap.delete(key);
      } else if (!ambiguousAliases.has(key)) {
        aliasMap.set(key, a.castaway_id);
      }
    }

    // --- Load episodes ---
    const { data: dbEpisodes } = await supabase
      .from("episodes")
      .select("id, number, is_scored")
      .eq("season_id", season.id)
      .order("number");

    const episodeMap = new Map<number, { id: number; is_scored: boolean }>();
    for (const ep of dbEpisodes || []) {
      episodeMap.set(ep.number, { id: ep.id, is_scored: ep.is_scored });
    }

    const maxEpisodeNumber = Math.max(...Array.from(episodeMap.keys()));

    // --- Sole Survivor ---
    // Record the winner as soon as the wiki posts the jury vote. If the finale
    // was already scored without it (the S50 bug), its bracket scores are
    // re-run below so the +50 bonus lands.
    let winnerId: number | null = season.winner_id ?? null;
    let rescoreFinaleForWinner = false;
    if (winnerId === null && parsed.winnerName) {
      const resolved = aliasMap.get(parsed.winnerName.toLowerCase()) ?? null;
      if (resolved === null) {
        errors.push(`Winner: could not resolve name "${parsed.winnerName}"`);
      } else {
        const { error: winErr } = await supabase
          .from("seasons")
          .update({ winner_id: resolved })
          .eq("id", season.id);
        if (winErr) {
          errors.push(`Winner: DB update failed — ${winErr.message}`);
        } else {
          winnerId = resolved;
          rescoreFinaleForWinner = episodeMap.get(maxEpisodeNumber)?.is_scored ?? false;
        }
      }
    }

    // --- Get current max elimination_order ---
    const { data: maxElim } = await supabase
      .from("castaways")
      .select("elimination_order")
      .eq("season_id", season.id)
      .not("elimination_order", "is", null)
      .order("elimination_order", { ascending: false })
      .limit(1)
      .single();

    let eliminationOrder = maxElim?.elimination_order || 0;

    const newlyScoredEpisodeNumbers: number[] = [];

    // --- Process each parsed episode ---
    for (const parsedEp of parsedEpisodes) {
      const dbEp = episodeMap.get(parsedEp.number);
      if (!dbEp) {
        errors.push(`Episode ${parsedEp.number}: not found in database`);
        continue;
      }
      if (dbEp.is_scored) continue;

      const eliminatedIds: number[] = [];
      for (const name of parsedEp.eliminatedNames) {
        const castawayId = aliasMap.get(name.toLowerCase());
        if (!castawayId) {
          errors.push(`Episode ${parsedEp.number}: could not resolve name "${name}"`);
          continue;
        }
        eliminatedIds.push(castawayId);
      }

      // Never score an episode with an unresolved elimination — a partial
      // result would let pool players who picked the missing person survive.
      if (eliminatedIds.length !== parsedEp.eliminatedNames.length) continue;
      if (eliminatedIds.length === 0) continue;

      let immunityWinnerId: number | null = null;
      if (parsedEp.immunityWinnerName) {
        immunityWinnerId = aliasMap.get(parsedEp.immunityWinnerName.toLowerCase()) || null;
      }

      const { error: epErr } = await supabase
        .from("episodes")
        .update({
          eliminated_id: eliminatedIds[0],
          immunity_winner_id: immunityWinnerId,
          is_scored: true,
        })
        .eq("id", dbEp.id);

      if (epErr) {
        errors.push(`Episode ${parsedEp.number}: DB update failed — ${epErr.message}`);
        continue;
      }

      episodesUpdated++;

      for (const cId of eliminatedIds) {
        eliminationOrder++;
        await supabase
          .from("castaways")
          .update({
            is_eliminated: true,
            elimination_episode: parsedEp.number,
            elimination_order: eliminationOrder,
          })
          .eq("id", cId);
      }

      for (const cId of eliminatedIds) {
        const actPos = eliminationOrder - eliminatedIds.length + eliminatedIds.indexOf(cId) + 1;
        await supabase
          .from("bracket_picks")
          .update({ actual_position: actPos })
          .eq("castaway_id", cId)
          .is("actual_position", null);
      }

      newlyScoredEpisodeNumbers.push(parsedEp.number);

      // --- SCORE SURVIVOR POOL ---
      const { data: poolPicks } = await supabase
        .from("survivor_pool_picks")
        .select("id, picked_castaway_id")
        .eq("episode_id", dbEp.id)
        .eq("is_alive", true);

      for (const pick of poolPicks || []) {
        if (eliminatedIds.includes(pick.picked_castaway_id)) {
          await supabase
            .from("survivor_pool_picks")
            .update({ is_alive: false })
            .eq("id", pick.id);
          picksScored++;
        }
      }

      // --- SCORE WEEKLY PICKS ---
      const { data: weeklyPicks } = await supabase
        .from("weekly_picks")
        .select("id, picked_eliminated_id, picked_immunity_id")
        .eq("episode_id", dbEp.id);

      for (const pick of weeklyPicks || []) {
        const points = scoreWeeklyPick(
          pick.picked_eliminated_id,
          pick.picked_immunity_id,
          eliminatedIds[0],
          immunityWinnerId
        );
        await supabase
          .from("weekly_picks")
          .update({ points })
          .eq("id", pick.id);
        picksScored++;
      }
    }

    // --- SCORE BRACKET LEAGUES (Escalating Survival) ---
    const bracketEpisodes = [...newlyScoredEpisodeNumbers];
    if (rescoreFinaleForWinner && !bracketEpisodes.includes(maxEpisodeNumber)) {
      bracketEpisodes.push(maxEpisodeNumber);
    }
    if (bracketEpisodes.length > 0) {
      const { data: allCastaways, error: castawayErr } = await supabase
        .from("castaways")
        .select("id, is_eliminated, elimination_episode, elimination_order")
        .eq("season_id", season.id);

      if (castawayErr || !allCastaways || allCastaways.length === 0) {
        errors.push(`Bracket scoring: failed to re-fetch castaways — ${castawayErr?.message ?? "empty result"}`);
      } else {
        for (const epNum of bracketEpisodes) {
          const isFinaleEpisode = epNum === maxEpisodeNumber;
          const bracketScores = await scoreBracketLeaguesForEpisode(
            supabase,
            season.id,
            epNum,
            allCastaways,
            winnerId,
            isFinaleEpisode,
            errors,
          );
          picksScored += bracketScores;
        }
      }
    }

    // With errors, skip the hash so the next run retries instead of "no_change".
    await insertSyncLog(
      supabase, triggerSource, episodesUpdated, picksScored, errors,
      errors.length > 0 ? null : wikiHash,
    );

    return jsonResponse({
      status: "success",
      episodes_updated: episodesUpdated,
      picks_scored: picksScored,
      winner_id: winnerId,
      errors: errors.length > 0 ? errors : undefined,
      wiki_hash: wikiHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Unexpected error: ${msg}`);
    try {
      await insertSyncLog(supabase, triggerSource, episodesUpdated, picksScored, errors, null);
    } catch (_) { /* best effort */ }
    return jsonResponse({ status: "error", errors }, 500);
  }
});

// ============================================
// Helpers
// ============================================
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
  });
}

async function insertSyncLog(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  triggerSource: string,
  episodesUpdated: number,
  picksScored: number,
  errors: string[],
  wikiHash: string | null
) {
  await supabase.from("sync_log").insert({
    trigger_source: triggerSource,
    episodes_updated: episodesUpdated,
    picks_scored: picksScored,
    errors: errors.length > 0 ? errors : null,
    wiki_hash: wikiHash,
  });
}

// Season 51 launch email — three versions, one per audience segment.
//
// Recipients come from a JSON export (see scripts/season51-recipients.sql):
//   [{ "email", "segment": "moved"|"returning"|"new", "leagues": [{name, code, game_type}] }]
//
// Usage (PowerShell):
//   $env:RESEND_API_KEY="..."
//   node scripts/send-announcement.mjs --recipients scripts/s51.recipients.json            # dry run
//   node scripts/send-announcement.mjs --test you@example.com --segment moved              # one sample
//   node scripts/send-announcement.mjs --recipients scripts/s51.recipients.json --send     # everyone
//   ...add --limit 100 on Resend's free plan (100/day); re-run daily to continue.
// scripts/.announcement-sent.json records who already got it, so re-runs never double-send.
//
// Prereqs: tribalpicks.com verified in Resend, and registered in Apple Developer >
// Services > "Sign in with Apple for Email Communication" (else the ~35% of users on
// @privaterelay.appleid.com addresses silently never receive it).

import { readFile, writeFile } from 'node:fs/promises';

const FROM = 'Tribal Picks <support@tribalpicks.com>';
const APP_STORE_URL = 'https://apps.apple.com/app/id6759391126';
const SENT_LOG = new URL('./.announcement-sent.json', import.meta.url);

const GAME_LABEL = { bracket: 'Elimination Bracket', survivor_pool: 'Survivor Pool' };

// ---------- Copy ----------

const START_STEPS = [
  'Open Tribal Picks and tap <b>Create League</b>',
  'Choose <b>Survivor Pool</b> or <b>Elimination Bracket</b>',
  'Share the invite code with your group',
];

const SEGMENTS = {
  moved: {
    subject: 'Your Tribal Picks league is ready for Season 51',
    preheader: 'Same league, same invite code. Make your Episode 2 picks before Wednesday.',
    heading: 'Your league is ready for Season 51.',
    intro:
      "Sorry we were late. If you set up a league for the new season and it looked stuck on last season, that was our bug, not you. <b>We've moved it over.</b>",
    boxTitle: (r) => (r.leagues.length === 1 ? 'YOUR LEAGUE' : 'YOUR LEAGUES'),
    boxLines: (r) =>
      r.leagues.map(
        (l) => `<b>${esc(l.name)}</b><br><span style="color:#5b5e70;">${GAME_LABEL[l.game_type] ?? 'League'} · invite code <b style="color:#1a1a2e;letter-spacing:1px;">${esc(l.code)}</b></span>`,
      ),
    numbered: false,
    body: [
      'Everything carried over: same members, same invite code. Episode 1 already aired, so your league starts at Episode 2. Make your picks before <b>Wednesday at 8&nbsp;PM&nbsp;ET</b>.',
      '<b>Still waiting on friends?</b> Send them your invite code so they can join before the lock.',
    ],
  },
  returning: {
    subject: 'Season 51 is live in Tribal Picks',
    preheader: "Start your Season 51 league before Wednesday's episode.",
    heading: 'Welcome back. Season 51 is live.',
    intro: "Sorry it took us a few extra days to get the new season ready. <b>It's here now.</b>",
    boxTitle: () => 'START YOUR SEASON 51 LEAGUE',
    boxLines: () => START_STEPS,
    numbered: true,
    body: [
      'Your Season 50 leagues and results are saved. Each league covers one season, so create a new one for 51 and send your group the new code.',
      "Episode 1 already aired, so new leagues start at Episode 2. Nobody's behind. Make your picks before <b>Wednesday at 8&nbsp;PM&nbsp;ET</b>.",
    ],
  },
  new: {
    subject: 'Season 51 is live in Tribal Picks (sorry we were late!)',
    preheader: "Start a league before Wednesday's episode. Nobody's behind.",
    heading: 'Survivor 51 is here, and so is Tribal Picks.',
    intro:
      "We're sorry we were late. If you downloaded the app after the premiere and couldn't start the new season, that's on us. <b>It's fixed now.</b>",
    boxTitle: () => 'START YOUR SEASON 51 LEAGUE',
    boxLines: () => START_STEPS,
    numbered: true,
    body: [
      "Episode 1 already aired, so every new league starts at Episode 2. Nobody's behind. Make your picks before <b>Wednesday at 8&nbsp;PM&nbsp;ET</b>.",
    ],
  },
};

// ---------- Rendering ----------

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const stripTags = (html) =>
  html.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

// Table layout + inline styles: the only thing Gmail/Outlook/iOS Mail all render reliably.
function renderHtml(seg, r) {
  const lines = seg.boxLines(r);
  const box = lines
    .map((line, i) => {
      const last = i === lines.length - 1;
      const prefix = seg.numbered ? `<b style="color:#e94560;">${i + 1}.</b>&nbsp; ` : '';
      return `<p style="margin:0 0 ${last ? 0 : 10}px;font-size:15px;line-height:1.5;">${prefix}${line}</p>`;
    })
    .join('\n');
  const body = seg.body
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${p}</p>`)
    .join('\n');

  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f3f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${seg.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f6;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2130;">
    <tr><td style="background:#1a1a2e;padding:20px 32px;">
      <span style="color:#e94560;font-size:15px;font-weight:800;letter-spacing:2px;">🔥 TRIBAL PICKS</span>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;">
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#1a1a2e;">${seg.heading}</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${seg.intro}</p>
    </td></tr>
    <tr><td style="padding:8px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fa;border-radius:12px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#e94560;">${seg.boxTitle(r)}</p>
          ${box}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 32px 0;">
      ${body}
    </td></tr>
    <tr><td align="center" style="padding:16px 32px 8px;">
      <a href="${APP_STORE_URL}" style="display:inline-block;background:#e94560;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 32px;border-radius:12px;">Get Tribal Picks on the App Store</a>
    </td></tr>
    <tr><td align="center" style="padding:0 32px 20px;">
      <p style="margin:0;font-size:13px;line-height:1.5;color:#8a8d9c;">Already have it? The same link opens the app. Deleted it? It's a free download.</p>
    </td></tr>
    <tr><td style="padding:0 32px 28px;">
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b5e70;">Tip: grab the app update when it shows up in the App Store. It adds reminders so you never miss a pick.</p>
      <p style="margin:0;font-size:16px;line-height:1.6;">Thanks for sticking with us,<br><b>The Tribal Picks team</b></p>
    </td></tr>
  </table>
  <p style="margin:20px 0 0;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a8d9c;">You're getting this because you have a Tribal Picks account. Questions? Just reply.</p>
</td></tr>
</table>
</body></html>`;
}

function renderText(seg, r) {
  const lines = seg.boxLines(r).map((l, i) => (seg.numbered ? `${i + 1}. ` : '- ') + stripTags(l).replace(/\n/g, ' — '));
  return [
    stripTags(seg.heading),
    '',
    stripTags(seg.intro),
    '',
    seg.boxTitle(r),
    ...lines,
    '',
    ...seg.body.map((p) => stripTags(p) + '\n'),
    `Get Tribal Picks on the App Store (free, and it opens the app if you already have it):\n${APP_STORE_URL}`,
    '',
    'Tip: grab the app update when it shows up in the App Store. It adds reminders so you never miss a pick.',
    '',
    'Thanks for sticking with us,\nThe Tribal Picks team',
    '',
    "You're getting this because you have a Tribal Picks account. Questions? Just reply.",
  ].join('\n');
}

function buildEmail(r) {
  const seg = SEGMENTS[r.segment];
  if (!seg) throw new Error(`Unknown segment "${r.segment}" for ${r.email}`);
  if (r.segment === 'moved' && !(r.leagues?.length > 0)) throw new Error(`No leagues for moved user ${r.email}`);
  return { from: FROM, to: [r.email], subject: seg.subject, html: renderHtml(seg, r), text: renderText(seg, r) };
}

// ---------- CLI ----------

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const testTo = argValue('--test');
const testSegment = argValue('--segment') ?? 'new';
const sendAll = args.includes('--send');
const limit = Number(argValue('--limit') ?? Infinity);
const recipientsFile = argValue('--recipients');

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} first`);
  return v;
}

async function sendBatch(resendKey, emails) {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    // One email per recipient — never expose the list via to/cc
    body: JSON.stringify(emails),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function readSentLog() {
  try {
    return new Set(JSON.parse(await readFile(SENT_LOG, 'utf8')));
  } catch {
    return new Set();
  }
}

async function main() {
  if (testTo) {
    const sample = {
      email: testTo,
      segment: testSegment,
      leagues: [
        { name: 'Sample Pool League', code: 'ABC123', game_type: 'survivor_pool' },
        { name: 'Sample Bracket League', code: 'XYZ789', game_type: 'bracket' },
      ],
    };
    const email = buildEmail(sample);
    email.subject = `[TEST: ${testSegment}] ${email.subject}`;
    await sendBatch(need('RESEND_API_KEY'), [email]);
    console.log(`Test "${testSegment}" email sent to ${testTo}`);
    return;
  }

  if (!recipientsFile) throw new Error('Pass --recipients <file.json>');
  const all = JSON.parse(await readFile(recipientsFile, 'utf8'));
  const emails = all.map(buildEmail); // validates every row before anything is sent
  const sent = await readSentLog();
  const pending = emails.filter((e) => !sent.has(e.to[0].toLowerCase()));
  const todays = pending.slice(0, limit);

  const bySegment = {};
  for (const r of all) bySegment[r.segment] = (bySegment[r.segment] ?? 0) + 1;
  console.log(`${all.length} recipients ${JSON.stringify(bySegment)} — ${sent.size} already sent, ${pending.length} left, this run: ${todays.length}`);

  if (!sendAll) {
    console.log('DRY RUN — nothing sent. Re-run with --send to deliver.');
    return;
  }

  const resendKey = need('RESEND_API_KEY');
  for (let i = 0; i < todays.length; i += 100) {
    const batch = todays.slice(i, i + 100);
    await sendBatch(resendKey, batch);
    batch.forEach((e) => sent.add(e.to[0].toLowerCase()));
    // Log after every batch so a crash never causes a double-send
    await writeFile(SENT_LOG, JSON.stringify([...sent], null, 2));
    console.log(`Sent ${Math.min(i + 100, todays.length)}/${todays.length}`);
    await new Promise((r) => setTimeout(r, 600)); // stay under Resend's 2 req/s
  }
  console.log(`Done. ${pending.length - todays.length} left for a later run.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

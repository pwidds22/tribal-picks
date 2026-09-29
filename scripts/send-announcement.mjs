// One-off announcement email to every Tribal Picks account.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:RESEND_API_KEY="..."
//   node scripts/send-announcement.mjs            # dry run: counts + preview, sends nothing
//   node scripts/send-announcement.mjs --test you@example.com   # one real email to you
//   node scripts/send-announcement.mjs --send     # next 100, newest signups first
//   node scripts/send-announcement.mjs --send --limit 200   # if on a paid Resend plan
//   ...add --recipients users.json to read [{email, created_at}] instead of the admin API
// Re-run --send daily; scripts/.announcement-sent.json tracks who already got it.
//
// Prereqs: tribalpicks.com verified in Resend (DNS records), and the domain
// registered in Apple Developer > Services > "Sign in with Apple for Email
// Communication" — otherwise the ~35% of users on @privaterelay.appleid.com
// addresses silently never receive it.

import { readFile, writeFile } from 'node:fs/promises';

const SUPABASE_URL ='https://mwktbcoxrfpadhzfnnma.supabase.co';
const FROM = 'Tribal Picks <support@tribalpicks.com>';
const APP_STORE_URL = 'https://apps.apple.com/app/id6759391126';

const SUBJECT = 'Season 51 is live in Tribal Picks (sorry we were late!)';

const PREHEADER = "Start a new league before Wednesday's episode. Nobody's behind.";

const TEXT = `Survivor 51 is here, and so is Tribal Picks.

We're sorry we were late. If you opened the app after the premiere and couldn't start the new season, that's on us. It's fixed now.

START YOUR SEASON 51 LEAGUE
1. Open Tribal Picks and tap Create League
2. Choose Survivor Pool or Elimination Bracket
3. Share the invite code with your group

Make your Episode 2 picks before Wednesday at 8 PM ET. Episode 1 already aired, so every new league starts at Episode 2. Nobody's behind.

Played Season 50 with us? Your old leagues are saved, but each league covers one season. Create a new one for Season 51 and send your group the new code.

Get Tribal Picks on the App Store (free, and it opens the app if you already have it):
${APP_STORE_URL}

Tip: grab the app update when it shows up in the App Store. It adds reminders so you never miss a pick.

Thanks for sticking with us,
The Tribal Picks team

You're getting this because you have a Tribal Picks account. Questions? Just reply.`;

// Table layout + inline styles: the only thing Gmail/Outlook/iOS Mail all render reliably.
const HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f3f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${PREHEADER}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f6;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2130;">
    <tr><td style="background:#1a1a2e;padding:20px 32px;">
      <span style="color:#e94560;font-size:15px;font-weight:800;letter-spacing:2px;">🔥 TRIBAL PICKS</span>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;">
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#1a1a2e;">Survivor 51 is here, and so is Tribal Picks.</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">We're sorry we were late. If you opened the app after the premiere and couldn't start the new season, that's on us. <b>It's fixed now.</b></p>
    </td></tr>
    <tr><td style="padding:8px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fa;border-radius:12px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#e94560;">START YOUR SEASON 51 LEAGUE</p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><b style="color:#e94560;">1.</b>&nbsp; Open Tribal Picks and tap <b>Create League</b></p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><b style="color:#e94560;">2.</b>&nbsp; Choose <b>Survivor Pool</b> or <b>Elimination Bracket</b></p>
          <p style="margin:0;font-size:15px;line-height:1.5;"><b style="color:#e94560;">3.</b>&nbsp; Share the invite code with your group</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 32px 0;">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Make your Episode 2 picks before <b>Wednesday at 8&nbsp;PM&nbsp;ET</b>. Episode 1 already aired, so every new league starts at Episode 2. Nobody's behind.</p>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;"><b>Played Season 50 with us?</b> Your old leagues are saved, but each league covers one season. Create a new one for Season 51 and send your group the new code.</p>
    </td></tr>
    <tr><td align="center" style="padding:24px 32px 8px;">
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

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const testTo = argValue('--test');
const sendAll = args.includes('--send');
// Resend free plan = 100 emails/day. Each run sends up to --limit, newest
// signups first, and records who was sent so the next run resumes.
const limit = Number(argValue('--limit') ?? 100);
// Optional: JSON array of {email, created_at} instead of the Supabase admin API
const recipientsFile = argValue('--recipients');
const SENT_LOG = new URL('./.announcement-sent.json', import.meta.url);

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} first`);
  return v;
}

/** All account emails, newest signup first. */
async function listEmails() {
  let users;
  if (recipientsFile) {
    users = JSON.parse(await readFile(recipientsFile, 'utf8'));
  } else {
    const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');
    users = [];
    for (let page = 1; ; page++) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (!res.ok) throw new Error(`Supabase admin API ${res.status}: ${await res.text()}`);
      const page_ = (await res.json()).users;
      users.push(...page_);
      if (page_.length < 1000) break;
    }
  }
  const sorted = users
    .filter((u) => u.email)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return [...new Set(sorted.map((u) => u.email.toLowerCase()))];
}

async function readSentLog() {
  try {
    return new Set(JSON.parse(await readFile(SENT_LOG, 'utf8')));
  } catch {
    return new Set();
  }
}

async function sendBatch(resendKey, to) {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    // One email per recipient — never expose the list via to/cc
    body: JSON.stringify(to.map((email) => ({ from: FROM, to: [email], subject: SUBJECT, html: HTML, text: TEXT }))),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function main() {
  if (testTo) {
    await sendBatch(need('RESEND_API_KEY'), [testTo]);
    console.log(`Test email sent to ${testTo}`);
    return;
  }

  const emails = await listEmails();
  const sent = await readSentLog();
  const pending = emails.filter((e) => !sent.has(e));
  const todays = pending.slice(0, limit);
  const relay = emails.filter((e) => e.endsWith('@privaterelay.appleid.com')).length;
  console.log(
    `${emails.length} accounts (${relay} Apple private relay) — ${sent.size} already sent, ` +
    `${pending.length} left, this run: ${todays.length}`,
  );

  if (!sendAll) {
    console.log(`\nDRY RUN — nothing sent. Subject: ${SUBJECT}\n\n${TEXT}\n\nRe-run with --send to deliver.`);
    return;
  }

  const resendKey = need('RESEND_API_KEY');
  for (let i = 0; i < todays.length; i += 100) {
    const batch = todays.slice(i, i + 100);
    await sendBatch(resendKey, batch);
    batch.forEach((e) => sent.add(e));
    // Log after every batch so a crash never causes a double-send
    await writeFile(SENT_LOG, JSON.stringify([...sent], null, 2));
    console.log(`Sent ${Math.min(i + 100, todays.length)}/${todays.length}`);
    await new Promise((r) => setTimeout(r, 600)); // stay under Resend's 2 req/s
  }
  console.log(`Done. ${pending.length - todays.length} left for the next run.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

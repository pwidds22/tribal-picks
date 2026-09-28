// One-off announcement email to every Tribal Picks account.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:RESEND_API_KEY="..."
//   node scripts/send-announcement.mjs            # dry run: counts + preview, sends nothing
//   node scripts/send-announcement.mjs --test you@example.com   # one real email to you
//   node scripts/send-announcement.mjs --send     # everyone
//
// Prereqs: tribalpicks.com verified in Resend (DNS records), and the domain
// registered in Apple Developer > Services > "Sign in with Apple for Email
// Communication" — otherwise the ~35% of users on @privaterelay.appleid.com
// addresses silently never receive it.

const SUPABASE_URL = 'https://mwktbcoxrfpadhzfnnma.supabase.co';
const FROM = 'Tribal Picks <support@tribalpicks.com>';
const APP_STORE_URL = 'https://apps.apple.com/app/id6759391126';

const SUBJECT = 'Season 51 is live in Tribal Picks (sorry we were late!)';

const TEXT = `Hi there,

If you downloaded Tribal Picks for Survivor 51 and found nothing to play, that's on us, and we're sorry. The app wasn't ready in time for the premiere.

It's fixed. Season 51 is live now:

- Start a Survivor Pool and make your Episode 2 pick before Wednesday at 8 PM ET
- Or set an Elimination Bracket for the 20 castaways still in the game

Episode 1 is already in the books, so new leagues start with Episode 2. Nobody's behind.

Open Tribal Picks, tap Create League, and share the invite code with your group:
${APP_STORE_URL}

An update with pick reminders is on its way too, so you never miss a lock.

Thanks for sticking with us,
The Tribal Picks team

You're receiving this because you have a Tribal Picks account. Questions? Reply to this email.`;

const HTML = `<!doctype html><html><body style="margin:0;background:#0f0f23;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#e8e8f0">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<h1 style="color:#e94560;font-size:22px;margin:0 0 20px">Season 51 is live 🔥</h1>
<p style="line-height:1.55">If you downloaded Tribal Picks for Survivor 51 and found nothing to play, that's on us, and we're sorry. The app wasn't ready in time for the premiere.</p>
<p style="line-height:1.55"><b>It's fixed.</b> Season 51 is live now:</p>
<ul style="line-height:1.7;padding-left:20px">
<li>Start a <b>Survivor Pool</b> and make your Episode 2 pick before <b>Wednesday at 8 PM ET</b></li>
<li>Or set an <b>Elimination Bracket</b> for the 20 castaways still in the game</li>
</ul>
<p style="line-height:1.55">Episode 1 is already in the books, so new leagues start with Episode 2. Nobody's behind.</p>
<p style="margin:28px 0"><a href="${APP_STORE_URL}" style="background:#e94560;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">Open Tribal Picks</a></p>
<p style="line-height:1.55">An update with pick reminders is on its way too, so you never miss a lock.</p>
<p style="line-height:1.55">Thanks for sticking with us,<br>The Tribal Picks team</p>
<p style="color:#777;font-size:12px;margin-top:32px">You're receiving this because you have a Tribal Picks account. Questions? Reply to this email.</p>
</div></body></html>`;

const args = process.argv.slice(2);
const testIdx = args.indexOf('--test');
const testTo = testIdx >= 0 ? args[testIdx + 1] : null;
const sendAll = args.includes('--send');

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} first`);
  return v;
}

async function listEmails(serviceKey) {
  const emails = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) throw new Error(`Supabase admin API ${res.status}: ${await res.text()}`);
    const { users } = await res.json();
    for (const u of users) if (u.email) emails.push(u.email);
    if (users.length < 1000) break;
  }
  return [...new Set(emails.map((e) => e.toLowerCase()))];
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

  const emails = await listEmails(need('SUPABASE_SERVICE_ROLE_KEY'));
  const relay = emails.filter((e) => e.endsWith('@privaterelay.appleid.com')).length;
  console.log(`${emails.length} recipients (${relay} Apple private relay)`);

  if (!sendAll) {
    console.log(`\nDRY RUN — nothing sent. Subject: ${SUBJECT}\n\n${TEXT}\n\nRe-run with --send to deliver.`);
    return;
  }

  const resendKey = need('RESEND_API_KEY');
  for (let i = 0; i < emails.length; i += 100) {
    await sendBatch(resendKey, emails.slice(i, i + 100));
    console.log(`Sent ${Math.min(i + 100, emails.length)}/${emails.length}`);
    await new Promise((r) => setTimeout(r, 600)); // stay under Resend's 2 req/s
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

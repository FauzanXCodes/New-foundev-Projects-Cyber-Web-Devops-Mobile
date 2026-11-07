// What a friend sees when an invite link is tapped somewhere that is not the app: a Messages
// preview card, a browser, a share sheet. Apple's Link Presentation renders that card from the
// page's Open Graph tags, so this page is mostly metadata. It is also where universal links start:
// iOS reads /.well-known/apple-app-site-association to learn which paths belong to the app.
import type { InvitePreview } from '../shared/api.ts';
import { formatInviteCode } from '../shared/copy.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type PageOptions = {
  /** Absolute origin this page is served from, used for the canonical URL and the preview image. */
  base: string;
  token: string;
  /** The app's URL scheme, for the "Open in Rally" button. */
  scheme: string;
  /** Where to get the app (a TestFlight or App Store link), for someone who has not installed it yet. */
  installUrl?: string;
};

/** Title and description for the card. Kept short, because Messages truncates hard. */
export function cardText(p: InvitePreview): { title: string; description: string } {
  const c = p.challenge;
  if (!c) return { title: `${p.inviterName} wants you in their crew`, description: 'Start challenges together and keep each other honest.' };
  const consequence = c.consequence?.text ? ` Last place: ${c.consequence.text.toLowerCase()}.` : '';
  return { title: `${p.inviterName} invited you to ${c.name}`, description: `${c.targetText}${consequence}` };
}

export function invitePage(p: InvitePreview, o: PageOptions): string {
  const { title, description } = cardText(p);
  const url = `${o.base}/invite/${encodeURIComponent(o.token)}`;
  const open = `${o.scheme}://invite/${encodeURIComponent(o.token)}`;
  const install = o.installUrl && /^https?:\/\//.test(o.installUrl) ? o.installUrl : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#D62B23">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rally">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(o.base)}/invite-image.png">
<meta name="twitter:card" content="summary">
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F7F5F1; color: #1B1A19;
         font: 17px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
  main { max-width: 420px; padding: 32px 24px; text-align: center; }
  img { width: 96px; height: 96px; border-radius: 24px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 20px 0 8px; }
  p { color: #7C7873; margin: 0 0 24px; }
  a.open { display: inline-block; background: #D62B23; color: #fff; text-decoration: none; font-weight: 600;
      padding: 16px 32px; border-radius: 999px; }
  .code { margin: 28px 0 0; font-size: 15px; color: #7C7873; }
  .code b { display: block; margin-top: 4px; font-size: 24px; letter-spacing: 0.08em; color: #1B1A19; font-variant-numeric: tabular-nums; }
  .get { margin: 20px 0 0; font-size: 15px; }
  .get a { color: #1B1A19; font-weight: 600; }
</style>
</head>
<body>
<main>
  <img src="${esc(o.base)}/invite-image.png" alt="Rally">
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
  <a class="open" href="${esc(open)}">Open in Rally</a>
  <p class="code">Or open Rally and enter this code<b>${esc(formatInviteCode(o.token))}</b></p>
  ${install ? `<p class="get">Don't have Rally yet? <a href="${esc(install)}">Get the app</a></p>` : ''}
</main>
</body>
</html>`;
}

/**
 * The file iOS fetches to decide whether a link should open the app. It is only meaningful with a
 * real team id, so without one this returns null rather than publishing a wrong association.
 */
export function appSiteAssociation(teamId: string | undefined, bundleId: string): object | null {
  if (!teamId) return null;
  return { applinks: { details: [{ appIDs: [`${teamId}.${bundleId}`], components: [{ '/': '/invite/*' }] }] } };
}


/** The privacy policy, in plain words. What it says must stay true to what the server stores. */
export function privacyPage(contact: string | undefined): string {
  const reach = contact
    ? `Email <a href="mailto:${contact}">${contact}</a>.`
    : 'Use Send Beta Feedback in TestFlight, or the support contact on the app\u2019s page.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rally Privacy Policy</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 17px/1.55 -apple-system, system-ui, sans-serif; max-width: 680px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 30px; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  p.date { color: #777; margin-top: 0; }
  li { margin: 6px 0; }
</style>
</head>
<body>
<h1>Rally Privacy Policy</h1>
<p class="date">Last updated October 8, 2026</p>
<p>Rally is an app for doing fitness challenges with friends. This page says what the app keeps about you and why.</p>

<h2>What Rally stores</h2>
<ul>
  <li><strong>Your name</strong>, as you typed it, so your friends can see who is who.</li>
  <li><strong>Your phone number and a 4 digit PIN, only if you add them.</strong> They let you sign back in on another phone. The PIN is stored scrambled (hashed), never as the digits you typed.</li>
  <li><strong>What you log:</strong> the workouts you record, the challenges you start or join, the consequences your group proposes, and who is in your crew.</li>
  <li><strong>Your settings:</strong> your reminder time, what you track and your activity level.</li>
</ul>

<h2>What Rally does not do</h2>
<ul>
  <li>No ads, no analytics and no tracking across other apps or websites.</li>
  <li>Your information is not sold or shared with advertisers.</li>
  <li>Rally does not read your health data, your location or your photos.</li>
  <li>Your contacts are not uploaded. When you invite someone, Apple\u2019s own contact picker opens and only the one number you choose is used, on your phone, to start a text message.</li>
</ul>

<h2>On your phone only</h2>
<ul>
  <li>Reminders are scheduled on your phone. Nothing about them is sent to us.</li>
  <li>The Apple Intelligence features (challenge recaps and consequence ideas) run on your iPhone. That text is not sent to us or to anyone else.</li>
  <li>Your sign-in is kept in the iPhone\u2019s Keychain.</li>
</ul>

<h2>Who can see what</h2>
<p>People in a challenge with you can see your name, your progress in that challenge and whether you logged today. People in your crew can see your name and how many challenges you have completed. Nobody else can see your phone number.</p>

<h2>Where it is kept</h2>
<p>Rally\u2019s data is stored on a server run for Rally by Fly.io in the United States, and travels between your phone and that server over an encrypted connection.</p>

<h2>Deleting your information</h2>
<p>Ask and your account and everything attached to it will be deleted. ${reach}</p>

<h2>Children</h2>
<p>Rally is not meant for children under 13.</p>

<h2>Changes and questions</h2>
<p>If this policy changes, the date at the top changes with it. Questions: ${reach}</p>
</body>
</html>`;
}

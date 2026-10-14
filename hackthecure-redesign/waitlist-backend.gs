/**
 * Hack The Cure sign-up backend
 * ---------------------------------------------------------------------------
 * Receives the interest form, writes every entry to a Google Sheet you own,
 * and notifies you. Free, no third-party service, and the data never leaves
 * your Google account.
 *
 * SETUP (about five minutes, once)
 *
 *  1. Sign in as hackthecure@gmail.com and create a new Google Sheet.
 *     Name it anything, e.g. "Hack The Cure sign-ups".
 *  2. In that sheet: Extensions -> Apps Script.
 *  3. Delete whatever is in Code.gs and paste this whole file in.
 *  4. Check the settings block below. NOTIFY_EMAIL is already set, so you get
 *     an email on every sign-up without changing anything.
 *  5. Click Deploy -> New deployment.
 *       Type:           Web app
 *       Execute as:     Me
 *       Who has access: Anyone            <-- must be "Anyone", NOT
 *                                             "Anyone with a Google account"
 *  6. Authorise it when Google asks. You will see an "unverified app" warning
 *     because it is your own script: Advanced -> Go to (project name).
 *  7. Copy the Web app URL. It looks like:
 *       https://script.google.com/macros/s/AKfycb.../exec
 *  8. Paste it into js/config.js:
 *       waitlistEndpoint: 'https://script.google.com/macros/s/AKfycb.../exec',
 *       waitlistMode: 'apps-script'
 *  9. Open the site, submit the form once, and check the row lands in the
 *     sheet and the email arrives.
 *
 * IF YOU EDIT THIS SCRIPT LATER: Deploy -> Manage deployments -> pencil icon
 * -> Version: New version -> Deploy. Saving alone does not update the live URL.
 *
 * WHY text/plain: the site posts JSON with a text/plain content type. That
 * keeps it a "simple" CORS request, which Apps Script can answer; a normal
 * application/json post would trigger a preflight that Apps Script cannot.
 */

/* ----------------------------------------------------------- settings ---- */

var SHEET_NAME = 'Signups';

/** Emails you on every sign-up. Set to '' to turn off. */
var NOTIFY_EMAIL = 'hackthecure@gmail.com';

/**
 * Optional: also post to a Discord channel. In Discord, open
 * Server Settings -> Integrations -> Webhooks -> New Webhook, pick the
 * channel, copy the URL, and paste it here. Leave '' to skip.
 */
var DISCORD_WEBHOOK = '';

/** Sends the person a short "you're on the list" confirmation. */
var SEND_CONFIRMATION = true;

/** Ignore an email address that is already on the list. */
var BLOCK_DUPLICATES = true;

/* ------------------------------------------------------------- script ---- */

var COLUMNS = ['Submitted at', 'Name', 'Email', 'Country', 'Role', 'Track', 'Source'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return respond({ ok: false, error: 'busy' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ ok: false, error: 'empty request' });
    }

    var data = JSON.parse(e.postData.contents);
    var email = String(data.email || '').trim().toLowerCase();
    if (!email) return respond({ ok: false, error: 'missing email' });

    var name = String(data.name || '').trim();
    var country = String(data.country || '').trim();
    var role = String(data.role || '').trim();
    var track = String(data.track || '').trim() || 'Not sure yet';

    var sheet = getSheet();

    if (BLOCK_DUPLICATES && hasEmail(sheet, email)) {
      return respond({ ok: true, duplicate: true });
    }

    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      name, email, country, role, track,
      String(data.source || '').trim()
    ]);

    var total = sheet.getLastRow() - 1;

    notifyByEmail(name, email, country, role, track, total);
    notifyDiscord(name, email, country, role, track, total);
    sendConfirmation(name, email, track);

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Open the /exec URL in a browser to confirm the deployment is live. */
function doGet() {
  return respond({ ok: true, message: 'Hack The Cure sign-up endpoint is live.' });
}

function notifyByEmail(name, email, country, role, track, total) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Hack The Cure sign-up #' + total + ': ' + (name || email),
      body: [
        'Name:    ' + name,
        'Email:   ' + email,
        'Country: ' + country,
        'Role:    ' + role,
        'Track:   ' + track,
        '',
        'Total on the list: ' + total
      ].join('\n')
    });
  } catch (err) {
    // A failed notification must never lose the row that is already saved.
    console.error('notify email failed: ' + err);
  }
}

function notifyDiscord(name, email, country, role, track, total) {
  if (!DISCORD_WEBHOOK) return;
  try {
    UrlFetchApp.fetch(DISCORD_WEBHOOK, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        content: '**Sign-up #' + total + ':** ' + (name || email) +
          ' (' + country + ')\n' + role + ' · ' + track
      })
    });
  } catch (err) {
    console.error('discord notify failed: ' + err);
  }
}

function sendConfirmation(name, email, track) {
  if (!SEND_CONFIRMATION) return;
  try {
    MailApp.sendEmail({
      to: email,
      name: 'Hack The Cure',
      subject: 'You are on the list for Hack The Cure',
      body: [
        'Hi ' + (name.split(' ')[0] || 'there') + ',',
        '',
        'You are on the list for Hack The Cure, 27 December 2026 to 3 January 2027.',
        'It is free, fully virtual, and you picked: ' + track + '.',
        '',
        'We will email you everything you need before the event: the Discord',
        'invite, the track briefs and the schedule. Nothing else to do for now.',
        '',
        'Questions at any point? Just reply to this email.',
        '',
        'The Hack The Cure team',
        'https://hackthecure.world'
      ].join('\n')
    });
  } catch (err) {
    console.error('confirmation email failed: ' + err);
  }
}

function getSheet() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(SHEET_NAME);

  if (!sheet) sheet = doc.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function hasEmail(sheet, email) {
  var rows = sheet.getLastRow() - 1;
  if (rows < 1) return false;
  var values = sheet.getRange(2, 3, rows, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === email) return true;
  }
  return false;
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

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
 * MENTOR REGISTRATION: mentor.html posts to the same URL. Those entries go to
 * a "Mentors" tab in this sheet, and any photo is saved to a Google Drive
 * folder called "Hack The Cure mentor photos", with a link in the sheet.
 * Saving photos needs Drive access, so the first deploy after adding this
 * asks you to authorise again.
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

/** Where mentor registrations and their photos go. */
var MENTOR_SHEET_NAME = 'Mentors';
var MENTOR_PHOTO_FOLDER = 'Hack The Cure mentor photos';

/* ------------------------------------------------------------- script ---- */

var COLUMNS = ['Submitted at', 'Name', 'Email', 'Country', 'Role', 'Track', 'Source'];

var MENTOR_COLUMNS = [
  'Submitted at', 'Name', 'Email', 'University / Workplace',
  'First choice track', 'Second choice track',
  'Time zone', 'Same hours every day', 'Office hours (their time)',
  'Office hours (Eastern)', 'Hours per day', 'LinkedIn', 'Photo',
  'Organising contact method', 'Organising contact'
];

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
    if (data.type === 'mentor') return handleMentor(data);

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
  return getNamedSheet(SHEET_NAME, COLUMNS);
}

function getNamedSheet(name, columns) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(name);

  if (!sheet) sheet = doc.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ------------------------------------------------------------ mentors ---- */

function handleMentor(data) {
  var email = clean(data.email).toLowerCase();
  if (!email) return respond({ ok: false, error: 'missing email' });

  var name = clean(data.name);
  var photoUrl = saveMentorPhoto(data.photo, name || email);
  var sheet = getNamedSheet(MENTOR_SHEET_NAME, MENTOR_COLUMNS);

  var row = [
    data.submittedAt || new Date().toISOString(),
    name, email, clean(data.organisation),
    clean(data.firstChoice), clean(data.secondChoice),
    clean(data.timezone), data.sameEveryDay ? 'Yes' : 'No',
    clean(data.hoursLocal), clean(data.hoursEastern), clean(data.hoursPerDay),
    clean(data.linkedin), photoUrl,
    clean(data.contactMethod), clean(data.contact)
  ];
  sheet.appendRow(row.map(safeCell));

  var total = sheet.getLastRow() - 1;
  notifyMentor(data, name, email, photoUrl, total);
  confirmMentor(name, email, clean(data.firstChoice));

  return respond({ ok: true });
}

/** Saves a base64 JPEG to Drive and returns its link, or '' if there is none. */
function saveMentorPhoto(base64, label) {
  if (!base64) return '';
  try {
    var bytes = Utilities.base64Decode(String(base64));
    if (bytes.length > 5 * 1024 * 1024) return 'Photo too large to save';
    var fileName = String(label).replace(/[^\w .-]/g, '').trim() || 'mentor';
    var blob = Utilities.newBlob(bytes, 'image/jpeg', fileName + '.jpg');
    var folders = DriveApp.getFoldersByName(MENTOR_PHOTO_FOLDER);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(MENTOR_PHOTO_FOLDER);
    return folder.createFile(blob).getUrl();
  } catch (err) {
    // The registration itself still saves without the photo.
    console.error('mentor photo failed: ' + err);
    return 'Photo upload failed: ' + String(err).slice(0, 200);
  }
}

/**
 * Run this once from the Apps Script editor (choose it in the function menu
 * next to the Run button, then click Run). It asks Google for Drive access and
 * creates the photo folder. Then redeploy: Deploy -> Manage deployments ->
 * pencil -> Version: New version -> Deploy.
 */
function setUpMentorPhotos() {
  var folders = DriveApp.getFoldersByName(MENTOR_PHOTO_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(MENTOR_PHOTO_FOLDER);
  console.log('Mentor photos will be saved to: ' + folder.getUrl());
}

function notifyMentor(data, name, email, photoUrl, total) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Hack The Cure mentor #' + total + ': ' + (name || email),
      body: [
        'Name:          ' + name,
        'Email:         ' + email,
        'Organisation:  ' + clean(data.organisation),
        'First choice:  ' + clean(data.firstChoice),
        'Second choice: ' + clean(data.secondChoice),
        'Time zone:     ' + clean(data.timezone),
        'Office hours:  ' + clean(data.hoursLocal),
        'In Eastern:    ' + clean(data.hoursEastern),
        'LinkedIn:      ' + (clean(data.linkedin) || '-'),
        'Photo:         ' + (photoUrl || '-'),
        'Contact via:   ' + clean(data.contactMethod) + ' ' + clean(data.contact),
        '',
        'Mentors registered so far: ' + total
      ].join('\n')
    });
  } catch (err) {
    console.error('mentor notify failed: ' + err);
  }
}

function confirmMentor(name, email, firstChoice) {
  if (!SEND_CONFIRMATION) return;
  try {
    MailApp.sendEmail({
      to: email,
      name: 'Hack The Cure',
      subject: 'Thanks for offering to mentor at Hack The Cure',
      body: [
        'Hi ' + (name.split(' ')[0] || 'there') + ',',
        '',
        'Thank you for registering as a mentor for Hack The Cure,',
        '27 December 2026 to 3 January 2027.',
        'Your first choice of track: ' + (firstChoice || 'not given') + '.',
        '',
        'We will be in touch soon to confirm your track and office hours.',
        '',
        'Questions at any point? Just reply to this email.',
        '',
        'The Hack The Cure team',
        'https://hackthecure.world'
      ].join('\n')
    });
  } catch (err) {
    console.error('mentor confirmation failed: ' + err);
  }
}

function clean(value) {
  return String(value == null ? '' : value).trim();
}

/** Stops a value like "=SUM(...)" being run as a formula in the sheet. */
function safeCell(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
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

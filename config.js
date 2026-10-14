/* ==========================================================================
   Hack The Cure site configuration
   Everything that changes between now and the event lives in this file.
   Edit these values only; nothing else in the site hard-codes them.
   ========================================================================== */

window.HTC_CONFIG = {
  /* ---------------------------------------------------------------- event */
  event: {
    /* Shown in the hero, the footer and the link preview. */
    dateLabel: 'December 27, 2026 – January 3, 2027',

    /* Machine-readable dates, YYYY-MM-DD. These drive the countdown, the
       "add to calendar" links and the day numbering in the schedule, so the
       schedule re-labels itself if you move the week. */
    startDate: '2026-12-27',
    endDate: '2027-01-03',

    /* Opening ceremony time in UTC, e.g. '15:00'. While this is empty the
       countdown runs to the start of day one. */
    openingTimeUTC: '',

    /* Daily mentor office hours. Replace with the real times once set,
       e.g. '14:00 and 02:00 UTC, every day'. */
    officeHours: 'times announced closer to the event',

    location: 'Online, worldwide'
  },

  /* -------------------------------------------------------------- contact
     One shared inbox. If you later split mentors/sponsors onto their own
     addresses, fill them in here and the site picks them up; while they are
     empty everything falls back to `general`. */
  contact: {
    general: 'hackthecureoutreach@gmail.com',
    sponsors: '',
    mentors: ''
  },

  /* --------------------------------------------------------------- social
     Leave a value as an empty string and that icon is simply not rendered,
     so the footer never ships a dead link. Fill them in as they go live. */
  social: {
    instagram: '',
    linkedin: '',
    discord: '',
    devpost: ''
  },

  /* ------------------------------------------------------------- waitlist
     REQUIRED BEFORE LAUNCH. This is where the interest form posts, and it is
     the only thing standing between a visitor filling the form in and you
     being notified. See README.md -> "Connect the form" for the setup; it
     takes about five minutes and uses the Google account that owns the
     sign-up sheet.

     waitlistMode:
       'apps-script'  Google Apps Script web app (what waitlist-backend.gs
                      is written for). Sends the JSON as text/plain so the
                      browser skips the CORS preflight Apps Script cannot
                      answer. Do not change this while pointing at a
                      script.google.com URL.
       'json'         Standard application/json POST, for Formspree, Basin,
                      a Netlify function, or your own API.

     Until this is filled in, the form validates normally and then tells the
     visitor to email you instead. It never opens their email app on its own. */
  waitlistEndpoint: 'https://script.google.com/macros/s/AKfycbwCA_fta3EII-NcfrRWivLERGTnaBMiAIidcb4nVQs9nF4wPkE55J1EC__usEzg9DE5pA/exec',
  waitlistMode: 'apps-script'
};

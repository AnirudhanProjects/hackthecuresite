# Hack The Cure site, redesign

A second design of the Hack The Cure site. Same copy, same form backend and
the same behaviour as the original in `../hackthecure-site`, with a new look.
Plain HTML, CSS and JavaScript, no build step.

## The design in one paragraph

The page is one sheet of bone-coloured paper with aubergine ink, set in Besley
(a Clarendon) for headings and Atkinson Hyperlegible for text and numbers.
The hero lists the six tracks, each row a link to its track. Every track has
a numbered cover sheet in its own colour; the six colours run amber to
fuchsia and are used only to identify a track. Sections are separated by ink
rules instead of cards. The week is drawn as a seven-day strip and the
judging rubric as a 100-point bar, both to scale.

## What is here

| Path | What it is |
| --- | --- |
| `index.html` | The whole landing page |
| `privacy.html`, `terms.html` | The two footer pages |
| `css/styles.css` | All styling. Colours and fonts are the variables at the top. |
| `js/config.js` | Dates, contact address, social links and the form endpoint. **Edit this file, not the others.** |
| `js/main.js` | Countdown, calendar links, schedule labels, week strip, FAQ, track reel, form |
| `waitlist-backend.gs` | The Google Apps Script that saves sign-ups to a Google Sheet |
| `assets/` | Logos, icons and the link-preview image |

## Things to know

- **Fonts load from Google Fonts**, so the page needs an internet connection to
  show the right typefaces. The original site kept its font files in
  `assets/fonts`; the same can be done here.
- **`assets/og-image.png` is still the original design.** It is the picture
  shown when the link is shared, and it does not match the new look yet.
- Changing `startDate` and `endDate` in `js/config.js` re-labels the schedule
  and redraws the week strip. The "Length" figure in the hero follows too.

## Preview it

Double-click `index.html` to open it in your browser.

## Connect the form

`js/config.js` already points at the live Google Apps Script deployment, the
same one the original site uses. To set up a fresh sheet, follow
"Connect the form" in `../hackthecure-site/README.md`.

## Deploy

Deploys to Vercel as-is, with no framework preset and no build command.
`vercel.json` turns on clean URLs (`/privacy` instead of `/privacy.html`) and
`README.md` is listed in `.vercelignore` so it is not published.

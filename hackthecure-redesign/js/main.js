/* ==========================================================================
   Hack The Cure site behaviour
   No dependencies. Every module is defensive: if its markup is absent the
   module returns quietly rather than throwing.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = window.HTC_CONFIG || {};
  var EVENT = CONFIG.event || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  /* ---------------------------------------------------------------- dates */
  var DAY = 86400000;

  function utcDate(ymd) {
    var d = new Date(ymd + 'T00:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }

  var startDay = utcDate(EVENT.startDate);
  var endDay = utcDate(EVENT.endDate);
  var totalDays = startDay && endDay ? Math.round((endDay - startDay) / DAY) + 1 : 0;

  /* Opening moment: the configured UTC time on day one, or midnight UTC. */
  var openingMoment = startDay
    ? new Date(EVENT.startDate + 'T' + (/^\d{2}:\d{2}$/.test(EVENT.openingTimeUTC || '') ? EVENT.openingTimeUTC : '00:00') + ':00Z')
    : null;

  /* The calendar entry is an all-day span; DTEND is exclusive, so +1 day. */
  var calendarEnd = endDay ? new Date(endDay.getTime() + DAY) : null;

  function stampDate(d) {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  function formatDay(d, withWeekday) {
    var opts = { timeZone: 'UTC', day: 'numeric', month: 'short' };
    if (withWeekday) opts.weekday = 'short';
    try {
      return new Intl.DateTimeFormat('en-GB', opts).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  /* ------------------------------------------------------- sticky nav state */
  function initNavState() {
    var nav = $('.nav');
    if (!nav) return;
    var ticking = false;

    function update() {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------ mobile menu */
  function initMobileMenu() {
    var toggle = $('.nav__toggle');
    var panel = $('#nav-panel');
    if (!toggle || !panel) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    window.matchMedia('(min-width: 881px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* --------------------------------------------------- current section link */
  function initSectionHighlight() {
    var links = $$('.nav__link');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = links.map(function (link) {
      var id = link.getAttribute('href').replace('#', '');
      var section = document.getElementById(id);
      if (section) map[id] = link;
      return section;
    }).filter(Boolean);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        var active = map[entry.target.id];
        if (active) active.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---------------------------------------------------------- scroll reveal */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* -------------------------------------------------------------- countdown */
  function initCountdown() {
    var root = $('#countdown');
    if (!root) return;

    if (!openingMoment || isNaN(openingMoment.getTime())) { root.hidden = true; return; }
    root.hidden = false;   /* ships hidden so no-JS visitors never see 00:00:00:00 */

    var caption = $('.countdown__caption', root);
    var finish = calendarEnd ? calendarEnd.getTime() : null;
    var start = openingMoment.getTime();
    var units = {
      days: $('[data-unit="days"]', root),
      hours: $('[data-unit="hours"]', root),
      minutes: $('[data-unit="minutes"]', root),
      seconds: $('[data-unit="seconds"]', root)
    };
    var runningLabel = /^\d{2}:\d{2}$/.test(EVENT.openingTimeUTC || '')
      ? 'until the opening ceremony'
      : '';

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function write(values, text) {
      Object.keys(units).forEach(function (key) {
        var el = units[key];
        if (!el) return;
        el.classList.remove('is-skeleton');
        el.textContent = values ? pad(values[key]) : '00';
      });
      if (caption) caption.textContent = text;
    }

    function tick() {
      var now = Date.now();

      if (now >= start && (!finish || now < finish)) {
        write(null, 'Hack The Cure is running right now.');
        root.setAttribute('data-state', 'live');
        return false;
      }
      if (finish && now >= finish) {
        write(null, 'That one has wrapped. Sign up and we will tell you about the next.');
        root.setAttribute('data-state', 'ended');
        return false;
      }

      var diff = start - now;
      write({
        days: Math.floor(diff / DAY),
        hours: Math.floor(diff / 3600000) % 24,
        minutes: Math.floor(diff / 60000) % 60,
        seconds: Math.floor(diff / 1000) % 60
      }, runningLabel);
      return true;
    }

    if (tick()) {
      var timer = window.setInterval(function () {
        if (!tick()) window.clearInterval(timer);
      }, 1000);
    }
  }

  /* ------------------------------------------------------- add to calendar */
  function initCalendar() {
    var googleLink = $('[data-calendar="google"]');
    var icsButton = $('[data-calendar="ics"]');
    var wrapper = $('.countdown__extra');

    if (!startDay || !calendarEnd) {
      if (wrapper) wrapper.hidden = true;
      return;
    }

    var from = stampDate(startDay);
    var to = stampDate(calendarEnd);
    var title = 'Hack The Cure';
    var details = 'A free one-week online health hackathon for students aged 13 to 18. https://hackthecure.world';
    var where = EVENT.location || 'Online';

    if (googleLink) {
      googleLink.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent(title) +
        '&dates=' + from + '/' + to +
        '&details=' + encodeURIComponent(details) +
        '&location=' + encodeURIComponent(where);
    }

    if (!icsButton) return;

    /* RFC 5545 escaping for TEXT values. */
    function esc(v) {
      return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    }

    /* RFC 5545 caps a content line at 75 octets; longer lines must be folded
       onto continuation lines that begin with a space. Outlook and the Windows
       Calendar app reject a file that breaks this, which looks to the person
       clicking like the download simply did nothing. */
    function fold(line) {
      if (line.length <= 73) return line;
      var out = line.slice(0, 73);
      var rest = line.slice(73);
      while (rest.length > 72) {
        out += '\r\n ' + rest.slice(0, 72);
        rest = rest.slice(72);
      }
      return out + '\r\n ' + rest;
    }

    icsButton.addEventListener('click', function () {
      var ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hack The Cure//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' + from + '-hackthecure@hackthecure.world',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
        'DTSTART;VALUE=DATE:' + from,
        'DTEND;VALUE=DATE:' + to,
        'SUMMARY:' + esc(title),
        'DESCRIPTION:' + esc(details),
        'LOCATION:' + esc(where),
        'URL:https://hackthecure.world',
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
        'END:VCALENDAR'
      ].map(fold).join('\r\n') + '\r\n';

      var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = 'hack-the-cure.ics';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      /* Chrome cancels a blob download if the anchor is detached or the
         object URL is revoked while the download is still starting, so both
         happen well after the click rather than on the next statement. */
      window.setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 40000);
    });
  }

  /* --------------------------------------------------------------- schedule
     Day numbers and dates come from the configured week, so moving the dates
     in config.js re-labels the schedule instead of leaving it stale. */
  function initSchedule() {
    if (!startDay || !endDay || totalDays < 3) return;

    var secondDay = new Date(startDay.getTime() + DAY);
    var secondLastDay = new Date(endDay.getTime() - DAY);

    var values = {
      'first-label': 'Day 1',
      'first-date': formatDay(startDay, true),
      'middle-marker': '2–' + (totalDays - 1),
      'middle-label': 'Days 2–' + (totalDays - 1),
      'middle-date': formatDay(secondDay, true) + ' – ' + formatDay(secondLastDay, true),
      'last-marker': String(totalDays),
      'last-label': 'Day ' + totalDays,
      'last-date': formatDay(endDay, true)
    };

    Object.keys(values).forEach(function (key) {
      $$('[data-schedule="' + key + '"]').forEach(function (el) {
        el.textContent = values[key];
      });
    });
  }

  /* ------------------------------------------------------------- week strip
     One column per day of the configured week, so the strip above the
     schedule follows config.js the same way the day labels below it do. */
  function initWeek() {
    var strip = $('#week');
    var days = $('#week-days');
    if (!strip || !days || !startDay || totalDays < 3) return;

    strip.style.setProperty('--days', String(totalDays));
    days.textContent = '';

    for (var n = 0; n < totalDays; n++) {
      var date = new Date(startDay.getTime() + n * DAY);
      var weekday;
      try {
        weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(date);
      } catch (e) {
        weekday = 'Day ' + (n + 1);
      }

      var cell = document.createElement('li');
      var dow = document.createElement('span');
      var num = document.createElement('span');
      cell.className = 'week__day';
      dow.className = 'week__dow';
      num.className = 'week__num';
      dow.textContent = weekday;
      num.textContent = String(date.getUTCDate());
      cell.appendChild(dow);
      cell.appendChild(num);
      days.appendChild(cell);
    }
  }

  /* --------------------------------------------------------------- accordion */
  function initAccordion() {
    var triggers = $$('.faq__trigger');
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var item = trigger.closest('.faq__item');
        var open = trigger.getAttribute('aria-expanded') === 'true';

        triggers.forEach(function (other) {
          if (other === trigger) return;
          other.setAttribute('aria-expanded', 'false');
          var otherItem = other.closest('.faq__item');
          if (otherItem) otherItem.classList.remove('is-open');
        });

        trigger.setAttribute('aria-expanded', String(!open));
        if (item) item.classList.toggle('is-open', !open);
      });
    });
  }

  /* ------------------------------------------------------------ social links */
  function initSocial() {
    var list = $('#footer-socials');
    if (!list) return;

    var configured = CONFIG.social || {};
    var any = false;

    $$('[data-social]', list).forEach(function (item) {
      var key = item.getAttribute('data-social');
      var url = configured[key];
      if (url) {
        var link = $('a', item);
        if (link) link.href = url;
        any = true;
      } else {
        item.remove();
      }
    });

    if (any) list.hidden = false;
    else list.remove();
  }

  /* ------------------------------------------------------------- mail links
     Contact links open a Gmail compose window in a new tab, addressed to the
     inbox set in config.js. */
  function gmailCompose(address, subject) {
    return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(address) +
      (subject ? '&su=' + encodeURIComponent(subject) : '');
  }

  function initMailLinks() {
    var contact = CONFIG.contact || {};
    $$('[data-mail]').forEach(function (el) {
      var key = el.getAttribute('data-mail');
      var address = contact[key] || contact.general;
      if (!address) return;
      el.href = gmailCompose(address, el.getAttribute('data-mail-subject'));
      el.target = '_blank';
      el.rel = 'noopener';
      if (el.hasAttribute('data-mail-text')) el.textContent = address;
    });
  }

  /* ------------------------------------------------------------ text from config */
  function initTextFromConfig() {
    $$('[data-event-date]').forEach(function (el) {
      if (EVENT.dateLabel) el.textContent = EVENT.dateLabel;
    });
    $$('[data-event-officehours]').forEach(function (el) {
      if (EVENT.officeHours) el.textContent = EVENT.officeHours;
    });
    $$('[data-event-days]').forEach(function (el) {
      if (totalDays > 0) el.textContent = String(totalDays);
    });
  }

  /* ------------------------------------------------------------ waitlist form */
  function initForm() {
    var form = $('#waitlist-form');
    if (!form) return;

    var status = $('#form-status');
    var submit = $('#form-submit');
    var label = $('.btn__label', submit);
    var endpoint = CONFIG.waitlistEndpoint || '';
    var mode = CONFIG.waitlistMode === 'json' ? 'json' : 'apps-script';
    var contact = CONFIG.contact || {};

    if (!endpoint && window.console && console.warn) {
      console.warn('[Hack The Cure] waitlistEndpoint is empty in js/config.js, so the form ' +
        'cannot save sign-ups yet. See README.md -> "Connect the form".');
    }

    var rules = {
      name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your full name.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'; },
      country: function (v) { return v.trim().length >= 2 ? '' : 'Please tell us where you are based.'; },
      role: function (v) { return v ? '' : 'Please choose an option.'; },
      consent: function (v, field) { return field.checked ? '' : 'Please confirm you would like updates.'; }
    };

    function setFieldError(field, message) {
      var holder = document.getElementById('error-' + field.name);
      if (holder) holder.textContent = message;
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }

    function validate() {
      var firstInvalid = null;
      Object.keys(rules).forEach(function (name) {
        var field = form.elements[name];
        if (!field) return;
        var message = rules[name](field.value, field);
        setFieldError(field, message);
        if (message && !firstInvalid) firstInvalid = field;
      });
      return firstInvalid;
    }

    form.addEventListener('input', function (e) {
      var field = e.target;
      if (!field.name || !rules[field.name]) return;
      if (field.getAttribute('aria-invalid') !== 'true' && field.type !== 'checkbox') return;
      setFieldError(field, rules[field.name](field.value, field));
    });

    function setLoading(on) {
      submit.classList.toggle('is-loading', on);
      submit.setAttribute('aria-busy', String(on));
      submit.disabled = on;
      if (label) label.textContent = on ? 'Sending…' : 'Count me in';
      var spinner = $('.btn__spinner', submit);
      if (on && !spinner) {
        spinner = document.createElement('span');
        spinner.className = 'btn__spinner';
        submit.insertBefore(spinner, submit.firstChild);
      } else if (!on && spinner) {
        spinner.remove();
      }
    }

    function showStatus(state, message, withEmailLink) {
      if (!status) return;
      var text = $('.form__status-text', status);
      status.hidden = false;
      status.setAttribute('data-state', state);
      text.textContent = message;

      /* A link the visitor can choose to click. It opens Gmail in a new tab;
         we never open it on their behalf. */
      if (withEmailLink && contact.general) {
        var link = document.createElement('a');
        link.className = 'text-link';
        link.href = gmailCompose(contact.general);
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = contact.general;
        text.appendChild(document.createTextNode(' '));
        text.appendChild(link);
      }
      status.focus();
    }

    function payload() {
      var data = {};
      ['name', 'email', 'country', 'role', 'track'].forEach(function (key) {
        var field = form.elements[key];
        if (field) data[key] = field.value.trim();
      });
      data.submittedAt = new Date().toISOString();
      data.source = 'hackthecure.world';
      return data;
    }

    function send(data) {
      var body = JSON.stringify(data);

      /* Apps Script web apps cannot answer a CORS preflight, so the request
         has to stay "simple": text/plain, no custom headers. The script
         parses e.postData.contents as JSON. */
      var options = mode === 'json'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body }
        : { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body };

      return fetch(endpoint, options).then(function (response) {
        if (!response.ok) throw new Error('Request failed with status ' + response.status);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (status) status.hidden = true;

      var firstInvalid = validate();
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      if (!endpoint) {
        showStatus('error', 'Sign-ups are not connected yet. Please email us and we will add you:', true);
        return;
      }

      var data = payload();
      setLoading(true);

      send(data).then(function () {
        form.reset();
        showStatus('success',
          'You are on the list. Everything you need will go to ' + data.email + ' before the event.');
      }).catch(function () {
        showStatus('error', 'Something went wrong on our end. Please email us and we will add you by hand:', true);
      }).then(function () {
        setLoading(false);
      });
    });
  }

  /* ------------------------------------------------------ shared helpers */
  function flash(el) {
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;            /* restart the animation */
    el.classList.add('is-flash');
    window.setTimeout(function () { el.classList.remove('is-flash'); }, 1700);
  }

  function scrollToEl(el, block) {
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: block || 'start' });
  }

  /* ------------------------------------------------------- track reel
     Pins the tracks section and swaps one track for the next as you scroll
     past it. Only runs on wide screens with motion allowed; everywhere else
     the six panels stay a plain readable stack, which is also what you get
     with JavaScript switched off. */
  function initTrackReel() {
    var reel = $('#trackreel');
    if (!reel) return;

    var stage = $('.trackreel__stage', reel);
    var panels = $$('.trackpanel', reel);
    var pips = $$('.trackreel__pip', reel);
    if (!stage || panels.length < 2) return;

    var count = panels.length;
    var wide = window.matchMedia('(min-width: 881px)');
    var tall = window.matchMedia('(min-height: 620px)');
    var pinned = false;
    var index = -1;
    var ticking = false;

    reel.style.setProperty('--reel-count', String(count));

    function setIndex(next) {
      next = Math.max(0, Math.min(count - 1, next));
      if (next === index) return;
      index = next;
      panels.forEach(function (panel, n) { panel.classList.toggle('is-active', n === next); });
      pips.forEach(function (pip, n) {
        if (n === next) pip.setAttribute('aria-current', 'true');
        else pip.removeAttribute('aria-current');
      });
    }

    function scrollSpan() {
      return reel.offsetHeight - stage.offsetHeight;
    }

    function update() {
      ticking = false;
      if (!pinned) return;
      var span = scrollSpan();
      if (span <= 0) return;
      var progress = -reel.getBoundingClientRect().top / span;
      progress = Math.min(Math.max(progress, 0), 0.99999);
      setIndex(Math.floor(progress * count));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    /* Lands in the middle of a track's slice, so it is not sitting on the
       boundary where the next one takes over. */
    function goTo(n) {
      var panel = panels[n];
      if (!panel) return;

      if (!pinned) {
        panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        flash(panel);
        return;
      }

      var span = scrollSpan();
      var top = reel.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: Math.round(top + span * ((n + 0.5) / count)),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
      setIndex(n);
    }

    function setPinned(on) {
      if (on === pinned) return;
      pinned = on;
      reel.classList.toggle('is-pinned', on);
      if (on) {
        index = -1;
        update();
      } else {
        index = -1;
        panels.forEach(function (panel) { panel.classList.remove('is-active'); });
        pips.forEach(function (pip) { pip.removeAttribute('aria-current'); });
      }
    }

    pips.forEach(function (pip) {
      pip.addEventListener('click', function () {
        goTo(parseInt(pip.getAttribute('data-goto'), 10) || 0);
      });
    });

    /* The badges in the hero illustration point at #track-N. Route them
       through goTo so they land on the right slice of the pinned section
       instead of jumping to a panel that is currently faded out. */
    $$('a[href^="#track-"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.getElementById(link.getAttribute('href').slice(1));
        if (!target) return;
        var n = parseInt(target.getAttribute('data-index'), 10);
        if (isNaN(n)) return;
        e.preventDefault();
        goTo(n);
      });
    });

    function evaluate() {
      setPinned(wide.matches && tall.matches && !reduceMotion);
      if (pinned) update();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', evaluate);
    wide.addEventListener('change', evaluate);
    tall.addEventListener('change', evaluate);
    evaluate();
  }

  /* -------------------------------------------------------------- footer year */
  function initYear() {
    var el = $('#year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function init() {
    initNavState();
    initMobileMenu();
    initSectionHighlight();
    initReveal();
    initCountdown();
    initCalendar();
    initSchedule();
    initWeek();
    initAccordion();
    initTrackReel();
    initSocial();
    initMailLinks();
    initTextFromConfig();
    initForm();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

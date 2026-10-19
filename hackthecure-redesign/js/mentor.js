/* ==========================================================================
   Hack The Cure mentor registration
   Builds the office-hours picker from the event dates in config.js, checks
   the form, shrinks the photo in the browser, and posts everything to the
   same Google Apps Script as the sign-up form (type: 'mentor').
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = window.HTC_CONFIG || {};
  var EVENT = CONFIG.event || {};
  var DAY = 86400000;
  var EASTERN = 'America/New_York';
  var TRACKS = [
    'Disease Detection & Prevention',
    'Health Education & Misinformation',
    'Healthcare Access & Equity',
    'Maternal, Child & Reproductive Health',
    'Nutrition & Food Security',
    'Environmental Development'
  ];

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  var form = $('#mentor-form');
  if (!form) return;

  if (EVENT.dateLabel) $$('[data-event-date]').forEach(function (el) { el.textContent = EVENT.dateLabel; });

  /* ---------------------------------------------------------------- dates */
  var days = [];
  (function () {
    var start = new Date((EVENT.startDate || '2026-12-27') + 'T00:00:00Z');
    var end = new Date((EVENT.endDate || '2027-01-03') + 'T00:00:00Z');
    for (var t = start.getTime(); t <= end.getTime(); t += DAY) {
      var d = new Date(t);
      days.push({
        y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(),
        label: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(d)
      });
    }
  })();

  /* --------------------------------------------------------------- tracks */
  ['#m-first', '#m-second'].forEach(function (sel) {
    var select = $(sel);
    TRACKS.forEach(function (name) {
      var option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  });

  /* ------------------------------------------------------------ time zone */
  /* Minutes ahead of UTC that a time zone is at a given moment. */
  function offsetMinutes(instant, tz) {
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(instant).forEach(function (p) { parts[p.type] = p.value; });
    var asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return Math.round((asUtc - instant.getTime()) / 60000);
  }

  /* The real moment that "y-m-d h:00" on a wall clock in tz refers to. */
  function zonedToInstant(y, m, d, h, tz) {
    var guess = Date.UTC(y, m, d, h);
    var off = offsetMinutes(new Date(guess), tz);
    var t = guess - off * 60000;
    var off2 = offsetMinutes(new Date(t), tz);
    if (off2 !== off) t = guess - off2 * 60000;
    return new Date(t);
  }

  function offsetLabel(tz) {
    var ref = days.length ? new Date(Date.UTC(days[0].y, days[0].m, days[0].d, 12)) : new Date();
    var mins = offsetMinutes(ref, tz);
    var sign = mins < 0 ? '−' : '+';
    var abs = Math.abs(mins);
    var hh = String(Math.floor(abs / 60)).padStart(2, '0');
    var mm = String(abs % 60).padStart(2, '0');
    return 'UTC' + sign + hh + ':' + mm;
  }

  var tzSelect = $('#m-tz');
  var localTz = 'UTC';
  try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* keep UTC */ }
  var zones;
  try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { zones = null; }
  if (!zones || !zones.length) {
    zones = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
      'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo', 'Europe/London',
      'Europe/Paris', 'Africa/Lagos', 'Africa/Nairobi', 'Asia/Dubai', 'Asia/Kolkata',
      'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
  }
  if (zones.indexOf(localTz) === -1) zones = [localTz].concat(zones);
  zones.forEach(function (tz) {
    var option = document.createElement('option');
    option.value = tz;
    try { option.textContent = tz.replace(/_/g, ' ') + ' (' + offsetLabel(tz) + ')'; }
    catch (e) { option.textContent = tz; }
    if (tz === localTz) option.selected = true;
    tzSelect.appendChild(option);
  });

  /* --------------------------------------------------------- hours picker */
  var sameBox = $('#m-same');
  var hoursRoot = $('#m-hours');
  var everyDay = {};                                  /* hour -> true */
  var perDay = days.map(function () { return {}; });

  function hourText(h) {
    var suffix = h < 12 ? 'a' : 'p';
    var twelve = h % 12 === 0 ? 12 : h % 12;
    return twelve + suffix;
  }
  function hourLong(h) {
    var f = function (x) { var s = x % 24 < 12 ? 'am' : 'pm'; var t = x % 12 === 0 ? 12 : x % 12; return t + ' ' + s; };
    return f(h) + ' to ' + f(h + 1);
  }

  /* Drag to paint: the first cell you press decides on or off. */
  var painting = null;
  document.addEventListener('pointerup', function () { painting = null; });

  function buildBlock(label, store) {
    var block = document.createElement('div');
    block.className = 'hours__day';

    var head = document.createElement('p');
    head.className = 'hours__label';
    var name = document.createElement('span');
    name.textContent = label;
    var count = document.createElement('span');
    count.className = 'hours__count';
    head.appendChild(name);
    head.appendChild(count);

    var grid = document.createElement('div');
    grid.className = 'hours__grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', label);

    function refreshCount() {
      var n = Object.keys(store).length;
      count.textContent = n ? n + (n === 1 ? ' hour' : ' hours') : 'none yet';
      count.classList.toggle('is-good', n >= 2 && n <= 3);
    }

    for (var h = 0; h < 24; h++) {
      (function (hour) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'hours__cell';
        cell.textContent = hourText(hour);
        cell.setAttribute('aria-label', label + ', ' + hourLong(hour));
        cell.setAttribute('aria-pressed', store[hour] ? 'true' : 'false');

        function set(on) {
          if (on) store[hour] = true; else delete store[hour];
          cell.setAttribute('aria-pressed', on ? 'true' : 'false');
          refreshCount();
        }
        cell.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          painting = !store[hour];
          set(painting);
        });
        cell.addEventListener('pointerenter', function () {
          if (painting !== null) set(painting);
        });
        cell.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!store[hour]); }
        });
        grid.appendChild(cell);
      })(h);
    }

    refreshCount();
    block.appendChild(head);
    block.appendChild(grid);
    return block;
  }

  function renderHours() {
    hoursRoot.textContent = '';
    if (sameBox.checked) {
      hoursRoot.appendChild(buildBlock('Every day', everyDay));
    } else {
      days.forEach(function (day, i) { hoursRoot.appendChild(buildBlock(day.label, perDay[i])); });
    }
  }

  sameBox.addEventListener('change', function () {
    /* Switching to per-day starts each day from the every-day pattern. */
    if (!sameBox.checked) {
      perDay = days.map(function (day, i) {
        return Object.keys(perDay[i]).length ? perDay[i] : Object.assign({}, everyDay);
      });
    }
    renderHours();
  });
  renderHours();

  function hoursFor(i) {
    var store = sameBox.checked ? everyDay : perDay[i];
    return Object.keys(store).map(Number).sort(function (a, b) { return a - b; });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ranges(list) {
    var out = [];
    list.forEach(function (h) {
      var last = out[out.length - 1];
      if (last && last[1] === h) last[1] = h + 1;
      else out.push([h, h + 1]);
    });
    return out.map(function (r) { return pad(r[0]) + ':00–' + pad(r[1] % 24) + ':00'; }).join(', ');
  }

  /* Office hours as text, in the mentor's zone and converted to Eastern. */
  function summarise(tz) {
    var local = [], perDayCounts = [], eastern = {}, order = [];
    days.forEach(function (day, i) {
      var list = hoursFor(i);
      perDayCounts.push(day.label + ': ' + list.length);
      if (!list.length) return;
      local.push(day.label + ': ' + ranges(list));
      list.forEach(function (h) {
        var instant = zonedToInstant(day.y, day.m, day.d, h, tz);
        var key = new Intl.DateTimeFormat('en-GB', { timeZone: EASTERN, weekday: 'short', day: 'numeric', month: 'short' }).format(instant);
        var hour = +new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, hour: '2-digit', hourCycle: 'h23' }).format(instant) % 24;
        if (!eastern[key]) { eastern[key] = []; order.push(key); }
        if (eastern[key].indexOf(hour) === -1) eastern[key].push(hour);
      });
    });
    return {
      local: local.join('; '),
      eastern: order.map(function (key) {
        return key + ': ' + ranges(eastern[key].sort(function (a, b) { return a - b; }));
      }).join('; '),
      counts: sameBox.checked ? 'Every day: ' + Object.keys(everyDay).length : perDayCounts.join('; ')
    };
  }

  /* ---------------------------------------------------- contact method */
  var method = $('#m-method');
  var contactField = $('#m-contact-field');
  var contactLabel = $('#m-contact-label');
  var contactInput = $('#m-contact');
  var contactHints = {
    'A different email': ['Email address', 'email'],
    'Discord': ['Discord username', 'text'],
    'Phone or text': ['Phone number, with country code', 'tel'],
    'WhatsApp': ['WhatsApp number, with country code', 'tel']
  };
  function updateContact() {
    var hint = contactHints[method.value];
    contactField.hidden = !hint;
    if (hint) {
      contactLabel.textContent = hint[0];
      contactInput.type = hint[1];
    }
  }
  method.addEventListener('change', updateContact);
  updateContact();

  /* ---------------------------------------------------------------- photo */
  var photoInput = $('#m-photo');
  var photoPreview = $('#m-photo-preview');
  var photoData = '';

  /* Shrinks the photo to 600px on its longest side as a JPEG, so the upload
     stays small however large the original is. */
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }

  photoInput.addEventListener('change', function () {
    var file = photoInput.files && photoInput.files[0];
    setError('photo', '');
    photoData = '';
    photoPreview.style.backgroundImage = '';
    photoPreview.classList.remove('has-photo');
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setError('photo', 'That photo is over 15 MB. Please choose a smaller one.'); photoInput.value = ''; return; }
    shrinkPhoto(file).then(function (dataUrl) {
      photoData = dataUrl;
      photoPreview.style.backgroundImage = 'url("' + dataUrl + '")';
      photoPreview.classList.add('has-photo');
    }).catch(function () {
      setError('photo', 'We could not read that file. Please choose a JPG or PNG photo.');
      photoInput.value = '';
    });
  });

  /* ----------------------------------------------------------- validation */
  function setError(name, message) {
    var holder = document.getElementById('m-error-' + name);
    if (holder) holder.textContent = message;
    var field = form.elements[name];
    if (field && field.setAttribute) {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
  }

  function totalHours() {
    if (sameBox.checked) return Object.keys(everyDay).length;
    return perDay.reduce(function (sum, store) { return sum + Object.keys(store).length; }, 0);
  }

  function validate() {
    var v = function (n) { return (form.elements[n].value || '').trim(); };
    var checks = [
      ['name', v('name').length >= 2 ? '' : 'Please enter your full name.'],
      ['email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')) ? '' : 'Please enter a valid email address.'],
      ['organisation', v('organisation').length >= 2 ? '' : 'Please tell us your university or workplace.'],
      ['linkedin', !v('linkedin') || /linkedin\.com\//i.test(v('linkedin')) ? '' : 'That does not look like a LinkedIn link.'],
      ['firstChoice', v('firstChoice') ? '' : 'Please choose your first choice.'],
      ['secondChoice', !v('secondChoice') ? 'Please choose your second choice.' :
        v('secondChoice') === v('firstChoice') ? 'Please choose a different track from your first choice.' : ''],
      ['hours', totalHours() ? '' : 'Please select at least one hour when you could hold office hours.'],
      ['contact', contactField.hidden || v('contact').length >= 2 ? '' : 'Please tell us where to reach you.']
    ];
    var first = null;
    checks.forEach(function (c) {
      setError(c[0], c[1]);
      if (c[1] && !first) first = c[0] === 'hours' ? hoursRoot.querySelector('button') : form.elements[c[0]];
    });
    return first;
  }

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') validate();
  });

  /* --------------------------------------------------------------- submit */
  var status = $('#m-status');
  var submit = $('#m-submit');
  var label = $('.btn__label', submit);
  var endpoint = CONFIG.waitlistEndpoint || '';

  function showStatus(state, message) {
    status.hidden = false;
    status.setAttribute('data-state', state);
    $('.form__status-text', status).textContent = message;
    status.focus();
  }

  function setLoading(on) {
    submit.disabled = on;
    submit.classList.toggle('is-loading', on);
    label.textContent = on ? 'Sending…' : 'Register as a mentor';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.hidden = true;

    var firstInvalid = validate();
    if (firstInvalid) {
      if (firstInvalid.focus) firstInvalid.focus();
      return;
    }
    if (!endpoint) {
      showStatus('error', 'Mentor registration is not connected yet. Please email hackthecureoutreach@gmail.com.');
      return;
    }

    var tz = tzSelect.value;
    var hours = summarise(tz);
    var value = function (n) { return (form.elements[n].value || '').trim(); };
    var payload = {
      type: 'mentor',
      submittedAt: new Date().toISOString(),
      name: value('name'),
      email: value('email'),
      organisation: value('organisation'),
      linkedin: value('linkedin'),
      firstChoice: value('firstChoice'),
      secondChoice: value('secondChoice'),
      timezone: tz + ' (' + offsetLabel(tz) + ')',
      sameEveryDay: sameBox.checked,
      hoursLocal: hours.local,
      hoursEastern: hours.eastern,
      hoursPerDay: hours.counts,
      contactMethod: method.value,
      contact: contactField.hidden ? value('email') : value('contact'),
      photo: photoData ? photoData.split(',')[1] : ''
    };

    setLoading(true);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('status ' + response.status);
      return response.json().catch(function () { return { ok: true }; });
    }).then(function (result) {
      if (result && result.ok === false) throw new Error(result.error || 'rejected');
      form.reset();
      everyDay = {};
      perDay = days.map(function () { return {}; });
      photoData = '';
      photoPreview.style.backgroundImage = '';
      photoPreview.classList.remove('has-photo');
      sameBox.checked = true;
      tzSelect.value = tz;
      updateContact();
      renderHours();
      showStatus('success', 'Thank you! You are registered as a mentor. We will email ' + payload.email + ' soon to confirm your track and hours.');
    }).catch(function () {
      showStatus('error', 'Something went wrong on our end. Please try again, or email hackthecureoutreach@gmail.com.');
    }).then(function () {
      setLoading(false);
    });
  });
})();

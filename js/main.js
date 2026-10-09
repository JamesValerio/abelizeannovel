// Forms (Kit signup and reader feedback) post to their service inside a
// hidden iframe, then a message is shown without leaving the page.
document.querySelectorAll('form[data-ajax]').forEach(function (form) {
  var frame = document.querySelector('iframe[name="' + form.target + '"]');
  var msg = form.querySelector('.msg');
  var waiting = false;
  form.addEventListener('submit', function () {
    waiting = true;
    if (msg) msg.textContent = 'Sending...';
  });
  if (frame) {
    frame.addEventListener('load', function () {
      if (!waiting) return;
      waiting = false;
      if (msg) msg.textContent = form.getAttribute('data-success');
      form.reset();
    });
  }
});

// Reader reviews: the manual list in js/reviews.js, plus approved rows from
// the Google Sheet when REVIEWS_URL is set in js/config.js.
(function () {
  var url = window.BACKEND_URL || window.REVIEWS_URL || '';
  var form = document.querySelector('form[data-reviews-form]');
  if (form && url) {
    form.action = url;
    ['access_key', 'subject', 'from_name'].forEach(function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      if (el) el.remove();
    });
  }

  function render(data) {
    document.querySelectorAll('[data-reviews]').forEach(function (box) {
      box.innerHTML = '';
      if (!data.length) return;
      var limit = parseInt(box.getAttribute('data-limit'), 10) || data.length;
      var empty = box.parentNode.querySelector('[data-empty]');
      if (empty) empty.hidden = true;
      data.slice(0, limit).forEach(function (r) {
        var q = document.createElement('blockquote');
        q.className = 'review';
        var p = document.createElement('p');
        p.textContent = '\u201C' + r.text + '\u201D';
        var w = document.createElement('div');
        w.className = 'who';
        w.textContent = '\u2014 ' + (r.name || 'A reader');
        q.appendChild(p);
        q.appendChild(w);
        box.appendChild(q);
      });
    });
  }

  var local = window.REVIEWS || [];
  render(local);
  if (url) {
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (rows) { render((rows || []).concat(local)); })
      .catch(function () {});
  }
})();

// Referral program (needs BACKEND_URL in js/config.js).
(function () {
  var base = window.BACKEND_URL || window.REVIEWS_URL || '';
  var params = new URLSearchParams(location.search);

  // Signup form on read-free.html
  var join = document.querySelector('form[data-join]');
  if (join && base) {
    join.action = base;
    var ref = (params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (ref) {
      var h = document.createElement('input');
      h.type = 'hidden'; h.name = 'ref'; h.value = ref;
      join.appendChild(h);
      var note = document.querySelector('[data-ref-note]');
      if (note) note.hidden = false;
    }
    join.setAttribute('data-success', 'Check your email! Open the link we sent to confirm and get your invite link. If it is not in your inbox in a minute, check your spam or junk folder and mark it "Not spam".');
    document.querySelectorAll('[data-join-only]').forEach(function (el) { el.hidden = false; });
  }

  // Private chapter page (chapter.html)
  var cp = document.querySelector('[data-chapter-page]');
  if (cp) {
    var cstate = cp.querySelector('[data-state]');
    var cbody = cp.querySelector('[data-body]');
    var cn = parseInt(params.get('n'), 10);
    var ctk = params.get('t') || '';
    document.querySelectorAll('[data-back]').forEach(function (a) { a.href = 'stars.html?t=' + encodeURIComponent(ctk); });
    var deviceId = function () {
      try {
        var v = localStorage.getItem('jvdev');
        if (!v) { v = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('jvdev', v); }
        return v;
      } catch (e) { return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
    };
    if (!base || !ctk || !cn) { cstate.textContent = 'Open your chapter from your reader page.'; return; }
    fetch(base + '?action=chapter&t=' + encodeURIComponent(ctk) + '&n=' + cn + '&d=' + encodeURIComponent(deviceId()))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) {
          var msgs = {
            locked: 'This chapter is not unlocked yet. You need ' + (d.need - d.stars) + ' more star(s). Share your invite link from your reader page to earn them.',
            soon: 'This chapter is coming soon. We will email you when it is ready.',
            device: 'This link has already been used on other devices. Sign up again on the Unlock Free Chapters page and we will email you a fresh link.'
          };
          cstate.textContent = msgs[d.reason] || 'This link is not valid. Sign up again on the Unlock Free Chapters page to get a new one.';
          return;
        }
        cstate.hidden = true;
        document.title = 'Chapter ' + d.n + ': ' + d.title + ' | The Hidden Secret of the Young Village Girls';
        var h1 = document.querySelector('.page-title h1');
        if (h1) h1.textContent = 'Chapter ' + d.n + ': ' + d.title;
        cbody.innerHTML = d.html + '<p class="end">End of Chapter ' + d.n + '</p>';
        cbody.hidden = false;
        document.querySelectorAll('[data-after]').forEach(function (el) { el.hidden = false; });
        var lead = document.querySelector('[data-lead]');
        if (lead && d.n >= 4) lead.textContent = 'That is the last free chapter. Get the whole story on Amazon.';
        document.querySelectorAll('[data-chapter-field]').forEach(function (i) { i.value = d.n; });
        var subj = document.querySelector('input[name="subject"]');
        if (subj) subj.value = 'Chapter ' + d.n + ' feedback: The Hidden Secret of the Young Village Girls';
        var wm = document.querySelector('[data-wm]');
        if (wm) {
          var esc = String(d.email).replace(/&/g, '&amp;').replace(/</g, '&lt;');
          var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><text x="20" y="130" transform="rotate(-24 180 110)" font-family="sans-serif" font-size="16" fill="rgba(128,128,128,0.16)">' + esc + '</text></svg>';
          wm.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
        }
      })
      .catch(function () { cstate.textContent = 'Something went wrong. Please try again in a moment.'; });
    return;
  }

  // Star page (stars.html)
  var box = document.querySelector('[data-stars]');
  if (!box) return;
  var state = box.querySelector('[data-state]');
  var content = box.querySelector('[data-content]');
  var t = params.get('t') || '';
  if (!base) { state.textContent = 'This page is not set up yet.'; return; }
  if (!t) { state.textContent = 'Open the link from your email to see your stars.'; return; }
  fetch(base + '?action=verify&t=' + encodeURIComponent(t))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) {
        state.textContent = 'This link is not valid. Sign up again on the Unlock Free Chapters page and we will email you a new one.';
        return;
      }
      state.hidden = true;
      content.hidden = false;
      var per = d.per || 10, top = per * 4;
      var target = d.stars >= top ? top : (Math.floor(d.stars / per) + 1) * per;
      box.querySelector('[data-count]').textContent = d.stars;
      box.querySelector('[data-needed]').textContent = target;
      box.querySelector('[data-bar]').style.width = (d.stars >= top ? 100 : (d.stars % per) / per * 100) + '%';
      var list = box.querySelector('[data-chapters]');
      var titles = { 1: 'Mary\u2019s First Love', 2: 'Mary\u2019s Love and Curiosity', 3: 'The Return to the Village', 4: 'Paul Confesses His Love to Mary' };
      for (var n = 1; n <= 4; n++) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.textContent = 'Chapter ' + n + ': ' + titles[n];
        li.appendChild(name);
        var need = n * per, open = d.stars >= need, right;
        if (open && (d.available || []).indexOf(n) >= 0) {
          right = document.createElement('a');
          right.className = 'btn p';
          right.textContent = 'Read';
          right.href = 'chapter.html?n=' + n + '&t=' + encodeURIComponent(t);
        } else {
          right = document.createElement('span');
          right.className = 'lock';
          right.textContent = open ? 'Unlocked, coming soon' : (need - d.stars) + ' more star' + (need - d.stars === 1 ? '' : 's') + ' to unlock';
        }
        li.appendChild(right);
        list.appendChild(li);
      }
      var input = box.querySelector('[data-link]');
      input.value = d.link;
      box.querySelector('[data-copy]').addEventListener('click', function () {
        input.select();
        if (navigator.clipboard) navigator.clipboard.writeText(d.link); else document.execCommand('copy');
        this.textContent = 'Copied!';
      });
      box.querySelector('[data-wa]').href = 'https://wa.me/?text=' + encodeURIComponent(
        'I am reading "The Hidden Secret of the Young Village Girls", a Belizean novel. Unlock free chapters here: ' + d.link);
    })
    .catch(function () { state.textContent = 'Something went wrong. Please try again in a moment.'; });
})();

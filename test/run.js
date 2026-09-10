'use strict';
//
// Test runner for index.html.
//
// The page has no build step and no module system — it is one file meant to be
// pasteable into a real dealer site — so there is nothing to import. Instead we
// extract its inline <script> blocks, run them in a VM context against stubs
// for the browser APIs they touch, and assert against the page's own globals.
//
// That means these tests exercise the shipped code verbatim. Nothing is
// duplicated or reimplemented here, so the suites cannot drift from the page.
//
// Usage:  node test/run.js            run every suite
//         node test/run.js atnid      run suites whose name matches
//
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PAGE = path.join(__dirname, '..', 'index.html');

function inlineScripts(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

// Stand-ins for the browser APIs the page uses. Deliberately minimal — enough
// to drive the logic, not a DOM implementation.
const STUBS = `
var __state = { store: {}, painted: '', observerCb: null };
globalThis.sessionStorage = {
  getItem: function (k) { return k in __state.store ? __state.store[k] : null; },
  setItem: function (k, v) { __state.store[k] = String(v); },
  removeItem: function (k) { delete __state.store[k]; }
};
globalThis.location = { search: '' };
globalThis.addEventListener = function () {};
globalThis.window = globalThis;   // the same object in a browser, and the
                                  // global site tag's window.dataLayer = ...
                                  // depends on that being true
globalThis.document = {
  getElementById: function (id) {
    if (id === 'log-body') return { set innerHTML(v) { __state.painted = v; } };
    return null;                  // the panel's other nodes are not needed
  },
  querySelectorAll: function () { return []; }
};
globalThis.performance = { setResourceTimingBufferSize: function () {} };
globalThis.PerformanceObserver = function (cb) {
  __state.observerCb = cb;
  this.observe = function () {};
};
`;

// Helpers that reach into the page's own globals, so they load after it.
const HELPERS = `
// Feed a resource entry the way the real PerformanceObserver would.
function seeResource(url) {
  if (!__state.observerCb) throw new Error('page registered no PerformanceObserver');
  __state.observerCb({ getEntries: function () { return [{ name: url }]; } });
}

// Simulate a fresh page load at a given URL, optionally with an ATNID already
// in session storage from an earlier page in the same tab.
function land(search, session) {
  __state.store = {};
  if (session) __state.store[ATNID_KEY] = session;
  location.search = search || '';
  ATNID = captureAtnid();
  return ATNID;
}

function painted() { return __state.painted; }
function lastGtagParams() { return dataLayer[dataLayer.length - 1][2]; }
function newestRow() { return readLog()[0]; }
function mismatches(row) {
  return row.wire.checks.filter(function (c) { return !c.ok; });
}
function checkedKeys(row) {
  return row.wire.checks.map(function (c) { return c.key; }).join(',');
}
// Pin Date.now so nonce timestamps are predictable.
function freezeClock(ms) { Date.now = function () { return ms; }; }
`;

function runSuite(file, scripts) {
  const results = [];
  let section = '(top)';
  const t = {
    section: function (name) { section = name; results.push({ heading: name }); },
    check: function (name, got, want) {
      const ok = String(got) === String(want);
      results.push({ name: name, ok: ok, got: got, want: want, section: section });
      return ok;
    },
    ok: function (name, cond) { return t.check(name, !!cond, true); }
  };

  const sandbox = { console: console, t: t };
  vm.createContext(sandbox);
  const src = [
    STUBS,
    scripts.join('\n'),
    HELPERS,
    fs.readFileSync(file, 'utf8')
  ].join('\n');

  try {
    vm.runInContext(src, sandbox, { filename: path.basename(file) });
  } catch (err) {
    results.push({ name: 'suite threw: ' + err.message, ok: false, got: 'throw', want: 'no throw' });
  }
  return results;
}

function main() {
  const filter = process.argv[2];
  const html = fs.readFileSync(PAGE, 'utf8');
  const scripts = inlineScripts(html);

  if (scripts.length < 2) {
    console.error('Expected at least 2 inline script blocks in index.html, found ' +
                  scripts.length + '. Has the page structure changed?');
    process.exit(1);
  }

  let suites = fs.readdirSync(__dirname)
    .filter(function (f) { return /^suite-.*\.js$/.test(f); })
    .sort();
  if (filter) {
    suites = suites.filter(function (f) { return f.indexOf(filter) !== -1; });
    if (!suites.length) {
      console.error('No suite matched "' + filter + '"');
      process.exit(1);
    }
  }

  let pass = 0, fail = 0;
  for (const s of suites) {
    console.log('\n=== ' + s + ' ===');
    for (const r of runSuite(path.join(__dirname, s), scripts)) {
      if (r.heading) { console.log('\n  ' + r.heading); continue; }
      if (r.ok) { pass++; console.log('    ok   ' + r.name); }
      else {
        fail++;
        console.log('    FAIL ' + r.name);
        console.log('           got:  ' + r.got);
        console.log('           want: ' + r.want);
      }
    }
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main();

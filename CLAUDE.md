# atnid-testing

A static CM360 Floodlight sandbox served by GitHub Pages. `index.html` is the
whole application: a fake Honda dealer page carrying the real global site tag
for advertiser `DC-17198395`, plus a self-verifying fire log.

Read `README.md` first — it documents the u-vars, the ATNID flow, the CM360
dynamic tag, and the `ord` deduplication behaviour. This file covers how to
work on the repo.

## Publishing

Pages serves `main` at the repo root (legacy build, HTTPS enforced), so work
goes **directly on `main`** — a feature branch would not publish. A push is a
publish to a public URL; treat it as outward-facing and get explicit sign-off.

After pushing, verify rather than assume:

```sh
gh api repos/rob-atn/atnid-testing/pages/builds/latest --jq '.status + " " + .commit'
curl -s https://rob-atn.github.io/atnid-testing/ > /tmp/live.html
diff -u index.html /tmp/live.html && echo "live matches HEAD"
```

A 200 only proves *something* is served. Diff against HEAD, and check the
build did not error rather than reading silence as success.

`.nojekyll` keeps Pages from running Jekyll over the files. Leave it.

## House style in index.html

- **No build step, no dependencies, no framework.** Everything is inline in
  one file. Keep it that way; the page has to be pasteable into a real dealer
  site as a reference.
- **ES5-flavoured** (`var`, `function`, no arrow functions or template
  literals). It mirrors what tag-management environments tolerate.
- The global site tag block between the `Start/End of global snippet` comments
  is vendor-provided. Keep those comments and its shape intact.
- The panel paints data observed from network requests, so **everything
  rendered goes through `esc()`**. Do not build innerHTML from raw values.

## Testing

There is no test runner. The page is tested by extracting its inline scripts
and running them under Node against stubs for `sessionStorage`, `document`,
`location`, `performance` and `PerformanceObserver`:

```sh
python -c "
import re,io
h=io.open('index.html',encoding='utf-8').read()
s=re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',h,re.S)
io.open('scripts.js','w',encoding='utf-8').write('\n'.join(s))
"
node --check scripts.js
```

Stub `globalThis.window = globalThis` — in a browser they are the same object,
and the global site tag's `window.dataLayer = …` depends on it.

Feed synthetic Floodlight URLs through `considerEntry()` to exercise the wire
check. Cover both endpoint shapes and, importantly, the **failure** paths:
a stripped u-var, a hit with no `u2`, a stale row from a previous page load,
and hostile query strings.

## Constraints that are easy to break

- **Only documented gtag keys reach Floodlight** (u-vars, `ord`, `qty`,
  `revenue`/`cost`, consent fields). Inventing an event param does nothing —
  it is dropped silently, with no error anywhere.
- **u-vars must be declared in the CM360 Floodlight configuration** before
  they collect. That is external state this repo cannot assert. An undeclared
  u-var still rides along in the request and is discarded server-side.
- **The ATNID must stay strictly UUID-validated.** The query string is
  attacker-supplied, the Floodlight request is `;`-delimited, and the `%p`
  macro captures up to the next `;` — so a crafted value could inject
  key-values into the hit or truncate the forward to media-px. Loosening the
  check is a security regression, not a convenience.
- **`ord` is the conversion identity.** One click can put several identical
  requests on the wire (observed when the `tel:` handler interrupts the page);
  CM360 dedupes on `ord`. Count distinct `ord` values, never request count.
- **`%p` macro syntax**: `%p<key>=!<end-char>`, with a *literal* `=` and `;`
  as the end character for every key mid-request. Only keys that exist in the
  request can be captured.

## Verifying claims about CM360

Do not answer CM360 configuration or macro-syntax questions from memory —
the UI labels and macro rules move. Check the current Google documentation.
Distinguish what the captured request proves (page side) from what needs
platform config (declaration, report type, dynamic tags).

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

```sh
node test/run.js            # every suite
node test/run.js atnid      # suites matching a name
```

No dependencies, no install. `test/run.js` extracts the page's inline
`<script>` blocks, runs them in a VM context against stubs for
`sessionStorage`, `document`, `location`, `performance` and
`PerformanceObserver`, then asserts against the page's own globals. **The tests
exercise the shipped code verbatim** — nothing is reimplemented in the suites,
so they cannot drift from `index.html`.

Suites are `test/suite-*.js`, picked up automatically:

| Suite | Covers |
| --- | --- |
| `suite-fire-log.js` | pairing hits to clicks, all three endpoint shapes, noise rejection, out-of-order arrival, nonce collisions, stale rows, rendering and escaping |
| `suite-atnid.js` | ATNID capture and its sources, hostile query strings, `u3` in the wire check |
| `suite-real-hits.js` | requests captured verbatim from Chrome, kept as regression fixtures |

Helpers available inside a suite: `land(search, session)` simulates a page
load, `seeResource(url)` feeds the observer, `freezeClock(ms)` pins
`Date.now`, and `newestRow()` / `mismatches(row)` / `checkedKeys(row)` /
`painted()` / `lastGtagParams()` read the results. Assert with
`t.check(name, got, want)` or `t.ok(name, cond)`; `t.section(name)` groups
output.

Weight the **failure** paths — a stripped u-var, a hit with no `u2`, a stale
row from a previous load, hostile query strings. The happy path is the easy
half and the least likely to break silently.

Note the coverage is layered rather than end-to-end: `lastGtagParams()`
assertions prove what the page *sent*, while the wire suites feed hand-written
URLs to prove the comparison logic. Neither alone catches everything, so when
adding behaviour, add to both.

Sanity-check the harness itself occasionally by mutating `index.html` and
confirming a suite goes red. A suite that cannot fail is worthless.

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

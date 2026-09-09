# atnid-testing

Static test pages served by GitHub Pages from the `main` branch root.

**Live URL:** https://rob-atn.github.io/atnid-testing/

## Pages

- `index.html` — Honda / East Test Honda dealer sandbox page carrying the
  CM360 global site tag for advertiser `DC-17198395`. The
  `fireFloodlight(action)` helper sends the conversion event
  `DC-17198395/a3iq30/atnid0+standard`, wired to the two on-page links.

## Custom Floodlight variables

Each fire carries two u-vars so hits are distinguishable in reporting:

| u-var | Value | Purpose |
| --- | --- | --- |
| `u1` | `call` or `website` | which link was clicked |
| `u2` | `test-<epoch-ms>-<seq>` | unique per click, to find one specific test hit |

**Both u-vars must be declared in the CM360 Floodlight configuration**
(Advertiser → Floodlight → Custom Floodlight Variables) before they collect
anything. Undeclared, the values still ride along in the request but are
discarded server-side — reporting shows nothing and no error surfaces
anywhere.

Only documented gtag keys reach Floodlight (u-vars, `ord`, `qty`,
`revenue`/`cost`, consent fields, and a short list of others). Arbitrary
params such as `event_category` are dropped.

## Verifying a fire

The fire log below the links reports each conversion with its timestamp, `u1`,
`u2`, and two independent status columns. It is kept in `sessionStorage`, so it
survives navigating out to the dealer site and coming back.

| Column | Means |
| --- | --- |
| **Callback** | gtag ran its `event_callback` — it accepted the event |
| **Wire** | the real request to DoubleClick was observed, and its params were compared against what we meant to send |

The wire check needs no DevTools. It reads the **Resource Timing API**: a
cross-origin resource's URL is exposed on the performance timeline even though
its detailed timings are not, and Floodlight carries `src`, `type`, `cat`, `u1`
and `u2` in that URL. A `PerformanceObserver` picks up the hit, parses it, and
diffs it against the intended values — click the Wire cell for the
param-by-param comparison and the raw URL.

Notes on the implementation:

- Floodlight params are semicolon-delimited inside the URL **path**
  (`…/activityi;src=123;type=x;cat=y;ord=1`), not a query string, so
  `URLSearchParams` is no help. Matching is loose on the endpoint, covering both
  `ad.doubleclick.net/ddm/activity/` and `<id>.fls.doubleclick.net/activityi`.
- Hits are paired to rows by the `u2` nonce, so clicks in flight simultaneously
  can't be confused. A hit carrying no `u2` still gets attached — by timing, and
  labelled as a guess — because a missing u-var is exactly the finding worth
  surfacing.
- Rows outlive a reload but resource entries don't, so rows are tagged with the
  page load that made them; a fresh hit can never be attributed to a row left
  over from an earlier load.

Either column can stay pending because navigating away cut things short, so a
pending row is **not** proof of failure. A `mismatch` verdict is meaningful,
though: it means the request went out with something other than what the page
intended.

Once the wire column reads verified, the page side is correct and anything
missing downstream is CM360-side — the u-var declaration or the report type.

## Publishing a change

Edits to `main` publish automatically; the Pages build usually takes about a
minute.

```sh
git add -A
git commit -m "Update test page"
git push
```

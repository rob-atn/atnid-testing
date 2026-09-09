# atnid-testing

Static test pages served by GitHub Pages from the `main` branch root.

**Live URL:** https://rob-atn.github.io/atnid-testing/

## Pages

- `index.html` — Honda / East Test Honda dealer sandbox page carrying the
  CM360 global site tag for advertiser `DC-17198395`. The
  `fireFloodlight(action)` helper sends the conversion event
  `DC-17198395/a3iq30/atnid0+standard`, wired to the two on-page links.

## Custom Floodlight variables

Each fire carries u-vars so hits are distinguishable in reporting:

| u-var | Value | Purpose |
| --- | --- | --- |
| `u1` | `call` or `website` | which link was clicked |
| `u2` | `test-<epoch-ms>-<seq>` | unique per click, to find one specific test hit |
| `u3` | the ATNID (a UUID) | ad-click identifier, forwarded to media-px |

**Every u-var must be declared in the CM360 Floodlight configuration**
(Advertiser → Floodlight → Custom Floodlight Variables) before it collects
anything. Undeclared, the values still ride along in the request but are
discarded server-side — reporting shows nothing and no error surfaces
anywhere. `u3` is the newest, so check it is declared alongside `u1` and `u2`.

Only documented gtag keys reach Floodlight (u-vars, `ord`, `qty`,
`revenue`/`cost`, consent fields, and a short list of others). Arbitrary
params such as `event_category` are dropped.

## The ATNID

The ATNID is a UUID minted when a user clicks an ad, handed to the landing
page on the `atnid` query string param:

```
https://rob-atn.github.io/atnid-testing/?atnid=3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1a37
```

The page reads it, sends it to CM360 as `u3`, and CM360 forwards it to the
media-px tracker. The panel shows which ATNID is in play for the current
visit, or says so plainly when there is none.

**It is validated strictly as a UUID, and refused otherwise.** That check is
not cosmetic. The query string is attacker-supplied, the Floodlight request is
semicolon-delimited, and the `%p` macro that forwards the value captures up to
the next `;` — so a crafted param containing `;` or `?` could inject extra
key-values into the hit or truncate the capture. Anything that is not exactly
a UUID is dropped rather than forwarded, and the panel says it was refused.

When no ATNID is present, `u3` is **omitted** rather than sent empty, so an
unattributed visit stays distinguishable from a blank value in reporting.

The value is kept in `sessionStorage`, not a cookie or `localStorage`, because
a conversion can happen a page or two after the landing page but an ATNID
surviving into a *later* visit would attribute that visit to an ad click it had
nothing to do with. If real attribution needs to outlive the session, that
becomes a cookie with a deliberate TTL — a measurement decision, not a
technical one.

## Forwarding to media-px (CM360 dynamic tag)

The dynamic tag on the activity uses the `%p` pattern-matching macro to lift
values out of the Floodlight request:

```html
<img src="https://media-px.com/action/3?oid=fltest&atnid=%pu3=!;&ca=%pu1=!;&cb=%pu2=!;&cc=%pord=!;&n=%n" width="1" height="1" alt=""/>
```

Macro syntax is `%p<key>=!<end-character>`:

- The `=` is **literal** — URL-encoding it as `%3D` breaks the token.
- The end character says where the value stops *in the Floodlight request*.
  Everything above uses `;`, because in the actual request `u1`, `u2`, `u3` and
  `ord` are all followed by `;`. Only the final key-value (`~oref`) terminates
  with `?`.
- Only keys that exist in the request can be captured. There is no `atnid=`
  key in a Floodlight hit — the ATNID travels as `u3`, so `%pu3=!;` is what
  forwards it. (`atnid0` appears in the request only as the value of `cat`, the
  activity tag string, which is a fixed label rather than an ID.)
- `%n` is the documented cachebuster, worth having on an `<img>` pixel.

`cc` carries `ord` deliberately: it lets the tracker collapse duplicate
transports of one conversion into a single event. See the note on retries
below.

## Retries and duplicate requests

A single click can put the same request on the wire several times — observed
in Chrome when the `tel:` handler dialog interrupted the page. The retries are
byte-identical, `ord` included, so they are one conversion rather than several:

- **`ord` is the conversion identity.** CM360 mints a fresh random `ord` per
  fire under `+standard` counting and deduplicates on it, so *distinct `ord`
  values* are what get counted — not request count.
- When reconciling a test against reporting, count distinct `ord` values.
- Nothing is lost to this, so it needs no fix on the page side.

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

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

The off-landing-page path was confirmed end to end on 2026-09-10: a reload with
no `atnid` param still sent `u3` from session storage, and it reached media-px.
Note when testing this that `sessionStorage` is **per tab** — the no-param load
must be a reload or navigation in the same tab. A new tab or incognito window
starts empty and will correctly report no ATNID, which looks like a failure and
is not one.

## Forwarding to media-px (CM360 dynamic tag)

The dynamic tag on the activity uses the `%p` pattern-matching macro to lift
values out of the Floodlight request:

```html
<img src="https://media-px.com/action/3?oid=fltest&atnid=%pu3=!;&ca=%pu1=!;&cb=%pu2=!;&cc=%pord=!;&n=%n" width="1" height="1" alt=""/>
```

Confirmed working 2026-09-10 — a real outbound call, every macro resolved:

```
https://media-px.com/action/3?oid=fltest&atnid=3c56a1b9-6d11-4a89-beba-f7bcd40e22ba
  &ca=call&cb=test-1789059907540-2&cc=4536605750079&n=356543251
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
- **Do not match on `atnid%3D`.** An earlier version of this tag used
  `%patnid%3D!?` and appeared to work: the encoded landing URL inside `~oref`
  contains `atnid%3D<uuid>`, so the macro was scraping the ATNID out of the
  referrer rather than reading `u3`. It breaks whenever the conversion happens
  off the landing page (no `atnid` in `~oref`) or when another param follows
  the ATNID in the landing URL (`?atnid=X&utm_source=Y` encodes to
  `atnid%3DX%26utm_source%3DY`, and the capture returns the lot). Match the
  u-var, not the referrer.
- The end character is **consumed, not emitted** — confirmed 2026-09-10 from
  real outbound calls, where the ATNID arrived as a bare UUID with no trailing
  `;`. No server-side stripping is needed.
- `%n` is the documented cachebuster, and on this tag it is **required**, not
  optional. See below.
- Use `https://`. An `http://` pixel is mixed content on this HTTPS page;
  browsers auto-upgrade or block it, and it would put the ATNID on the wire in
  plaintext.

`cc` carries `ord` deliberately: it lets the tracker collapse duplicate
transports of one conversion into a single event. See the note on retries
below.

**Every fire must produce a distinct URL.** `<img>` requests are cacheable, so
if the outbound URL is byte-identical between two conversions the browser can
serve the second from cache and the server never sees it. The ATNID is constant
for the whole ad click, so a tag carrying *only* the ATNID has this bug: two
conversions in one session are indistinguishable and the second can vanish.
`cb=%pu2=!;` (the per-click nonce) and `n=%n` are what keep each URL unique —
do not drop both.

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

## Verifying in CM360 reporting

Reporting → Instant Reporting → new Floodlight report. Confirmed working
2026-09-10: `Link Action`, `Test Nonce` and `Atnid` all populated.

Four things that are easy to get wrong, in the order they bite:

- **Filter on Floodlight configuration ID `17198395` first.** Custom variables
  do not appear in the dimension list at all until a configuration ID is
  selected — look for them before that and you will conclude they were never
  declared.
- **Add them as dimensions, not metrics.** As metrics they are summed as
  numeric values, so string values like `call` and a UUID both report as `0`.
- **They appear under their friendly names** (`Link Action`, `Test Nonce`,
  `Atnid`), not as `u1`/`u2`/`u3`.
- **Metric: `Total Conversions`.** `Floodlight Impressions` is *incompatible*
  with custom variables and with `Conversion Referrer` — it is an
  activity-level aggregate carrying no per-conversion attributes, so it cannot
  be broken out by anything that exists per conversion.

**Enable the unattributed settings in the report properties, or every
hand-made test reads zero.** Conversion metrics require prior ad exposure, and
a test fired by pasting `?atnid=…` into the address bar has none. The relevant
toggle is *unattributed cookie conversions* — the request carries `auiddc=`, so
a DoubleClick cookie exists but no exposure does. Enabling unattributed IP
conversions too is harmless and covers tests where the cookie did not stick.

Once real ad clicks generate the ATNIDs, those conversions are attributed and
the standard conversion metrics work normally. The unattributed-only situation
is an artifact of hand-testing.

## Publishing a change

Edits to `main` publish automatically; the Pages build usually takes about a
minute.

```sh
git add -A
git commit -m "Update test page"
git push
```

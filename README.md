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

The page has an on-page fire log, so no DevTools needed for a smoke test: it
lists each conversion with its timestamp, `u1`, `u2`, and status. The log is
kept in `sessionStorage`, so it survives navigating out to the dealer site and
coming back.

Status reads `confirmed` once gtag runs its `event_callback`. A row stuck on
`sent…` is **not** proof of failure — navigating away can cut the callback
short. For ground truth, watch DevTools → Network for the request to
`ad.doubleclick.net/ddm/activity/`, which breaks the hit out roughly as
`src=17198395;type=a3iq30;cat=atnid0;…;ord=<random>;u1=call`. If `u1` appears
there, the page side is correct and anything missing downstream is CM360-side
config.

## Notes

- `.nojekyll` tells Pages to serve files as-is (no Jekyll processing).
- The page was originally authored as `Honda CM360 ATNID Test.html`; it was
  renamed to `index.html` so it serves at the bare site URL. The original is
  in git history at commit `78297e6`.

## Publishing a change

Edits to `main` publish automatically; the Pages build usually takes about a
minute.

```sh
git add -A
git commit -m "Update test page"
git push
```

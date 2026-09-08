# atnid-testing

Static test pages served by GitHub Pages from the `main` branch root.

**Live URL:** https://rob-atn.github.io/atnid-testing/

## Pages

- `index.html` — Honda / East Test Honda dealer sandbox page carrying the
  CM360 global site tag for advertiser `DC-17198395`. The `fireFloodlight()`
  helper sends the conversion event
  `DC-17198395/a3iq30/atnid0+standard`, wired to the two on-page links.

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

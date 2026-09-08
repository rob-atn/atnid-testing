# atnid-testing

A minimal static site used for testing. Served by GitHub Pages from the `main`
branch root.

**Live URL:** https://rob-atn.github.io/atnid-testing/

## Layout

- `index.html` — the test page. Drop test tags/scripts between the
  `Test tags / scripts` comment markers.
- `.nojekyll` — tells Pages to serve files as-is (no Jekyll processing).

## Making a change

Edits to `main` publish automatically; the Pages build usually takes under a
minute.

```sh
git add -A
git commit -m "Update test page"
git push
```

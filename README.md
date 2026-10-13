# LR Resource — static browse site

A zero-dependency static site over `data/release_v2/`. No server framework, no CDN,
no build step.

## Run it

Simplest — just open the file:

    xdg-open index.html

Data is loaded through `<script src>` rather than `fetch()`, precisely so this works
from `file://` (browsers block `fetch` on local files, but not script tags).

Or serve it, which is what you'd do to show it on another machine:

    python3 -m http.server 8000 --directory .
    # then http://localhost:8000

## Rebuild after changing the data

    cd ../curation
    python3 cur6_export.py        # curation.db -> data/release_v2/
    python3 cur7_build_site.py    # data/release_v2/ -> site/data/

## Layout

    index.html          four tabs: Browse, Statistics, Methods, Downloads
    app.js              filtering, sorting, paging, evidence drawer
    styles.css
    data/interactions.js   12,044 pairs, loaded up front (1.5 MB)
    data/papers.js         paper metadata (titles/journals) for the drawer
    data/complexes.js      subunit composition
    data/ev/ev0..23.js     evidence, sharded; a shard loads only when you open a
                           pair in it, so the initial load stays ~2.3 MB

`cur7_build_site.py` and `app.js` must agree on the shard function
(`sum of char codes mod 24`) — that is the one coupling between them.

## What it shows

Clicking any row opens the evidence drawer: every paper behind that pair, its
verification outcome, the assay class, and the **verbatim sentence** the verdict
was taken from, linked to PubMed. Recorded negatives (`pair_absent`) are shown
alongside confirmations rather than hidden.

Note the site presents a PROVISIONAL build — see the Methods tab.

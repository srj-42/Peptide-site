/* LR Resource - static browse app. Vanilla JS, no build step, no CDN.
   Column indices in INTERACTIONS rows (see cur7_build_site.py):
   0 id 1 lig 2 rec 3 species 4 status 5 score 6 nPmid 7 nClass 8 nRefute
   9 recKind 10 class 11 assayClasses 12 pathways 13 sources 14 orthoInferred */
(function () {
  const I = window.INTERACTIONS, P = window.PAPERS, CX = window.COMPLEXES,
        S = window.STATS, SHARDS = S.shards, M = S.manifest;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PAGE = 100;
  let view = I, page = 0, sortCol = 5, sortAsc = false;

  /* ---------- tabs ---------- */
  document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
    document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
    ["browse", "stats", "methods", "sources"].forEach(t =>
      $("#tab-" + t).classList.toggle("hide", t !== b.dataset.tab));
  });

  /* ---------- CSV download of the filtered table (owner request 2026-11-03) ---------- */
  function csvCell(v) {
    v = String(v == null ? "" : v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function saveCSV(name, head, rows) {
    const text = "\ufeff" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function downloadPeptideCSV() {
    const head = ["interaction_id", "ligand", "receptor", "species", "verification_status", "confidence_score_provisional",
      "n_confirmed_pmids", "n_assay_classes", "n_refuting_pmids", "receptor_kind", "interaction_class", "assay_classes",
      "pathways", "source_databases", "ortholog_inferred", "evidence_classes"];
    saveCSV("lr_peptide_pairs.csv", head, view.map(r => [r[0], r[1], r[2], r[3] === "h" ? "human" : r[3] === "m" ? "mouse" : r[3],
      r[4], r[5] === null ? "" : r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[14] ? "yes" : "no", r[15] || ""]));
  }
  /* ---------- filtering ---------- */
  function apply() {
    const q = $("#q").value.trim().toUpperCase(),
      sp = $("#species").value, st = $("#status").value,
      as = $("#assay").value, ms = parseFloat($("#minscore").value) || 0,
      on = $("#only").value, ic = $("#iclass").value;
    view = I.filter(r => {
      // interaction_class: a Ligand-Ligand or Receptor-Receptor row is NOT a
      // ligand-receptor pair, and must not be read as one.
      if (ic === "__null" && (r[10] || "")) return false;
      if (ic && ic !== "__null" && r[10] !== ic) return false;
      if (q && !(r[1].toUpperCase().includes(q) || r[2].toUpperCase().includes(q))) return false;
      if (sp && r[3] !== sp) return false;
      if (st && r[4] !== st) return false;
      if (as && !r[11].split(",").includes(as)) return false;
      if (ms > 0 && (r[5] === null || r[5] < ms)) return false;
      if (on === "neg" && !r[8]) return false;
      if (on === "unassessed" && r[5] !== null) return false;
      if (on === "zero" && r[5] !== 0) return false;
      if (on === "pw" && !r[12]) return false;
      if (on === "cplx" && r[9] !== "complex") return false;
      return true;
    });
    sortView(); page = 0; render();
  }
  function sortView() {
    const c = sortCol, dir = sortAsc ? 1 : -1;
    view = view.slice().sort((a, b) => {
      let x = a[c], y = b[c];
      // unassessed (null score) always sinks to the bottom, both directions:
      // "no answer yet" is not a low score and must not rank as one.
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }
  document.querySelectorAll("th[data-s]").forEach(th => th.onclick = () => {
    const c = +th.dataset.s;
    if (c === sortCol) sortAsc = !sortAsc; else { sortCol = c; sortAsc = false; }
    document.querySelectorAll("th").forEach(t => t.classList.remove("sorted", "asc"));
    th.classList.add("sorted"); if (sortAsc) th.classList.add("asc");
    sortView(); render();
  });
  ["q", "species", "status", "assay", "minscore", "only"].forEach(id => {
    const el = $("#" + id);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", apply);
  });

  /* ---------- table ---------- */
  const badge = st => st === "verified" ? '<span class="badge b-verified">verified</span>'
    : st === "checked_unsupported" ? '<span class="badge b-unsupported">unsupported</span>'
      : '<span class="badge b-unverified">unverified</span>';

  function render() {
    const n = view.length, start = page * PAGE, slice = view.slice(start, start + PAGE);
    $("#count").innerHTML = `<b>${n.toLocaleString()}</b> of ${I.length.toLocaleString()} interactions`;
    $("#rows").innerHTML = slice.map(r => {
      const cls = r[11] ? r[11].split(",").map(c => `<span class="chip">${esc(c)}</span>`).join("") : "";
      const pw = r[12] ? r[12].split(",").slice(0, 2).map(p => `<span class="chip">${esc(p)}</span>`).join("") : "";
      const neg = r[8] ? ` <span class="badge b-neg" title="${r[8]} refuting paper(s)">−${r[8]}</span>` : "";
      return `<tr data-id="${r[0]}">
        <td class="pair">${esc(r[1])}</td>
        <td class="pair">${esc(r[2])}${r[9] === "complex" ? ' <span class="chip">complex</span>' : ""}</td>
        <td>${r[3] === "h" ? "human" : "mouse"}</td>
        <td>${r[10] ? `<span class="chip">${esc(r[10])}</span>` : '<span class="unassessed" title="Not classified: its partners are not annotated on both sides.">unclassified</span>'}</td>
        <td>${badge(r[4])}${neg}</td>
        <td>${r[5] === null
            ? '<span class="unassessed" title="Not assessed: no paper has been read for this pair yet. This is NOT a low score.">not assessed</span>'
            : `<div class="score"><div class="bar"><i style="width:${(r[5] * 100).toFixed(0)}%"></i></div>
               <span class="mono">${r[5].toFixed(2)}</span></div>`}</td>
        <td>${r[6]}</td><td>${cls}</td><td>${pw}</td>
        <td><span class="chip">${esc(r[13].split(",")[0].replace(/"/g, "") || "—")}</span>${r[13].split(",").length > 1 ? ` <span class="chip">+${r[13].split(",").length - 1}</span>` : ""}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="9" style="padding:26px;color:#6b6b66">No interactions match these filters.</td></tr>`;
    $("#pageinfo").textContent = n ? `${start + 1}–${Math.min(start + PAGE, n)} of ${n.toLocaleString()}` : "—";
    $("#prev").disabled = page === 0;
    $("#next").disabled = start + PAGE >= n;
    $("#rows").querySelectorAll("tr[data-id]").forEach(tr =>
      tr.onclick = () => openDetail(tr.dataset.id));
  }
  $("#dlcsv").onclick = downloadPeptideCSV;
  $("#prev").onclick = () => { page--; render(); window.scrollTo(0, 0); };
  $("#next").onclick = () => { page++; render(); window.scrollTo(0, 0); };

  /* ---------- detail drawer (evidence shard loaded on demand) ---------- */
  const shardOf = id => { let s = 0; for (const c of id) s += c.charCodeAt(0); return s % SHARDS; };
  const loaded = {};
  function needShard(id, cb) {
    const s = shardOf(id);
    if (loaded[s]) return cb();
    const el = document.createElement("script");
    el.src = `data/ev/ev${s}.js`;
    el.onload = () => { loaded[s] = 1; cb(); };
    el.onerror = () => { loaded[s] = 1; cb(); };
    document.head.appendChild(el);
  }
  const OUTCOME_HELP = {
    confirmed: "A curator read this paper and it demonstrates the interaction.",
    pair_absent: "The paper tested this pair and it does NOT bind. A recorded negative.",
    review_only: "Only review articles cite this pair. A review is a lead, not a receipt.",
    abstract_insufficient: "The abstract cannot settle it; the answer is in a table or figure.",
    different_entity: "The cited work is about a different molecule, or fails the localisation check.",
    pending: "Not yet read.",
    unresolvable: "The cited PMID does not resolve to a relevant paper.",
    retracted: "The supporting paper has been retracted."
  };
  function openDetail(id) {
    needShard(id, () => {
      const r = I.find(x => x[0] === id);
      const ev = (window.__EV[shardOf(id)] || {})[id] || [];
      const order = { confirmed: 0, pair_absent: 1, abstract_insufficient: 2, review_only: 3, different_entity: 4, pending: 5 };
      ev.sort((a, b) => (order[a[1]] ?? 9) - (order[b[1]] ?? 9));
      const cxL = CX[r[1]], cxR = CX[r[2]];
      const evHtml = ev.length ? ev.map(e => {
        const p = P[e[0]] || ["", "", "", 0, 0];
        return `<div class="ev ${esc(e[1])}">
          <div class="top">
            <span class="badge ${e[1] === "confirmed" ? "b-verified" : e[1] === "pair_absent" ? "b-neg" : "b-unverified"}"
                  title="${esc(OUTCOME_HELP[e[1]] || "")}">${esc(e[1])}</span>
            ${e[2] ? `<span class="chip">${esc(e[2])}</span>` : ""}
            ${e[3] ? `<span class="chip">${esc(e[3])}</span>` : ""}
            ${e[4] ? `<span class="chip">read: ${esc(e[4])}</span>` : ""}
            ${e[6] ? `<span class="chip">${esc(e[6])}</span>` : ""}
            ${e[7].trim() ? `<span class="chip">Kd ${esc(e[7])}</span>` : ""}
            ${e[8] ? `<span class="chip">PDB ${esc(e[8])}</span>` : ""}
            ${p[3] ? '<span class="chip">review</span>' : ""}
            ${p[4] ? '<span class="badge b-neg">RETRACTED</span>' : ""}
            <a class="mono" href="https://pubmed.ncbi.nlm.nih.gov/${esc(e[0])}/" target="_blank"
               rel="noopener" style="margin-left:auto">PMID ${esc(e[0])} ↗</a>
          </div>
          <div class="title">${esc(p[0])} <i>${esc(p[1])}</i> ${esc(p[2])}</div>
          ${e[5] ? `<blockquote>“${esc(e[5])}”</blockquote>` : ""}
        </div>`;
      }).join("") : `<p style="color:#6b6b66">No evidence rows recorded for this pair.</p>`;

      $("#detail").innerHTML = `<div class="scrim"><div class="drawer">
        <button class="close">Close</button>
        <h2>${esc(r[1])} <span class="arrow">→</span> ${esc(r[2])}</h2>
        <div style="color:#6b6b66;font-size:13px">${r[3] === "h" ? "Human" : "Mouse"} · ${esc(r[0])}</div>
        <dl class="kv">
          <dt>Confidence</dt><dd>${r[5] === null
            ? '<span class="unassessed">not assessed</span> <span style="color:#6b6b66">— no paper for this pair has been read yet; this is not a score of zero</span>'
            : `<span class="mono">${r[5].toFixed(4)}</span>${r[5] === 0 ? ' <span style="color:#6b6b66">— assessed, nothing confirmed</span>' : ""}`}</dd>
          <dt>Status</dt><dd>${badge(r[4])}</dd>
          <dt>Confirmed papers</dt><dd>${r[6]} across ${r[7]} assay class${r[7] === 1 ? "" : "es"}${r[8] ? ` · <b style="color:#8a2b2b">${r[8]} refuting</b>` : ""}</dd>
          <dt>Interaction class</dt><dd>${esc(r[10] || "—")}</dd>
          ${cxL ? `<dt>Ligand complex</dt><dd>${cxL.map(esc).join(" + ")}</dd>` : ""}
          ${cxR ? `<dt>Receptor complex</dt><dd>${cxR.map(esc).join(" + ")}</dd>` : ""}
          <dt>Pathways</dt><dd>${r[12] ? esc(r[12]) : "—"} <span style="color:#6b6b66;font-size:12px">(CellChatDB annotation — not evidence)</span></dd>
          <dt>Reported by</dt><dd>${esc(r[13].replace(/"/g, "") || "—")}</dd>
          ${r[15] ? `<dt>Evidence class</dt><dd>${r[15].split(",").map(k => `<span class="chip" title="${k === "nomenclature_evident" ? "The receptor's official HGNC name contains this ligand's own name (exact name only). High confidence without a citation." : "Annotated in a curated protein/interaction database with a PubMed reference."}">${k === "nomenclature_evident" ? "name-evident" : "database-annotated"}</span>`).join(" ")}</dd>` : ""}
          ${r[14] ? `<dt>Ortholog</dt><dd>inferred by projection from the human pair</dd>` : ""}
        </dl>
        <h3 style="margin:0 0 10px;font-size:14px">Evidence (${ev.length} record${ev.length === 1 ? "" : "s"})</h3>
        ${evHtml}
      </div></div>`;
      const close = () => $("#detail").innerHTML = "";
      $("#detail .close").onclick = close;
      $("#detail .scrim").onclick = e => { if (e.target.classList.contains("scrim")) close(); };
      document.onkeydown = e => { if (e.key === "Escape") close(); };
    });
  }

  /* ---------- statistics ---------- */
  function hbar(label, n, max) {
    return `<div class="hbar"><span class="lab">${esc(label)}</span>
      <span class="track"><i style="width:${(100 * n / max).toFixed(1)}%"></i></span>
      <span class="n">${n.toLocaleString()}</span></div>`;
  }
  function buildStats() {
    const out = M.evidence_verification_outcomes, st = M.interaction_verification_status,
      sp = M.species, at = M.assay_typing_coverage;
    const assay = {}; let scored = 0, withNeg = 0, nUnassessed = 0, nZero = 0;
    const dist = new Array(11).fill(0);
    I.forEach(r => {
      if (r[6]) scored++;
      if (r[8]) withNeg++;
      if (r[5] === null) nUnassessed++; else { if (r[5] === 0) nZero++;
        dist[Math.min(10, Math.round(r[5] * 10))]++; }
      r[11] && r[11].split(",").filter(Boolean).forEach(c => assay[c] = (assay[c] || 0) + 1);
    });
    const mx = o => Math.max(...Object.values(o));
    const bs = S.by_source || {}, cmpMax = Math.max(I.length, ...Object.values(bs).map(x => x.pairs), 1);
    const cmpBar = (lab, tot, ver, strong) => `<div class="hbar" title="${esc(lab)}: ${ver.toLocaleString()} of ${tot.toLocaleString()} pairs verified">
      <span class="lab"${strong ? ' style="color:var(--ink);font-weight:600"' : ""}>${esc(lab)}</span>
      <span class="track" style="position:relative"><i style="width:${(tot / cmpMax * 100).toFixed(1)}%;opacity:.35"></i>
        <i style="position:absolute;left:0;top:0;width:${(ver / cmpMax * 100).toFixed(1)}%;opacity:.9"></i></span>
      <span class="n" style="width:150px">${tot.toLocaleString()} &middot; ${ver.toLocaleString()} verified</span></div>`;
    const cmpRows = Object.entries(bs).map(([k, v]) => cmpBar(k, v.pairs, v.own_verified, false)).join("") +
      cmpBar("This database", I.length, st.verified, true);
    $("#statbody").innerHTML = `
      <div class="stat-grid">
        <div class="stat"><b>${I.length.toLocaleString()}</b><span>interactions (human + mouse)</span></div>
        <div class="stat"><b>${st.verified.toLocaleString()}</b><span>verified pairs</span></div>
        <div class="stat"><b>${at.typed.toLocaleString()}</b><span>assay-typed confirmed rows (${at.percent_of_confirmed}% of confirmed)</span></div>
      </div>
      <div class="panel" style="margin-bottom:14px">
        <h3 style="margin:0 0 10px;font-size:14px">Existing resources compared with this database</h3>
        <p style="color:#6b6b66;font-size:12.5px;margin:0 0 10px">Each source resource as it stands: how many
        ligand&ndash;receptor pairs it lists (human and mouse), and how many of those it already verifies by this project's
        standard using only what the resource itself supplies &mdash; a paper it cites that states the interaction in a quoted
        sentence, or a curated pharmacology record (GtoPdb). The last bar is this database, after reading the literature for
        every pair and adding curated-database records (BioGRID, IntAct, PDB, UniProt, GtoPdb).</p>
        ${cmpRows}
        <div class="cmpkey"><span><i style="background:var(--accent)"></i>verified</span>
          <span><i style="background:var(--accent);opacity:.35"></i>listed, not verified</span></div>
      </div>
      <div class="panel" style="margin-bottom:14px">
        <h3 style="margin:0 0 10px;font-size:14px">Evidence by verification outcome</h3>
        ${Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, v]) => hbar(k, v, mx(out))).join("")}
        <p style="color:#6b6b66;font-size:12.5px;margin:10px 0 0">Only <code>confirmed</code> rows
        contribute to a confidence score. <code>pair_absent</code> subtracts. Everything else scores zero —
        “not yet read” is never treated as weak support.</p>
      </div>
      <div class="panel" style="margin-bottom:14px">
        <h3 style="margin:0 0 10px;font-size:14px">Assay classes — what kind of experiment</h3>
        ${Object.entries(assay).sort((a, b) => b[1] - a[1]).map(([k, v]) => hbar(k, v, mx(assay))).join("")}
        <p style="color:#6b6b66;font-size:12.5px;margin:10px 0 0">This is the layer no upstream resource
        records. Counted only on <code>confirmed</code> rows \u2014 the assay type describes the read that
        established the pair \u2014 and every confirmed row here is typed. The v1 build typed 27 rows;
        this build types ${at.typed.toLocaleString()}. A further ${(at.ingest_time_typing_on_unverified_rows || 0).toLocaleString()}
        unverified rows carry a class stamped from GtoPdb affinity fields at ingest; those are not
        counted because the pair itself is not yet verified.</p>
      </div>
      <div class="panel" style="margin-bottom:14px">
        <h3 style="margin:0 0 10px;font-size:14px">Interaction verification status</h3>
        ${Object.entries(st).sort((a, b) => b[1] - a[1]).map(([k, v]) => hbar(k, v, mx(st))).join("")}
      </div>
      <div class="panel">
        <h3 style="margin:0 0 10px;font-size:14px">Confidence distribution</h3>
        ${dist.map((n, i) => hbar((i / 10).toFixed(1), n, Math.max(...dist))).join("")}
        <p style="color:#6b6b66;font-size:12.5px;margin:10px 0 0">Species: ${Object.entries(sp).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(" · ")}.
        <b>${nUnassessed.toLocaleString()} interactions are excluded from this chart entirely</b> — they have a
        blank score, not a zero, because no paper has been read for them yet. The ${nZero.toLocaleString()} pairs
        at 0.0 were actually assessed and nothing confirmed them.</p>
      </div>`;
  }

  /* ---------- methods ---------- */
  function buildMethods() {
    $("#methodsbody").innerHTML = `
      <h3 style="margin-top:0">What this resource is</h3>
      <p>A ligand\u2013receptor table for <b>human and mouse peptide ligands</b>, merged from
      connectomeDB2025, CellPhoneDB v5, ICELLNET, GtoPdb and, via OmniPath, the ligand\u2013receptor
      resources LIANA consolidates (CellChatDB, LRdb, CellTalkDB, iTALK and others \u2014 full list on the Sources tab),
      and then <b>re-verified against primary literature</b>. Its distinguishing layer is
      <code>assay_class</code>: for each claim, what kind of experiment backs it.</p>

      <div class="note"><b>Not cleared for redistribution.</b> Upstream licences conflict;
      internal and academic use only.</div>

      <h3>Scoring</h3>
      <p>Noisy-OR over distinct confirmed PMIDs \u2014 each independent paper is a separate chance to
      establish the pair \u2014 weighted by what kind of experiment backs it. The scale ranks how
      <i>directly</i> the experiment observes contact, not how good the science is:</p>
      <div class="dl"><div><b>structural</b><br><span>co-crystal, cryo-EM, NMR of the complex</span><br><span class="dbmap">Databases: PDB; IntAct and BioGRID records from crystallography, NMR or electron microscopy</span></div>
        <div class="mono">0.90</div></div>
      <div class="dl"><div><b>direct binding</b><br><span>SPR, ITC, radioligand, pull-down, co-IP</span><br><span class="dbmap">Databases: GtoPdb; IntAct and BioGRID records from binding methods (SPR, ITC, pull-down, reconstituted complex, cross-linking, co-immunoprecipitation)</span></div>
        <div class="mono">0.85</div></div>
      <div class="dl"><div><b>functional in vitro</b><br><span>blocking or stimulating the receptor changes the ligand's effect in cells</span><br><span class="dbmap">Databases: IntAct and BioGRID records from in-cell methods (two-hybrid, FRET, affinity capture with mass spectrometry)</span></div>
        <div class="mono">0.80</div></div>
      <div class="dl"><div><b>functional in vivo</b><br><span>removing one partner changes a phenotype in an animal</span></div>
        <div class="mono">0.70</div></div>
      <div class="dl"><div><b>computational</b><br><span>docking, modelling, text-mining \u2014 no observation behind it</span></div>
        <div class="mono">0.35</div></div>
      <div class="dl"><div><b>others</b><br><span>the paper states the pair interacts, but the experiment cannot be identified</span><br><span class="dbmap">Databases: UniProt annotation sentences; IntAct and BioGRID records whose method fits none of the above</span></div>
        <div class="mono">0.10</div></div>

      <p style="margin-top:14px"><b>Repeats of the same assay type count for less</b>, so two orthogonal
      methods agreeing is worth more than the same experiment redone:</p>
      <div class="dl"><div><b>occurrence of an assay class</b></div><div class="mono">1st \u00b7 2nd \u00b7 3rd+</div></div>
      <div class="dl"><div><b>weight multiplied by</b></div><div class="mono">1.00 \u00b7 0.50 \u00b7 0.25</div></div>

      <p style="margin-top:14px"><b>Curated-database records are scored like papers</b>, under the class listed
      against each weight above, and share the repeat discount below. A record citing the same paper as a quoted
      sentence counts once, at the stronger class. A receptor officially named after its ligand adds a fixed 0.9.</p>

      <p style="margin-top:14px">A read taken from an abstract alone is multiplied by <b>0.75</b>; a read
      that reached full text is undiscounted. An abstract states a conclusion, the full text shows the
      experiment. Journal, impact factor, citation count and expression data are
      <b>deliberately excluded</b> at every stage.</p>

      <p><b>Refuting papers subtract.</b> A paper that tested the pair and found no interaction is
      recorded, not discarded, and it multiplies the pair's score. Each one costs a fifth of
      whatever the pair had earned, so a pair keeps <code>0.8\u207f</code> of its score under
      <i>n</i> refutations:</p>
      <div class="dl"><div><b>refuting papers</b></div><div class="mono">0 \u00b7 1 \u00b7 2 \u00b7 3 \u00b7 4</div></div>
      <div class="dl"><div><b>score retained</b></div><div class="mono">1.00 \u00b7 0.80 \u00b7 0.64 \u00b7 0.512 \u00b7 0.41</div></div>
      <p>The refutation weight sits below every positive assay weight deliberately: a refutation in
      this corpus is usually less well characterised than a confirmation. A pair can never be driven
      to zero by refutations alone \u2014 the term is capped so at least a tenth of the score stands.
      A paper that simply never mentions the pair is <b>not</b> a refutation; that is recorded as
      \u201cnot assessed\u201d and subtracts nothing.
      A \u00b10.10 perturbation of any single assay weight moves the mean score by \u22640.050
      (measured over scored interactions only).</p>

      <p><b>A blank score is not a zero.</b> Blank means <i>not assessed</i> \u2014 no paper for that pair
      has been read yet. 0.0 means <i>assessed and unsupported</i> \u2014 every cited paper was read and
      reached a terminal non-confirming verdict.</p>`;
  }

  function buildSources() {
    const D = S.source_detail, ps = D.per_source, n = x => x.toLocaleString();
    const total = M.row_counts.interactions_scored;
    const ROLE = {
      evidence: "pairs arrive with per-pair citations, which seed the evidence rows",
      annotation: "pairs plus complex composition, PDB structures and directionality",
      candidate: "pair lists; every claim goes through verification before it counts",
      pathway_only: "pathway names only; no pairs imported from this file",
    };
    const omni = ps.omnipath_ligrecextra || { interactions: 0 };
    const tbl = (head, rows) => `<table class="trust"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
      rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const AGG = {
      connectomeDB2025: "Expert-curated ligand&ndash;receptor pairs with primary-paper citations (human and mouse)",
      CellChatDB: "Curated ligand&ndash;receptor database behind the CellChat tool, partly built from KEGG",
      ICELLNETv2: "Curated ligand&ndash;receptor database including multi-subunit receptors",
      CellPhoneDBv5: "Curated ligand&ndash;receptor database including receptor complexes",
      CellPhoneDB: "Older CellPhoneDB version, as bundled in LIANA",
      LRdb: "Ligand&ndash;receptor list behind the SingleCellSignalR tool",
      CellTalkDB: "Literature-curated ligand&ndash;receptor database (human and mouse)",
      iTALK: "Ligand&ndash;receptor list compiled for the iTALK tool",
      talklr: "Ligand&ndash;receptor list used by the talklr tool",
      GtoPdb: "Expert-curated receptor pharmacology (IUPHAR/BPS Guide to Pharmacology)",
      Cellinker: "Ligand&ndash;receptor database with per-pair citations",
      Ramilowski2015: "Draft human ligand&ndash;receptor network (Ramilowski et al., 2015)",
      EMBRACE: "Ligand&ndash;receptor list from the EMBRACE tool",
      connectomeDB2020: "Earlier connectomeDB version (NATMI)",
      Baccin2019: "Ligand&ndash;receptor list from Baccin et al., 2019 (bone-marrow niche)",
      HPMR: "Human Plasma Membrane Receptome",
      CellCall: "Ligand&ndash;receptor list from the CellCall tool",
      Guide2Pharma: "Older copy of GtoPdb, as bundled in LIANA",
      ICELLNET: "Older ICELLNET version, as bundled in LIANA",
      Kirouac2010: "Ligand&ndash;receptor list from Kirouac et al., 2010",
      scConnect: "Ligand&ndash;receptor list from the scConnect tool"
    };
    const VER = {
      UniProt: "A curated function or subunit sentence naming the partner, with an experimental PubMed id",
      BioGRID: "A physical interaction from a low-throughput study, with a PubMed id",
      IntAct: "A curated physical interaction with its detection method and PubMed id (high-throughput screens excluded)",
      GtoPdb: "An expert-curated ligand&ndash;receptor pharmacology record",
      PDB: "A 3D structure containing a chain of each partner",
      "HGNC approved name": "The receptor is officially named after the ligand"
    };
    const BS = S.by_source || {};
    const sourcesTables = `
      <h3 style="margin-top:0">1. Databases the pairs were aggregated from</h3>
      <p>Every ligand&ndash;receptor pair in the table comes from at least one of these. They decide <i>which pairs exist</i>
      here; listing a pair does not make it verified. Counts are pairs, human and mouse together.</p>
      ${tbl(["Database", "What it contributes", "Pairs"], Object.entries(BS).map(([k, v]) => [esc(k), AGG[k] || "", n(v.pairs)]))}

      <h3>2. Databases and literature used to verify pairs</h3>
      <p>A pair is <b>verified</b> when one of these backs it independently of the list it came from.</p>
      ${tbl(["Source", "What counts as evidence", "Pairs it verifies"], [
        ["Primary papers (PubMed, Europe PMC, PMC full text, publisher pages)", "A sentence from the paper's own text, quoted word for word, naming this ligand and this receptor", n(S.n_lit_verified || 0)],
        ...Object.entries(S.by_dbsource || {}).map(([k, v]) => [esc(k), VER[k] || "", n(v)])])}
      <p style="color:var(--muted);font-size:12.5px">A pair can be verified by several of these at once.</p>
`;
    $("#srcbody").innerHTML = sourcesTables;
  }

  apply(); buildStats(); buildMethods(); buildSources();
})();

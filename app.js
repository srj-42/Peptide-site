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
    $("#statbody").innerHTML = `
      <div class="stat-grid">
        <div class="stat"><b>${I.length.toLocaleString()}</b><span>interactions (human + mouse)</span></div>
        <div class="stat"><b>${st.verified.toLocaleString()}</b><span>verified pairs</span></div>
        <div class="stat"><b>${at.typed.toLocaleString()}</b><span>assay-typed confirmed rows (${at.percent_of_confirmed}% of confirmed)</span></div>
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
      <div class="dl"><div><b>structural</b><br><span>co-crystal, cryo-EM, NMR of the complex</span></div>
        <div class="mono">0.90</div></div>
      <div class="dl"><div><b>direct binding</b><br><span>SPR, ITC, radioligand, pull-down, co-IP</span></div>
        <div class="mono">0.85</div></div>
      <div class="dl"><div><b>functional in vitro</b><br><span>blocking or stimulating the receptor changes the ligand's effect in cells</span></div>
        <div class="mono">0.80</div></div>
      <div class="dl"><div><b>functional in vivo</b><br><span>removing one partner changes a phenotype in an animal</span></div>
        <div class="mono">0.70</div></div>
      <div class="dl"><div><b>computational</b><br><span>docking, modelling, text-mining \u2014 no observation behind it</span></div>
        <div class="mono">0.35</div></div>
      <div class="dl"><div><b>others</b><br><span>the paper states the pair interacts, but the experiment cannot be identified</span></div>
        <div class="mono">0.10</div></div>

      <p style="margin-top:14px"><b>Repeats of the same assay type count for less</b>, so two orthogonal
      methods agreeing is worth more than the same experiment redone:</p>
      <div class="dl"><div><b>occurrence of an assay class</b></div><div class="mono">1st \u00b7 2nd \u00b7 3rd+</div></div>
      <div class="dl"><div><b>weight multiplied by</b></div><div class="mono">1.00 \u00b7 0.50 \u00b7 0.25</div></div>

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
    $("#srcbody").innerHTML = `
      <h3 style="margin-top:0">Where the pairs come from</h3>
      <p>The ${n(total)} interactions were merged from <b>six pinned downloads</b> (ten files).
      One of those downloads, <b>OmniPath ligrecextra</b>, is itself a consolidation: it carries
      ${D.liana.length} of the ligand–receptor resources that LIANA compares
      (Dimitrov et al., <i>Nat Commun</i> 13:3224, 2022), and alongside them names
      ${D.co_attributing.length} general interaction and pathway databases. OmniPath contributes to
      ${n(omni.interactions)} interactions, and <b>${n(D.omnipath_only)} of them come from OmniPath alone</b>, so
      naming OmniPath without its contents understates where most of the new pairs come from.
      Literature and structure services used to verify pairs are listed separately below; they are not sources of pairs.</p>

      <h3>1 · Pinned downloads</h3>
      <table><thead><tr><th>Source</th><th>Role</th><th>Version</th><th style="text-align:right">Raw rows kept</th>
        <th style="text-align:right">Interactions</th><th>Licence</th></tr></thead><tbody>
      ${M.sources.map(s => { const c = ps[s.source_id]; return `<tr>
        <td><b>${s.url && s.url !== "local" ? `<a href="${esc(s.url)}" title="${esc(s.url)}">${esc(s.name)}</a>` : esc(s.name) + ' <span style="color:#6b6b66;font-weight:400">(local file)</span>'}</b></td>
        <td title="${esc(ROLE[s.role] || "")}">${esc(s.role)}</td>
        <td>${esc(s.version || "not pinned (SHA-256 recorded)")}</td>
        <td style="text-align:right">${c ? n(c.records) : "—"}</td>
        <td style="text-align:right">${c ? n(c.interactions) : "—"}</td>
        <td style="font-size:12px">${esc(s.licence)}</td></tr>`; }).join("")}
      </tbody></table>
      <p style="color:#6b6b66;font-size:12.5px">Roles: ${Object.entries(ROLE).map(([k, v]) => `<b>${k}</b> — ${v}`).join("; ")}.
      CellPhoneDB counts sit on the interaction file; the complex, protein and gene files supply identifiers and subunits.
      CellChatDB v2's own file is used only for pathway names, but <b>CellChatDB pairs do enter the resource</b>,
      through OmniPath (table 2).</p>

      <h3>2 · Ligand–receptor resources carried in OmniPath ligrecextra</h3>
      <p>An OmniPath row was kept only if at least one of these resources attributes it
      (<code>cur0h_omnipath_liana.py</code>). A pair can be attributed by several, so counts overlap.</p>
      <table><thead><tr><th>Resource</th><th style="text-align:right">Interactions</th>
        <th style="text-align:right">of which not in connectomeDB2025</th></tr></thead><tbody>
      ${D.liana.map(r => `<tr><td><b>${esc(r.name)}</b></td><td style="text-align:right">${n(r.interactions)}</td>
        <td style="text-align:right">${n(r.not_in_connectomedb)}</td></tr>`).join("")}
      </tbody></table>
      <p style="color:#6b6b66;font-size:12.5px">SingleCellSignalR is in LIANA's list but OmniPath records it under
      its database name, LRdb. In the Browse table's <i>Sources</i> column, the direct downloads appear as
      <code>connectomeDB2025</code>, <code>CellPhoneDBv5</code>, <code>ICELLNETv2</code> and <code>GtoPdb</code>;
      the same databases reached through OmniPath appear under OmniPath's names
      (<code>ConnectomeDB2025</code>, <code>CellPhoneDB</code>, <code>ICELLNET</code>, <code>Guide2Pharma</code>).</p>

      <h3>3 · Other databases named on the same OmniPath rows</h3>
      <p>These list the same pairs but are <b>not</b> why a pair was kept, and they add nothing to its score,
      because agreement between databases is not treated as evidence. They are listed because their data is
      inside the rows we store, and several have their own licence terms (HPRD, for example, is academic-use only).</p>
      <p>${D.co_attributing.map(r => `<span class="chip" style="margin:0 4px 4px 0">${esc(r.name)} <span style="color:#6b6b66">${n(r.interactions)}</span></span>`).join("")}</p>

      <h3>4 · Services used for verification and identifiers</h3>
      ${D.services.map(s => `<div class="dl"><div><b>${esc(s[0])}</b><br><span>${esc(s[2])}</span></div>
        <div class="mono" style="color:#6b6b66;font-size:11.5px">${esc(s[1])}</div></div>`).join("")}

      <h3>Not part of this build</h3>
      <p>MRCLinkdb, MetalinksDB, MetaLigand and MEBOCOST are in the curation database, but they are used only
      by the companion non-peptide (small-molecule) resource. Nothing from them appears here.</p>
      <div class="note"><b>Not cleared for redistribution.</b> ${esc(M.licence_note)}</div>`;
  }

  apply(); buildStats(); buildMethods(); buildSources();
})();

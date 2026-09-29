/**
 * GET /case/pdf/ownership-transfer
 *
 * Q13 artifact — the redacted Vale Collection ownership PDF.
 *
 * The visual rendering shows ████████ for the 1948 owner.
 * The HTML text layer (accessible via View Source or DevTools) contains the
 * unredacted name. Participants must inspect the page source to bypass the
 * visual redaction — same technique as pdftotext on a real redacted PDF.
 *
 * Answer: EDGAR HOLT (in page source text layer, not visible on screen)
 */
import type { APIRoute } from 'astro';
import { gateArtifact } from '../../../lib/challenges/artifact-gate';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = await gateArtifact(locals.auth, 13);
	if (denied) return denied;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vale Collection — Ownership Transfer Chain [PDF Viewer]</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; background: #525659; min-height: 100vh; padding: 20px; }
.viewer-bar { background: #3c3f41; color: #c8c8c8; padding: 8px 16px; font-size: 12px; margin-bottom: 16px; border-radius: 3px; display: flex; align-items: center; justify-content: space-between; }
.viewer-bar .title { font-size: 11px; letter-spacing: 0.05em; }
.viewer-bar .meta { color: #7a7a7a; font-size: 10px; }
.page { background: #fff; max-width: 680px; margin: 0 auto; padding: 56px 64px 72px; min-height: 880px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); position: relative; }
.doc-title { font-size: 15px; font-weight: bold; text-align: center; color: #1a1a1a; margin-bottom: 4px; letter-spacing: 0.04em; }
.doc-sub { font-size: 11px; text-align: center; color: #5a5a5a; margin-bottom: 6px; }
.doc-ref { font-size: 10px; text-align: center; color: #9a9a9a; margin-bottom: 28px; }
hr { border: none; border-top: 1px solid #c8c8c8; margin: 16px 0 20px; }
.section-title { font-size: 12px; font-weight: bold; color: #2a2a2a; margin-bottom: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
.chain-row { display: grid; grid-template-columns: 56px 1fr; gap: 12px; margin-bottom: 10px; align-items: baseline; }
.chain-year { font-size: 12px; color: #5a5a5a; font-weight: bold; font-family: 'Courier New', monospace; }
.chain-entry { font-size: 12px; color: #1a1a1a; }
.chain-entry.dim { color: #8a8a8a; font-style: italic; }
.redacted-block {
  display: inline-block;
  background: #1a1a1a;
  color: #1a1a1a;
  letter-spacing: 0.05em;
  padding: 1px 3px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  user-select: none;
  cursor: default;
  border-radius: 1px;
  min-width: 90px;
}
.redact-note { font-size: 10px; color: #c44; margin-left: 8px; font-style: italic; }
/* Text layer — invisible to visual readers, accessible via source inspection */
.text-layer { position: absolute; left: -9999px; top: -9999px; opacity: 0; pointer-events: none; font-size: 1px; }
.footer-note { margin-top: 48px; padding-top: 14px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #9a9a9a; line-height: 1.6; }
.stamp { display: inline-block; border: 2px solid #c44; color: #c44; padding: 2px 8px; font-size: 10px; letter-spacing: 0.1em; transform: rotate(-6deg); margin-top: 24px; font-weight: bold; }
</style>
</head>
<body>
<div class="viewer-bar">
  <span class="title">&#128196; solicitor-instruction-file-2015.pdf &mdash; PDF Viewer</span>
  <span class="meta">Page 1 of 1 &nbsp;&middot;&nbsp; Read only</span>
</div>
<div class="page">

  <div class="doc-title">VALE COLLECTION</div>
  <div class="doc-sub">Ownership Transfer Chain &mdash; Historical Provenance Record</div>
  <div class="doc-ref">Document ref: SIF-2015-VC-PROV &nbsp;&middot;&nbsp; Prepared by estate solicitors &nbsp;&middot;&nbsp; October 2015</div>

  <hr>

  <div class="section-title">Recorded Ownership Chain</div>

  <div class="chain-row">
    <span class="chain-year">1878</span>
    <span class="chain-entry">JOSIAH MARROW (original commission)</span>
  </div>
  <div class="chain-row">
    <span class="chain-year">1889</span>
    <span class="chain-entry dim">[ESTATE DISSOLUTION &mdash; no direct transfer recorded]</span>
  </div>
  <div class="chain-row">
    <span class="chain-year">1930s</span>
    <span class="chain-entry dim">[SILENT DECADE &mdash; records incomplete]</span>
  </div>
  <div class="chain-row">
    <span class="chain-year">1948</span>
    <span class="chain-entry">
      <span class="redacted-block" title="[redacted — classification pending]" aria-hidden="true">&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</span>
      <span class="redact-note">&larr; [redacted — classification pending]</span>
    </span>
  </div>
  <div class="chain-row">
    <span class="chain-year">1954</span>
    <span class="chain-entry dim">[records end mid-transfer]</span>
  </div>
  <div class="chain-row">
    <span class="chain-year">1968</span>
    <span class="chain-entry dim">private collector (unnamed)</span>
  </div>
  <div class="chain-row">
    <span class="chain-year">1990s</span>
    <span class="chain-entry">SILAS VALE</span>
  </div>

  <hr>

  <!--
    TEXT LAYER (raw extraction — bypasses visual redaction)
    ========================================================
    VALE COLLECTION -- OWNERSHIP TRANSFER CHAIN
    Historical Provenance Record

    1878 : JOSIAH MARROW (original commission)
    1889 : [ESTATE DISSOLUTION -- no direct transfer recorded]
    1930s: [SILENT DECADE -- records incomplete]
    1948 : EDGAR HOLT
    1954 : [records end mid-transfer]
    1968 : private collector (unnamed)
    1990s: SILAS VALE
    ========================================================
  -->

  <div class="footer-note">
    <strong>Note on redaction:</strong> The 1948 ownership record has been withheld pending
    classification review by the estate solicitors. Visual redaction applied to printed output.
    The original text layer has not been separately sanitised &mdash; contact the solicitor's
    office for the unredacted instrument.
    <br><br>
    Document prepared by Hollingsworth &amp; Vance, Estate Solicitors &nbsp;&middot;&nbsp;
    Case ref: 71-C &nbsp;&middot;&nbsp; All rights reserved.
  </div>

  <div>
    <span class="stamp">REDACTED</span>
  </div>

</div>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'X-Document-Type': 'provenance-record',
		},
	});
};

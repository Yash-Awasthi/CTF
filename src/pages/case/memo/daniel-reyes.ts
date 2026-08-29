/**
 * GET /case/memo/daniel-reyes
 *
 * Q15 artifact — the published memo from Daniel Reyes.
 *
 * The rendered page shows only the polished, published version.
 * The draft text is buried in an HTML comment — not rendered visually.
 * Participants must View Source (Ctrl+U) or DevTools to find it.
 *
 * Hidden: Daniel claims to have known Silas Vale since 2001 (answer to Q15).
 * Published: he claims engagement "through solicitors in late 2013".
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Provenance Note — Daniel Reyes</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Georgia, 'Times New Roman', serif; background: #f2ece0; color: #2a2218; min-height: 100vh; padding: 40px 20px; }
.document { max-width: 640px; margin: 0 auto; background: #faf6ee; border: 1px solid #d4c8a8; padding: 48px 56px 56px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
.letterhead { border-bottom: 2px solid #c8b888; padding-bottom: 16px; margin-bottom: 28px; }
.letterhead-name { font-size: 18px; font-weight: bold; color: #1a1208; letter-spacing: 0.03em; }
.letterhead-title { font-size: 12px; color: #7a6848; margin-top: 3px; font-style: italic; }
.doc-meta { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #8a7858; margin-bottom: 24px; line-height: 1.8; }
.doc-meta span { display: inline-block; min-width: 100px; font-weight: bold; color: #5a4838; }
h2 { font-size: 15px; color: #1a1208; margin-bottom: 16px; font-weight: bold; border-bottom: 1px solid #e0d4b4; padding-bottom: 8px; }
p { font-size: 14px; line-height: 1.85; color: #2a2218; margin-bottom: 16px; }
.footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #d4c8a8; font-family: Arial, sans-serif; font-size: 11px; color: #a09070; }
.stamp { display: inline-block; border: 2px solid #c0a060; color: #a08040; padding: 3px 10px; font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 0.15em; transform: rotate(-3deg); margin-top: 20px; font-weight: bold; }
</style>
</head>
<body>
<!--
  DRAFT 1 — do not publish
  I have known Silas Vale since 2001 through private auction circles.
  We met at the Caldwell sale that year. He trusted me with access to
  the collection long before his death.
  [REVISION NOTE: change to "engaged by solicitors" version — too much detail]
-->
<div class="document">

  <div class="letterhead">
    <div class="letterhead-name">Daniel Reyes</div>
    <div class="letterhead-title">Independent Provenance Consultant &nbsp;·&nbsp; Estate Advisory</div>
  </div>

  <div class="doc-meta">
    <div><span>Date:</span> 14 October 2015</div>
    <div><span>Reference:</span> MEMO-published.html</div>
    <div><span>Regarding:</span> Case 71-C — Provenance Note (Requested)</div>
    <div><span>Submitted to:</span> Blackwood Investigative Bureau</div>
  </div>

  <h2>Provenance Note — Daniel Reyes</h2>

  <p>I was engaged by the estate solicitors in late 2013 following
  Mr. Vale's passing. My involvement with the collection began at that
  point and is entirely professional in nature. I have no prior personal
  connection to Silas Vale or to the Vale estate.</p>

  <p>The date anomaly identified in the ledger (the pre-1889 acquisition
  reference) is almost certainly a transcription error introduced during
  the 1990s cataloguing process. I have encountered similar discrepancies
  in older estate records on several previous occasions. It does not, in
  my assessment, indicate any irregularity in the provenance chain.</p>

  <p>I am available to provide further clarification to the Bureau should
  it be required. All records relating to my consultancy engagement are
  held by the estate solicitor.</p>

  <div class="stamp">SUBMITTED</div>

  <div class="footer">
    Daniel Reyes &nbsp;·&nbsp; Provenance Consultant &nbsp;·&nbsp;
    Submitted to Blackwood Investigative Bureau, Case 71-C
  </div>

</div>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'X-Document-Status': 'published',
		},
	});
};

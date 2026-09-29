/**
 * GET /case/memo/daniel-reyes-v2
 *
 * Q19 artifact — the updated memo from Daniel Reyes (v2).
 *
 * Same URL structure as v1 (/case/memo/daniel-reyes), different content.
 * v1 (Q15): "I was engaged by the estate solicitors in late 2013..."
 * v2 (Q19): "I have no direct knowledge of the acquisition timeline..."
 *
 * The draft comment block from v1 has been removed.
 * The first sentence of the first paragraph has changed.
 * Participants compare v1 and v2, submit the new opening sentence.
 */
import type { APIRoute } from 'astro';
import { gateArtifact } from '../../../lib/challenges/artifact-gate';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = await gateArtifact(locals.auth, 19);
	if (denied) return denied;

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
<div class="document">

  <div class="letterhead">
    <div class="letterhead-name">Daniel Reyes</div>
    <div class="letterhead-title">Independent Provenance Consultant &nbsp;&middot;&nbsp; Estate Advisory</div>
  </div>

  <div class="doc-meta">
    <div><span>Date:</span> 14 October 2015</div>
    <div><span>Reference:</span> MEMO-published.html</div>
    <div><span>Regarding:</span> Case 71-C &mdash; Provenance Note (Updated)</div>
    <div><span>Submitted to:</span> Blackwood Investigative Bureau</div>
  </div>

  <h2>Provenance Note &mdash; Daniel Reyes</h2>

  <p>I have no direct knowledge of the acquisition timeline prior to the
  estate sale process. My involvement with the collection began through
  normal professional channels.</p>

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
    Daniel Reyes &nbsp;&middot;&nbsp; Provenance Consultant &nbsp;&middot;&nbsp;
    Submitted to Blackwood Investigative Bureau, Case 71-C
  </div>

</div>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Document-Version': '2',
			'X-Document-Status': 'updated',
		},
	});
};

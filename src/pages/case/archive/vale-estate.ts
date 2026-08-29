/**
 * The "dead" Vale Collection archive website — Q17 artifact.
 *
 * The page content claims it was last updated in 2013.
 * The HTTP Last-Modified header says otherwise.
 * Participants must inspect response headers (DevTools / curl) to find the date.
 *
 * Answer: 2023-09-14 (from Last-Modified: Thu, 14 Sep 2023 03:22:11 GMT)
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vale Collection Archive — Pembridge Heritage Trust</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Georgia, 'Times New Roman', serif; background: #f5f2ec; color: #2a2520; min-height: 100vh; }
.topbar { background: #2c2c2c; color: #888; font-family: Arial, Helvetica, sans-serif; font-size: 11px; padding: 5px 28px; letter-spacing: 0.04em; }
.topbar span { color: #555; }
.archived-banner { background: #fff8e6; border-bottom: 2px solid #d4c48a; padding: 9px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #7a6a3a; display: flex; align-items: center; gap: 10px; }
.archived-banner::before { content: "⚠"; font-size: 14px; }
.container { max-width: 780px; margin: 0 auto; padding: 36px 28px 60px; }
.site-header { margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #d8d0c4; }
h1 { font-size: 28px; font-weight: normal; color: #1a1510; margin-bottom: 6px; letter-spacing: 0.01em; }
.subtitle { font-size: 13px; color: #9a8878; font-style: italic; }
h2 { font-size: 16px; font-weight: normal; color: #3a3028; margin: 24px 0 10px; border-bottom: 1px solid #e0d8cc; padding-bottom: 6px; }
p { font-size: 14px; line-height: 1.8; color: #3a3028; margin-bottom: 14px; }
.catalogue-note { background: #ede8e0; border: 1px solid #d0c8b8; border-radius: 2px; padding: 14px 18px; font-family: Arial, sans-serif; font-size: 12px; color: #7a6a5a; margin: 20px 0; }
.nav { display: flex; gap: 24px; margin: 16px 0 32px; }
.nav a { font-family: Arial, sans-serif; font-size: 12px; color: #8a7868; text-decoration: none; border-bottom: 1px solid #c8bca8; padding-bottom: 1px; }
.nav a:hover { color: #4a3828; }
.footer { margin-top: 48px; border-top: 1px solid #d0c8b8; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #aaa; line-height: 1.6; }
</style>
</head>
<body>

<div class="topbar">
	Pembridge District Heritage Trust &nbsp;<span>|</span>&nbsp; Digital Archive Division
</div>

<div class="archived-banner">
	This site has been archived. No updates since 2013. Content is preserved for historical reference only.
</div>

<div class="container">

	<div class="site-header">
		<h1>The Vale Collection</h1>
		<p class="subtitle">A private catalogue of folk artefacts and estate materials, Pembridge, 1880–1992</p>
		<nav class="nav">
			<a href="#">Collection Overview</a>
			<a href="#">Catalogue Index</a>
			<a href="#">Provenance Records</a>
			<a href="#">Contact</a>
		</nav>
	</div>

	<p>
		The Vale Collection represents the personal acquisitions of the late Silas Vale,
		assembled over four decades of estate work, private purchase, and charitable donation.
		Following the dissolution of the Vale estate, this archive is maintained as a public
		reference resource by the Pembridge District Heritage Trust.
	</p>

	<p>
		The collection spans approximately 240 documented items across categories including
		folk craft, archival correspondence, workshop materials, and miscellaneous estate effects.
		Selected catalogue entries were accessible through the digital index prior to archival.
	</p>

	<h2>Catalogue Access</h2>

	<div class="catalogue-note">
		Catalogue search and item records are currently unavailable. This archive is maintained
		in read-only state. The digital index was last updated in 2013 and is no longer
		actively maintained. For access to original records, contact the Heritage Trust office
		via the address below.
	</div>

	<h2>About the Collection</h2>

	<p>
		Silas Vale began acquiring folk artefacts in the late 1940s, initially through
		estate clearances and charitable donations. The collection expanded significantly
		following the 1889 Pembridge workshop dissolution records, with several items
		of particular provenance interest acquired through the Sovereign Auction House.
	</p>

	<p>
		Appraisal and cataloguing work was conducted intermittently across several decades,
		with the most recent documented assessment occurring prior to the estate dissolution.
		All collection items are noted as requiring independent verification of provenance
		prior to any future disposition.
	</p>

	<div class="footer">
		Vale Collection Archive &nbsp;&mdash;&nbsp;
		Pembridge District Heritage Trust &nbsp;&mdash;&nbsp;
		Established 1998 &nbsp;&mdash;&nbsp;
		Archived 2013 &nbsp;&mdash;&nbsp;
		Contact: heritage@pembridge-trust.org.uk
	</div>

</div>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Last-Modified': 'Thu, 14 Sep 2023 03:22:11 GMT',
			'Cache-Control': 'public, max-age=86400',
			'X-Archive-Status': 'preserved',
			'Server': 'nginx/1.18.0',
		},
	});
};

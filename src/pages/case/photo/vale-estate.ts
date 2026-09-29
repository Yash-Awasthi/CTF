/**
 * GET /case/photo/vale-estate
 *
 * Q7 artifact — the Vale estate group photograph.
 *
 * The SVG is a styled "photograph" showing seven figures in silhouette.
 * The answer (SOVEREIGN AUCTION HOUSE) is embedded as XMP metadata
 * in the SVG source — visible only when the file is inspected as text
 * (View Source, DevTools, or download + open in editor).
 *
 * The in-page EXIF panel on Q7 shows all other fields but marks
 * GPSAreaInformation as "[ENCODED — inspect raw file]" to drive
 * participants here.
 */
import type { APIRoute } from 'astro';
import { gateArtifact } from '../../../lib/challenges/artifact-gate';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = await gateArtifact(locals.auth, 7);
	if (denied) return denied;

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Vale Collection Digital Archive v1.2">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
      xmlns:exif="http://ns.adobe.com/exif/1.0/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <tiff:Make>Rollei</tiff:Make>
      <tiff:Software>Vale Collection Digital Archive v1.2</tiff:Software>
      <tiff:ImageDescription>Group photograph — seven figures present</tiff:ImageDescription>
      <tiff:Copyright>Vale Collection — private archive</tiff:Copyright>
      <exif:GPSAreaInformation>SOVEREIGN AUCTION HOUSE</exif:GPSAreaInformation>
      <dc:description>Vale estate collection photograph. Source location encoded in GPS metadata.</dc:description>
      <xmp:CreateDate>2008-03-14T11:42:07</xmp:CreateDate>
      <xmp:ModifyDate>2008-03-14T11:42:07</xmp:ModifyDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560">
  <defs>
    <filter id="sepia">
      <feColorMatrix type="matrix" values="
        0.393 0.769 0.189 0 0
        0.349 0.686 0.168 0 0
        0.272 0.534 0.131 0 0
        0     0     0     1 0"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend in="SourceGraphic" mode="multiply" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic" operator="in"/>
    </filter>
    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </radialGradient>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d4c8a8"/>
      <stop offset="100%" stop-color="#c0b090"/>
    </linearGradient>
  </defs>

  <!-- Background — aged paper / room interior -->
  <rect width="800" height="560" fill="url(#bg)" filter="url(#sepia)"/>

  <!-- Room architecture -->
  <rect x="0" y="0" width="800" height="560" fill="none" stroke="#b0a070" stroke-width="0"/>
  <!-- Wall panels -->
  <rect x="30" y="30" width="740" height="500" fill="none" stroke="#a09060" stroke-width="1" opacity="0.4"/>
  <!-- Fireplace / mantel suggestion -->
  <rect x="310" y="320" width="180" height="180" fill="#988060" opacity="0.25"/>
  <rect x="290" y="300" width="220" height="25" fill="#a89070" opacity="0.3"/>
  <!-- Floor line -->
  <line x1="0" y1="420" x2="800" y2="420" stroke="#a09060" stroke-width="1" opacity="0.3"/>

  <!-- Seven figures — silhouettes of varying heights -->
  <!-- Figure 1 (far left, standing) -->
  <ellipse cx="90" cy="238" rx="18" ry="20" fill="#3a2c18" opacity="0.82"/>
  <rect x="74" y="256" width="32" height="110" fill="#3a2c18" opacity="0.82" rx="3"/>
  <line x1="74" y1="290" x2="50" y2="330" stroke="#3a2c18" stroke-width="10" opacity="0.82" stroke-linecap="round"/>
  <line x1="106" y1="290" x2="128" y2="325" stroke="#3a2c18" stroke-width="10" opacity="0.82" stroke-linecap="round"/>

  <!-- Figure 2 (second left, seated suggestion) -->
  <ellipse cx="195" cy="260" rx="16" ry="18" fill="#3a2c18" opacity="0.78"/>
  <rect x="181" y="276" width="28" height="90" fill="#3a2c18" opacity="0.78" rx="3"/>
  <line x1="181" y1="306" x2="160" y2="345" stroke="#3a2c18" stroke-width="9" opacity="0.78" stroke-linecap="round"/>
  <line x1="209" y1="306" x2="228" y2="340" stroke="#3a2c18" stroke-width="9" opacity="0.78" stroke-linecap="round"/>

  <!-- Figure 3 (centre-left) -->
  <ellipse cx="300" cy="230" rx="20" ry="22" fill="#2e2210" opacity="0.85"/>
  <rect x="282" y="250" width="36" height="120" fill="#2e2210" opacity="0.85" rx="3"/>
  <line x1="282" y1="285" x2="255" y2="335" stroke="#2e2210" stroke-width="11" opacity="0.85" stroke-linecap="round"/>
  <line x1="318" y1="285" x2="343" y2="330" stroke="#2e2210" stroke-width="11" opacity="0.85" stroke-linecap="round"/>

  <!-- Figure 4 (centre — tallest, prominent) -->
  <ellipse cx="410" cy="215" rx="22" ry="24" fill="#2a1e0e" opacity="0.90"/>
  <rect x="390" y="237" width="40" height="140" fill="#2a1e0e" opacity="0.90" rx="3"/>
  <line x1="390" y1="275" x2="358" y2="330" stroke="#2a1e0e" stroke-width="12" opacity="0.90" stroke-linecap="round"/>
  <line x1="430" y1="275" x2="460" y2="328" stroke="#2a1e0e" stroke-width="12" opacity="0.90" stroke-linecap="round"/>

  <!-- Figure 5 (centre-right) -->
  <ellipse cx="510" cy="235" rx="19" ry="21" fill="#322614" opacity="0.84"/>
  <rect x="493" y="254" width="34" height="115" fill="#322614" opacity="0.84" rx="3"/>
  <line x1="493" y1="288" x2="468" y2="334" stroke="#322614" stroke-width="10" opacity="0.84" stroke-linecap="round"/>
  <line x1="527" y1="288" x2="550" y2="332" stroke="#322614" stroke-width="10" opacity="0.84" stroke-linecap="round"/>

  <!-- Figure 6 (second right) -->
  <ellipse cx="615" cy="248" rx="17" ry="19" fill="#382a12" opacity="0.80"/>
  <rect x="600" y="265" width="30" height="105" fill="#382a12" opacity="0.80" rx="3"/>
  <line x1="600" y1="296" x2="578" y2="338" stroke="#382a12" stroke-width="9" opacity="0.80" stroke-linecap="round"/>
  <line x1="630" y1="296" x2="650" y2="336" stroke="#382a12" stroke-width="9" opacity="0.80" stroke-linecap="round"/>

  <!-- Figure 7 (far right, partially behind door frame) -->
  <clipPath id="doorframe">
    <rect x="0" y="0" width="730" height="560"/>
  </clipPath>
  <g clip-path="url(#doorframe)">
    <ellipse cx="714" cy="242" rx="18" ry="20" fill="#3c2e16" opacity="0.70"/>
    <rect x="698" y="260" width="32" height="108" fill="#3c2e16" opacity="0.70" rx="3"/>
    <line x1="698" y1="292" x2="676" y2="334" stroke="#3c2e16" stroke-width="10" opacity="0.70" stroke-linecap="round"/>
    <line x1="730" y1="292" x2="748" y2="330" stroke="#3c2e16" stroke-width="10" opacity="0.70" stroke-linecap="round"/>
  </g>
  <!-- Door frame edge (cuts off figure 7) -->
  <rect x="728" y="0" width="72" height="560" fill="#b8a878" opacity="0.55"/>
  <rect x="726" y="0" width="4" height="560" fill="#8a7848" opacity="0.6"/>

  <!-- Caption strip at bottom -->
  <rect x="0" y="480" width="800" height="80" fill="#c8ba90" opacity="0.60"/>
  <line x1="0" y1="480" x2="800" y2="480" stroke="#a09060" stroke-width="1" opacity="0.6"/>
  <text x="400" y="505" text-anchor="middle"
    font-family="Georgia, serif" font-size="13" fill="#4a3820" opacity="0.9">
    Vale estate collection — group portrait
  </text>
  <text x="400" y="523" text-anchor="middle"
    font-family="Georgia, serif" font-size="11" fill="#6a5030" opacity="0.8">
    Six figures present. Pembridge Municipal Archive — circa 2008.
  </text>
  <text x="400" y="541" text-anchor="middle"
    font-family="'Courier New', monospace" font-size="10" fill="#8a7040" opacity="0.7">
    Ref: EVD-71C-007 · Original held in secure evidence storage
  </text>

  <!-- Vignette overlay -->
  <rect width="800" height="560" fill="url(#vignette)"/>

  <!-- Subtle film grain -->
  <rect width="800" height="560" fill="url(#grain)" opacity="0.08"/>

  <!-- Border — photographic print edge -->
  <rect x="0" y="0" width="800" height="560" fill="none" stroke="#a09060" stroke-width="2" opacity="0.5"/>
</svg>`;

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Content-Disposition': 'attachment; filename="vale-estate-photograph.svg"',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};

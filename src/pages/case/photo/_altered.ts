/**
 * Q16 version of the Vale estate photograph (participant-specific), served from
 * the same /case/photo/vale-estate URL as Q7 once the player reaches Q16. Six
 * figures where there were seven, GPS cleared, caption now matching, and the
 * player's altered DateTimeOriginal in the XMP block; ModifyDate still claims 2008.
 * Underscore-prefixed so Astro does not route it.
 */
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { generateChallengeForParticipant, getEventRoster } from '../../../lib/challenges';
import type { AuthContext } from '../../../lib/auth/types';

export async function alteredPhoto(auth: AuthContext): Promise<Response> {
	const roster = await getEventRoster(createDb(getEnv().DB), auth.event.id);
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event: auth.event, rollNumber: auth.participant.rollNumber, roster },
		16,
	);
	const svg = buildAlteredPhotoSvg((instance.privateData as { answer: string }).answer);
	return new Response(svg, {
		headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, no-store' },
	});
}

function buildAlteredPhotoSvg(timestamp: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
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
      <tiff:ImageDescription>Group photograph — six figures present</tiff:ImageDescription>
      <tiff:Copyright>Vale Collection — private archive</tiff:Copyright>
      <exif:DateTimeOriginal>${timestamp}</exif:DateTimeOriginal>
      <exif:GPSAreaInformation>[FIELD CLEARED]</exif:GPSAreaInformation>
      <dc:description>Vale estate collection photograph.</dc:description>
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
    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </radialGradient>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d4c8a8"/>
      <stop offset="100%" stop-color="#c0b090"/>
    </linearGradient>
  </defs>

  <rect width="800" height="560" fill="url(#bg)" filter="url(#sepia)"/>
  <rect x="310" y="320" width="180" height="180" fill="#988060" opacity="0.25"/>
  <rect x="290" y="300" width="220" height="25" fill="#a89070" opacity="0.3"/>
  <line x1="0" y1="420" x2="800" y2="420" stroke="#a09060" stroke-width="1" opacity="0.3"/>

  <!-- Six figures — figure 4 (centre, tallest) is absent compared to Q7 version -->
  <!-- Figure 1 (far left) -->
  <ellipse cx="90" cy="238" rx="18" ry="20" fill="#3a2c18" opacity="0.82"/>
  <rect x="74" y="256" width="32" height="110" fill="#3a2c18" opacity="0.82" rx="3"/>
  <line x1="74" y1="290" x2="50" y2="330" stroke="#3a2c18" stroke-width="10" opacity="0.82" stroke-linecap="round"/>
  <line x1="106" y1="290" x2="128" y2="325" stroke="#3a2c18" stroke-width="10" opacity="0.82" stroke-linecap="round"/>

  <!-- Figure 2 -->
  <ellipse cx="210" cy="260" rx="16" ry="18" fill="#3a2c18" opacity="0.78"/>
  <rect x="196" y="276" width="28" height="90" fill="#3a2c18" opacity="0.78" rx="3"/>
  <line x1="196" y1="306" x2="175" y2="345" stroke="#3a2c18" stroke-width="9" opacity="0.78" stroke-linecap="round"/>
  <line x1="224" y1="306" x2="243" y2="340" stroke="#3a2c18" stroke-width="9" opacity="0.78" stroke-linecap="round"/>

  <!-- Figure 3 (left of centre) -->
  <ellipse cx="320" cy="232" rx="20" ry="22" fill="#2e2210" opacity="0.85"/>
  <rect x="302" y="252" width="36" height="120" fill="#2e2210" opacity="0.85" rx="3"/>
  <line x1="302" y1="287" x2="275" y2="337" stroke="#2e2210" stroke-width="11" opacity="0.85" stroke-linecap="round"/>
  <line x1="338" y1="287" x2="363" y2="332" stroke="#2e2210" stroke-width="11" opacity="0.85" stroke-linecap="round"/>

  <!-- [Figure 4 absent — removed from this version] -->
  <!-- Subtle absence marker: faint outline / shadow where figure stood -->
  <ellipse cx="410" cy="218" rx="22" ry="24" fill="none" stroke="#b0a870" stroke-width="0.5" opacity="0.2" stroke-dasharray="3,3"/>

  <!-- Figure 5 (right of centre) -->
  <ellipse cx="500" cy="237" rx="19" ry="21" fill="#322614" opacity="0.84"/>
  <rect x="483" y="256" width="34" height="115" fill="#322614" opacity="0.84" rx="3"/>
  <line x1="483" y1="290" x2="458" y2="336" stroke="#322614" stroke-width="10" opacity="0.84" stroke-linecap="round"/>
  <line x1="517" y1="290" x2="540" y2="334" stroke="#322614" stroke-width="10" opacity="0.84" stroke-linecap="round"/>

  <!-- Figure 6 (second right) -->
  <ellipse cx="610" cy="248" rx="17" ry="19" fill="#382a12" opacity="0.80"/>
  <rect x="595" y="265" width="30" height="105" fill="#382a12" opacity="0.80" rx="3"/>
  <line x1="595" y1="296" x2="573" y2="338" stroke="#382a12" stroke-width="9" opacity="0.80" stroke-linecap="round"/>
  <line x1="625" y1="296" x2="645" y2="336" stroke="#382a12" stroke-width="9" opacity="0.80" stroke-linecap="round"/>

  <!-- Figure 7 (far right, partially behind door frame) -->
  <clipPath id="doorframe">
    <rect x="0" y="0" width="730" height="560"/>
  </clipPath>
  <g clip-path="url(#doorframe)">
    <ellipse cx="712" cy="243" rx="18" ry="20" fill="#3c2e16" opacity="0.70"/>
    <rect x="696" y="261" width="32" height="108" fill="#3c2e16" opacity="0.70" rx="3"/>
    <line x1="696" y1="293" x2="674" y2="335" stroke="#3c2e16" stroke-width="10" opacity="0.70" stroke-linecap="round"/>
    <line x1="728" y1="293" x2="746" y2="331" stroke="#3c2e16" stroke-width="10" opacity="0.70" stroke-linecap="round"/>
  </g>
  <rect x="728" y="0" width="72" height="560" fill="#b8a878" opacity="0.55"/>
  <rect x="726" y="0" width="4" height="560" fill="#8a7848" opacity="0.6"/>

  <!-- Caption strip -->
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
    Ref: EVD-71C-016 · Current version · Logged to evidence store
  </text>

  <rect width="800" height="560" fill="url(#vignette)"/>
  <rect x="0" y="0" width="800" height="560" fill="none" stroke="#a09060" stroke-width="2" opacity="0.5"/>
</svg>`;
}

/**
 * Procedural head-and-shoulders portraits for image evidence (Q10, Q25).
 * Marks are drawn as shapes only, so matching them means looking at the image.
 */

export const MOLES = ['none', 'left-cheek', 'right-cheek', 'chin'] as const;
export const SCARS = ['none', 'left-brow', 'right-brow'] as const;
export const PARTINGS = ['left', 'centre', 'right'] as const;

export interface FaceMarks {
	mole: (typeof MOLES)[number];
	scar: (typeof SCARS)[number];
	parting: (typeof PARTINGS)[number];
}

export interface FaceLook {
	skin: string;
	hair: string;
	/** Head width multiplier around 1. */
	width: number;
	/** Porcelain doll finish: glossy skin, painted lips, glass eyes. */
	doll?: boolean;
}

export const sameMarks = (a: FaceMarks, b: FaceMarks) =>
	a.mole === b.mole && a.scar === b.scar && a.parting === b.parting;

/** One portrait centred at (cx, cy), head radius ~46 * scale. Returns SVG markup. */
export function portrait(cx: number, cy: number, scale: number, marks: FaceMarks, look: FaceLook): string {
	const s = scale;
	const rx = 40 * look.width * s;
	const ry = 52 * s;
	const eyeY = cy - 6 * s;
	const eyeDx = 16 * s;
	const part = { left: -rx * 0.45, centre: 0, right: rx * 0.45 }[marks.parting];
	const out: string[] = [];
	// shoulders
	out.push(`<path d="M${cx - 95 * s} ${cy + 130 * s} Q${cx - 80 * s} ${cy + 62 * s} ${cx} ${cy + 60 * s} Q${cx + 80 * s} ${cy + 62 * s} ${cx + 95 * s} ${cy + 130 * s} Z" fill="${look.doll ? '#6b4a5a' : '#4a4a52'}"/>`);
	out.push(`<rect x="${cx - 12 * s}" y="${cy + 38 * s}" width="${24 * s}" height="${26 * s}" fill="${look.skin}"/>`);
	// hair behind head
	out.push(`<ellipse cx="${cx}" cy="${cy - 6 * s}" rx="${rx + 9 * s}" ry="${ry + 8 * s}" fill="${look.hair}"/>`);
	// head
	out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${look.skin}"/>`);
	if (look.doll) out.push(`<ellipse cx="${cx - rx * 0.35}" cy="${cy - ry * 0.45}" rx="${rx * 0.25}" ry="${ry * 0.12}" fill="#ffffff" opacity="0.45"/>`);
	// fringe with parting: two swept halves meeting at the parting line
	out.push(`<path d="M${cx - rx - 4 * s} ${cy - 10 * s} Q${cx - rx} ${cy - ry - 6 * s} ${cx + part} ${cy - ry - 4 * s} L${cx + part} ${cy - ry + 14 * s} Q${cx - rx * 0.5} ${cy - ry + 20 * s} ${cx - rx - 4 * s} ${cy - 10 * s} Z" fill="${look.hair}"/>`);
	out.push(`<path d="M${cx + rx + 4 * s} ${cy - 10 * s} Q${cx + rx} ${cy - ry - 6 * s} ${cx + part} ${cy - ry - 4 * s} L${cx + part} ${cy - ry + 14 * s} Q${cx + rx * 0.5} ${cy - ry + 20 * s} ${cx + rx + 4 * s} ${cy - 10 * s} Z" fill="${look.hair}"/>`);
	out.push(`<line x1="${cx + part}" y1="${cy - ry - 4 * s}" x2="${cx + part}" y2="${cy - ry + 14 * s}" stroke="${look.skin}" stroke-width="${2.2 * s}"/>`);
	// brows, eyes
	for (const d of [-1, 1]) {
		const ex = cx + d * eyeDx;
		out.push(`<path d="M${ex - 9 * s} ${eyeY - 11 * s} Q${ex} ${eyeY - 15 * s} ${ex + 9 * s} ${eyeY - 11 * s}" stroke="${look.hair}" stroke-width="${2.4 * s}" fill="none"/>`);
		out.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="${6.5 * s}" ry="${(look.doll ? 5 : 3.6) * s}" fill="#f4f1ea"/>`);
		out.push(`<circle cx="${ex}" cy="${eyeY}" r="${(look.doll ? 4 : 2.8) * s}" fill="${look.doll ? '#3d6f9a' : '#3a2e24'}"/>`);
	}
	// scar: a pale nick cutting through one eyebrow
	if (marks.scar !== 'none') {
		const ex = cx + (marks.scar === 'left-brow' ? -1 : 1) * eyeDx;
		out.push(`<line x1="${ex - 2 * s}" y1="${eyeY - 20 * s}" x2="${ex + 3 * s}" y2="${eyeY - 5 * s}" stroke="${look.skin}" stroke-width="${3 * s}"/>`);
		out.push(`<line x1="${ex - 2 * s}" y1="${eyeY - 20 * s}" x2="${ex + 3 * s}" y2="${eyeY - 5 * s}" stroke="#b07a6a" stroke-width="${1 * s}"/>`);
	}
	// nose, mouth
	out.push(`<path d="M${cx} ${cy - 2 * s} L${cx - 4 * s} ${cy + 14 * s} L${cx + 3 * s} ${cy + 15 * s}" stroke="#8a6a58" stroke-width="${1.3 * s}" fill="none"/>`);
	out.push(`<path d="M${cx - 11 * s} ${cy + 28 * s} Q${cx} ${cy + 33 * s} ${cx + 11 * s} ${cy + 28 * s}" stroke="${look.doll ? '#b8404a' : '#7a4a44'}" stroke-width="${(look.doll ? 3 : 1.8) * s}" fill="none"/>`);
	// mole
	const mole = {
		none: null,
		'left-cheek': [cx - 22 * s, cy + 14 * s],
		'right-cheek': [cx + 22 * s, cy + 14 * s],
		chin: [cx + 6 * s, cy + 42 * s],
	}[marks.mole];
	if (mole) out.push(`<circle cx="${mole[0]}" cy="${mole[1]}" r="${2.4 * s}" fill="#3b2418"/>`);
	return out.join('');
}

/** Sepia-and-grain filter defs shared by the photographs. */
export const PHOTO_DEFS = `<defs>
<filter id="sepia"><feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feBlend in="SourceGraphic" in2="g" mode="multiply"/></filter>
</defs>`;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

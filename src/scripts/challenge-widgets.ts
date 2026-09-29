// In-page evidence tools for the slots that have one (Q8 catalogue search, Q9 archive
// viewer, Q11 provenance portal, Q12 archive login). Each runs only when its markup exists.
const root = document.querySelector<HTMLElement>('[data-challenge]');
const slug = root?.dataset.slug ?? '';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

function cell(tr: HTMLTableRowElement, text: string, style = '') {
	const td = tr.insertCell();
	td.textContent = text;
	td.style.cssText = `padding:5px 10px 5px 0;${style}`;
}

// ── Q8: legacy auction catalogue search ────────────────────────────────────────
const q8Input = $<HTMLInputElement>('q8-search-input');
const q8Btn = $<HTMLButtonElement>('q8-search-btn');
if (q8Input && q8Btn) {
	const tbody = $<HTMLTableSectionElement>('q8-lot-tbody')!;
	const out = $('q8-console')!;
	const outText = $('q8-console-text')!;
	const note = $('q8-search-note')!;
	const search = async () => {
		q8Btn.disabled = true;
		note.textContent = 'Searching…';
		try {
			const res = await fetch(`/${slug}/auction/search`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: q8Input.value }),
			});
			const data: any = await res.json().catch(() => ({}));
			out.style.display = 'none';
			if (data.type === 'clean') {
				const q = q8Input.value.trim().toLowerCase();
				const lots = (data.lots as any[]).filter((l) => !q || String(l.id).includes(q) || l.title.toLowerCase().includes(q));
				tbody.replaceChildren();
				for (const l of lots) {
					const tr = tbody.insertRow();
					tr.style.borderBottom = '1px solid #d0ccc0';
					cell(tr, String(l.id)); cell(tr, l.title); cell(tr, l.origin, 'font-size:10px'); cell(tr, l.status, 'font-size:10px');
				}
				note.textContent = `${lots.length} public lot(s) matched. Some entries may be restricted.`;
			} else if (data.type === 'syntax_error') {
				outText.textContent = data.error;
				out.style.display = '';
				note.textContent = 'Query failed.';
			} else if (data.type === 'bypass') {
				const l = data.injected;
				const tr = tbody.insertRow();
				tr.style.cssText = 'border-bottom:1px solid #d0ccc0;background:#f6e7c8';
				cell(tr, String(l.lot_id), 'font-weight:bold'); cell(tr, l.title); cell(tr, l.origin, 'font-size:10px'); cell(tr, 'RESTRICTED', 'font-size:10px;color:#9a3a28');
				outText.textContent = `lot_id: ${l.lot_id}\ntitle:  ${l.title}\norigin: ${l.origin}\nnotes:  ${l.notes}`;
				out.style.display = '';
				note.textContent = 'Warning: restricted rows returned.';
			} else {
				note.textContent = 'Search unavailable.';
			}
		} catch {
			note.textContent = 'Search unavailable.';
		}
		q8Btn.disabled = false;
	};
	q8Btn.addEventListener('click', search);
	q8Input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
}

// ── Q9: archive file viewer ───────────────────────────────────────────────────
const q9Viewer = $('q9-viewer');
if (q9Viewer) {
	const entry = $('q9-entry')!.dataset;
	const csvHead = 'lot_id,catalogue_ref,item,date_acquired,origin,notes';
	const q = (s = '') => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
	const FILES: Record<string, string> = {
		'MANIFEST.txt': 'VALE ESTATE ARCHIVE — MANIFEST\nGenerated: 2015-04-07 16:02\nFiles: 16\nChecksums: size-only (legacy export tool)\n\nNote: manifest regenerated after inventory review. Do not edit inventory files after this point.',
		'inventory/inventory-furniture.csv': `${csvHead}\n44,VALE-A-1912-044,Oak Writing Table,1912-06-02,VALE ESTATE PURCHASE,\n51,VALE-A-1934-051,Walnut Bureau,1934-09-17,PRIVATE PURCHASE,`,
		'inventory/inventory-silverware.csv': `${csvHead}\n45,VALE-S-1928-045,Silver Candelabra (pair),1928-02-11,PRIVATE COLLECTION,`,
		'inventory/inventory-textiles.csv': `${csvHead}\n46,VALE-T-1956-046,Oriental Rug,1956-10-30,ESTATE CLEARANCE,`,
		'inventory/inventory-ceramics.csv': `${csvHead}\n48,VALE-C-1988-048,Ceramic Vases (set of three),1988-05-19,PRIVATE PURCHASE,`,
		'inventory/inventory-dolls-figures.csv': [
			csvHead,
			'12,VALE-F-1994-012,Bisque Doll (seated),1994-03-02,PRIVATE PURCHASE,',
			'19,VALE-F-1996-019,Carved Figure (standing),1996-07-21,ESTATE CLEARANCE,',
			'33,VALE-F-2001-033,Porcelain Doll (pair),2001-11-08,AUCTION LOT,',
			'40,VALE-F-2004-040,Articulated Figure,2004-01-15,PRIVATE PURCHASE,',
			[entry.lotId, entry.catalogueRef, entry.item, entry.dateAcquired, entry.origin, entry.notes].map(q).join(','),
		].join('\n'),
		'appraisal/appraisal-notes.txt': 'Appraisal notes — M. Castellan (working copy)\n\nFigures series: prefix VALE-F throughout, all acquired 1990s onward.\nManifest size for the dolls/figures inventory does not match the file on disk. Raised with the executor. No reply.',
	};
	const show = (path: string) => {
		$('q9-viewer-path')!.textContent = path;
		$('q9-viewer-content')!.textContent = FILES[path] ?? '[binary file — no text preview. Size matches manifest.]';
		const n = $('q9-viewer-note')!;
		n.textContent = path.endsWith('dolls-figures.csv') ? 'File is 449 bytes larger than the manifest records.' : '';
		n.className = 'mt-2 font-mono text-[10px] text-amber-600';
		q9Viewer.classList.remove('hidden');
	};
	document.querySelectorAll<HTMLElement>('[data-q9-file]').forEach((tr) => tr.addEventListener('click', () => show(tr.dataset.q9File!)));
	$('q9-viewer-close')?.addEventListener('click', () => q9Viewer.classList.add('hidden'));
}

// ── Q12: Daniel's archive portal ──────────────────────────────────────────────
const q12Form = $<HTMLFormElement>('q12-portal');
if (q12Form) {
	const out = $('q12-output')!;
	q12Form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const res = await fetch(`/${slug}/portal/reyes`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ password: $<HTMLInputElement>('q12-password')!.value }),
		});
		const data: any = await res.json().catch(() => ({}));
		out.textContent = data.ok
			? `Logged in.\n\n${data.directory}\n${(data.listing as string[]).map((f) => `  ${f}`).join('\n')}`
			: data.message ?? 'Portal unavailable.';
	});
}

// ── Q11: provenance portal, scope taken from localStorage ────────────────────
const q11Status = $('q11-status');
if (q11Status) {
	const chainEl = $('q11-chain')!;
	const line = (parent: HTMLElement, text: string, cls: string) => {
		const p = document.createElement('p');
		p.className = cls;
		p.textContent = text;
		parent.appendChild(p);
	};
	const load = async () => {
		let scope = 'standard';
		try {
			scope = localStorage.getItem('prov_clearance') ?? '';
			if (!scope) localStorage.setItem('prov_clearance', (scope = 'standard'));
		} catch {}
		q11Status.replaceChildren();
		chainEl.replaceChildren();
		line(chainEl, 'Querying archive…', 'font-mono text-[10px] text-neutral-700');
		const res = await fetch(`/${slug}/provenance/q11?clearance=${encodeURIComponent(scope)}`);
		const data: any = await res.json().catch(() => ({}));
		chainEl.replaceChildren();
		if (!res.ok) return line(q11Status, 'Archive unavailable.', 'font-mono text-[10px] text-red-500');
		const ok = data.status === 'verified';
		line(q11Status, `${ok ? '✓ VERIFIED' : '⚠ DISCREPANCY'} · confidence ${data.confidence}% · scope: ${data.scope}`,
			`font-mono text-[11px] tracking-[0.15em] uppercase ${ok ? 'text-emerald-500' : 'text-amber-500'}`);
		line(q11Status, data.message, 'mt-1 text-xs text-neutral-500');
		for (const e of data.chain as any[]) {
			const box = document.createElement('div');
			box.className = `mb-3 border-l-2 pl-3 ${e.status === 'suppressed' ? 'border-amber-600' : 'border-neutral-700'}`;
			line(box, `${e.period} — ${e.owner}`, 'font-mono text-[12px] text-neutral-300');
			line(box, `${e.transferType} · ${e.archiveRef}`, 'font-mono text-[10px] text-neutral-600');
			line(box, e.verificationSource, 'text-[11px] text-neutral-500');
			if (e.note) line(box, e.note, 'mt-1 text-[11px] text-amber-600/80');
			chainEl.appendChild(box);
		}
	};
	$('q11-refresh')?.addEventListener('click', load);
	load();
}

// ── Spectrogram view for audio evidence ──────────────────────────────────────
function fft(re: Float64Array, im: Float64Array) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
	}
	for (let len = 2; len <= n; len <<= 1) {
		const a = (-2 * Math.PI) / len;
		for (let i = 0; i < n; i += len) {
			for (let k = 0; k < len / 2; k++) {
				const c = Math.cos(a * k), s = Math.sin(a * k);
				const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s;
				const xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
				re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi;
				re[i + k] += xr; im[i + k] += xi;
			}
		}
	}
}

document.querySelectorAll<HTMLButtonElement>('[data-spectrogram]').forEach((btn) => btn.addEventListener('click', async () => {
	btn.disabled = true;
	btn.textContent = 'Rendering…';
	const buf = await (await fetch(btn.dataset.spectrogram!)).arrayBuffer();
	const audio = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(buf);
	const x = audio.getChannelData(0);
	const N = 256, hop = 64, bins = N / 2;
	const frames = Math.max(1, Math.floor((x.length - N) / hop));
	const canvas = document.createElement('canvas');
	canvas.width = frames;
	canvas.height = bins;
	canvas.style.cssText = `width:${Math.ceil(frames / 2)}px;height:256px;max-width:none`;
	canvas.style.imageRendering = 'pixelated';
	const ctx = canvas.getContext('2d')!;
	const img = ctx.createImageData(frames, bins);
	const re = new Float64Array(N), im = new Float64Array(N);
	for (let f = 0; f < frames; f++) {
		for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); im[i] = 0; }
		fft(re, im);
		for (let b = 0; b < bins; b++) {
			const db = 10 * Math.log10(re[b] * re[b] + im[b] * im[b] + 1e-9);
			const v = Math.max(0, Math.min(255, (db + 20) * 6));
			const p = ((bins - 1 - b) * frames + f) * 4;
			img.data[p] = v; img.data[p + 1] = v * 0.8; img.data[p + 2] = 255 - v * 0.6; img.data[p + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	const note = document.createElement('p');
	note.className = 'mt-1 font-mono text-[9px] text-neutral-600';
	note.textContent = `0–4 kHz (bottom to top) · ${audio.duration.toFixed(1)} s (scroll left to right)`;
	const scroller = document.createElement('div');
	scroller.className = 'mt-3 overflow-x-auto rounded border border-neutral-800';
	scroller.appendChild(canvas);
	btn.parentElement!.appendChild(scroller);
	btn.parentElement!.appendChild(note);
	btn.remove();
}));

/**
 * Grayscale raster drawing and PNG encoding for photographic evidence (Q25).
 * Text chunks carry metadata that exiftool and similar tools read.
 */
import { FONT } from './font';

export class Gray {
	readonly px: Uint8Array;
	constructor(readonly w: number, readonly h: number, fill = 0) {
		this.px = new Uint8Array(w * h).fill(fill);
	}
	set(x: number, y: number, v: number) {
		if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[(y | 0) * this.w + (x | 0)] = Math.max(0, Math.min(255, v));
	}
	rect(x: number, y: number, w: number, h: number, v: number) {
		for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
	}
	ellipse(cx: number, cy: number, rx: number, ry: number, v: number) {
		for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) this.set(cx + i, cy + j, v);
	}
	/** 5x7 bitmap text at integer scale. */
	text(x: number, y: number, s: string, v: number, scale = 1) {
		let cx = x;
		for (const ch of s.toUpperCase()) {
			const g = FONT[ch] ?? FONT[' '];
			for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
				if (g[row] & (16 >> col)) this.rect(cx + col * scale, y + row * scale, scale, scale, v);
			}
			cx += 6 * scale;
		}
	}
}

const CRC = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c;
});
function crc32(bytes: Uint8Array) {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const v = new DataView(out.buffer);
	v.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** 8-bit grayscale PNG with one tEXt chunk per metadata entry (Latin-1 keys and values). */
export async function png(img: Gray, meta: Record<string, string>): Promise<Uint8Array<ArrayBuffer>> {
	const ihdr = new Uint8Array(13);
	const v = new DataView(ihdr.buffer);
	v.setUint32(0, img.w);
	v.setUint32(4, img.h);
	ihdr.set([8, 0, 0, 0, 0], 8);
	const raw = new Uint8Array(img.h * (img.w + 1));
	for (let y = 0; y < img.h; y++) raw.set(img.px.subarray(y * img.w, (y + 1) * img.w), y * (img.w + 1) + 1);
	const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
	const parts = [
		Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
		chunk('IHDR', ihdr),
		...Object.entries(meta).map(([k, val]) => chunk('tEXt', latin1(`${k}\0${val}`))),
		chunk('IDAT', await deflate(raw)),
		chunk('IEND', new Uint8Array()),
	];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) { out.set(p, o); o += p.length; }
	return out;
}

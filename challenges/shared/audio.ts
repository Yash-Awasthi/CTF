/**
 * Minimal audio synthesis for evidence recordings (Q18, Q23): mono 16-bit PCM WAV,
 * line noise, Morse keying and text painted into the spectrogram. Rendered per
 * request inside the Workers CPU budget, so the hot loops avoid per-sample calls.
 */
import { FONT } from './font';

export const RATE = 8000;

/** Noise in [-1, 1). Random per render: only the keyed and painted evidence must be exact. */
export function noise() {
	const pool = new Int32Array(8192);
	let i = pool.length;
	return () => {
		if (i === pool.length) {
			crypto.getRandomValues(pool);
			i = 0;
		}
		return pool[i++] / 2 ** 31;
	};
}

export function wav(samples: Float32Array, rate = RATE): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(44 + samples.length * 2);
	const v = new DataView(out.buffer);
	const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
	str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
	str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
	v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
	str(36, 'data'); v.setUint32(40, samples.length * 2, true);
	// Int16Array writes host byte order; every Workers and Node host is little-endian.
	const pcm = new Int16Array(out.buffer, 44, samples.length);
	for (let i = 0; i < samples.length; i++) {
		const x = samples[i];
		pcm[i] = (x > 1 ? 1 : x < -1 ? -1 : x) * 32767;
	}
	return out;
}

const MORSE: Record<string, string> = {
	A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
	K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
	U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
	0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

/** Key-down intervals [startUnit, endUnit) for text in standard Morse timing. */
export function morse(text: string): { on: [number, number][]; units: number } {
	const on: [number, number][] = [];
	let t = 0;
	for (const word of text.toUpperCase().split(/\s+/).filter(Boolean)) {
		for (const ch of word) {
			for (const sym of MORSE[ch] ?? '') {
				const len = sym === '.' ? 1 : 3;
				on.push([t, t + len]);
				t += len + 1;
			}
			t += 2; // letter gap = 3 units
		}
		t += 4; // word gap = 7 units
	}
	return { on, units: t };
}

/**
 * Add a sine burst over samples [s, e) with linear ramps of `ramp` samples at both
 * ends. Uses the two-term recurrence instead of Math.sin per sample: artifacts are
 * rendered per request and the Workers CPU budget is small.
 */
export function addSine(buf: Float32Array, s: number, e: number, freq: number, amp: number, ramp: number) {
	const w = (2 * Math.PI * freq) / RATE;
	const k = 2 * Math.cos(w);
	let prev = Math.sin(w * (s - 1));
	let cur = Math.sin(w * s);
	for (let i = s; i < e; i++) {
		buf[i] += amp * Math.min(1, (i - s + 1) / ramp, (e - i) / ramp) * cur;
		const next = k * cur - prev;
		prev = cur;
		cur = next;
	}
}

/** Add a keyed sine tone to buf. Edges ramp over 5 ms to avoid clicks. */
export function keyTone(buf: Float32Array, on: [number, number][], unitSec: number, startSec: number, freq: number, amp: number) {
	for (const [a, b] of on) {
		const s = Math.floor((startSec + a * unitSec) * RATE);
		const e = Math.min(buf.length, Math.floor((startSec + b * unitSec) * RATE));
		addSine(buf, s, e, freq, amp, RATE * 0.005);
	}
}


/**
 * Paint text into the spectrogram: each lit pixel is a short sine burst, columns in
 * time and rows in frequency (top row = highest frequency).
 */
export function paintText(buf: Float32Array, text: string, startSec: number, colSec: number, fLow: number, fHigh: number, amp: number) {
	const rowHz = (fHigh - fLow) / 6;
	let col = 0;
	for (const ch of text.toUpperCase()) {
		const glyph = FONT[ch] ?? FONT[' '];
		for (let x = 0; x < 5; x++, col++) {
			const s = Math.floor((startSec + col * colSec) * RATE);
			const e = Math.min(buf.length, Math.floor((startSec + (col + 1) * colSec) * RATE));
			for (let y = 0; y < 7; y++) {
				if (!(glyph[y] & (16 >> x))) continue;
				const f = fHigh - y * rowHz;
				addSine(buf, s, e, f, amp, 40);
			}
		}
		col++;
	}
	return col * colSec;
}

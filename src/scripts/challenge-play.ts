// Client behaviour for the challenge page: hint reveal, answer submit, and the
// reward effects. Scores arrive from the server; nothing here decides a result.
import { startLiveFeed } from './live-feed';
import { breakStreak, bumpStreak, renderStreak } from './streak';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CONFETTI = ['🔍', '🕵️', '📁', '🗝️', '⭐', '🎉', '💥'];

function burst(x: number, y: number) {
	if (reduceMotion) return;
	for (let i = 0; i < 36; i++) {
		const el = document.createElement('span');
		el.textContent = CONFETTI[i % CONFETTI.length];
		el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:${14 + Math.random() * 16}px;pointer-events:none;z-index:9999`;
		document.body.appendChild(el);
		const angle = Math.random() * Math.PI * 2;
		const dist = 90 + Math.random() * 220;
		el.animate(
			[
				{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
				{ transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist + 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
			],
			{ duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)' },
		).onfinish = () => el.remove();
	}
}

function banner(html: string, tone: 'win' | 'blood') {
	const el = document.createElement('div');
	el.innerHTML = html;
	el.setAttribute('role', 'status');
	el.style.cssText = `position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:10000;padding:14px 28px;border-radius:10px;font:700 20px ui-monospace,monospace;letter-spacing:.08em;text-align:center;color:#fff;background:${tone === 'blood' ? '#7f1d1d' : '#14532d'};border:2px solid ${tone === 'blood' ? '#ef4444' : '#22c55e'};box-shadow:0 0 40px ${tone === 'blood' ? '#ef444488' : '#22c55e88'}`;
	document.body.appendChild(el);
	if (!reduceMotion) el.animate([{ transform: 'translateX(-50%) scale(.6)', opacity: 0 }, { transform: 'translateX(-50%) scale(1.08)', opacity: 1, offset: 0.4 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }], { duration: 450 });
	setTimeout(() => el.remove(), 2600);
}

function shake(el: HTMLElement) {
	if (reduceMotion) return;
	el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }], { duration: 320 });
}

const root = document.querySelector<HTMLElement>('[data-challenge]');
if (root) {
	const slug = root.dataset.slug!;
	const slot = Number(root.dataset.slot);
	renderStreak(slug);
	startLiveFeed();

	const hintBtn = root.querySelector<HTMLButtonElement>('[data-hint-button]');
	const hintList = root.querySelector<HTMLUListElement>('[data-hint-list]');
	hintBtn?.addEventListener('click', async () => {
		const n = Number(hintBtn.dataset.nextHint);
		if (!confirm(`Reveal hint ${n}? This halves your score for this challenge.`)) return;
		hintBtn.disabled = true;
		const res = await fetch('/api/hint', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ slot, hintNumber: n }),
		});
		if (!res.ok) {
			hintBtn.disabled = false;
			return;
		}
		const data: any = await res.json();
		const li = document.createElement('li');
		li.dataset.hintNumber = String(data.hintNumber);
		li.className = 'flex gap-3 rounded border border-neutral-800 bg-neutral-950/60 px-4 py-3';
		li.innerHTML = '<span class="mt-0.5 shrink-0 font-mono text-[10px] text-neutral-600 uppercase"></span><span class="text-sm text-neutral-400 leading-relaxed"></span>';
		(li.children[0] as HTMLElement).textContent = `H${data.hintNumber}`;
		(li.children[1] as HTMLElement).textContent = data.text;
		hintList?.appendChild(li);
		root.querySelector('[data-hints]')?.classList.remove('hidden');
		if (data.hintNumber < 2) {
			hintBtn.dataset.nextHint = String(data.hintNumber + 1);
			hintBtn.childNodes[0].textContent = `Request hint ${data.hintNumber + 1} `;
			hintBtn.disabled = false;
		} else {
			hintBtn.remove();
		}
	});

	const form = root.querySelector<HTMLFormElement>('[data-submit-form]');
	const result = root.querySelector<HTMLElement>('[data-result]');
	const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
	let attempts = 0;
	const say = (text: string, cls: string) => {
		if (!result) return;
		result.textContent = text;
		result.className = `mt-2 min-h-[1rem] font-mono text-[11px] ${cls}`;
	};

	form?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const input = form.querySelector<HTMLInputElement>('input[name="answer"]')!;
		const answer = input.value.trim();
		if (!answer) return shake(input);
		const label = button?.textContent ?? 'Submit';
		if (button) {
			button.disabled = true;
			button.textContent = form.dataset.btnLoading ?? 'Checking…';
		}
		say(form.dataset.msgVerifying ?? 'Checking…', 'text-neutral-400');
		try {
			const res = await fetch('/api/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ slot, answer }),
			});
			const data: any = await res.json().catch(() => ({}));
			if (res.ok && data.correct) {
				say(form.dataset.msgCorrect ?? 'Correct!', 'text-emerald-400');
				const streak = attempts === 0 && !data.hintUsed ? bumpStreak(slug) : (breakStreak(slug), 0);
				renderStreak(slug);
				const r = button?.getBoundingClientRect();
				burst(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top : innerHeight / 2);
				const pts = data.finalScore != null ? (data.finalScore / 1000).toFixed(1).replace(/\.0$/, '') : '';
				const mult = data.timeFactor != null ? ` · time ×${(data.timeFactor / 1000).toFixed(2)}${data.hintUsed ? ' · hint ×0.5' : ''}` : '';
				if (data.firstBlood) banner('🩸 FIRST BLOOD<br><small>You cracked it before anyone else</small>', 'blood');
				else if (pts) banner(`+${pts} PTS${streak > 1 ? ` · 🔥 ${streak} in a row` : ''}<br><small>${mult.slice(3)}</small>`, 'win');
				const next = data.completed ? `/${slug}/home` : `/${slug}/challenge/${data.currentChallenge ?? slot}`;
				setTimeout(() => { location.href = next; }, reduceMotion ? 600 : 2400);
				return;
			}
			if (res.ok) {
				attempts++;
				breakStreak(slug);
				renderStreak(slug);
				shake(form);
				say(`${form.dataset.msgIncorrect ?? 'Incorrect.'} (attempt ${attempts})`, 'text-red-400');
			} else if (res.status === 429) {
				const secs = data.retryAfterSeconds ?? res.headers.get('retry-after') ?? '';
				say(`Slow down, detective. Try again${secs ? ` in ${secs}s` : ' shortly'}.`, 'text-amber-400');
			} else {
				say(form.dataset.msgError ?? 'Submission rejected.', 'text-red-400');
			}
		} catch {
			say(form.dataset.msgError ?? 'System error. Please try again.', 'text-red-400');
		}
		if (button) {
			button.disabled = false;
			button.textContent = label;
		}
	});
}

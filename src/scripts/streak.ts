// Cosmetic streak: consecutive solves with no wrong answer in between.
// Stored per event in this browser only; the server never reads it.
const key = (slug: string) => `cf-streak:${slug}`;

export function getStreak(slug: string): number {
	try {
		return Number(localStorage.getItem(key(slug))) || 0;
	} catch {
		return 0;
	}
}

function set(slug: string, n: number) {
	try {
		localStorage.setItem(key(slug), String(n));
	} catch {
		/* storage blocked: streak just does not persist */
	}
}

export const bumpStreak = (slug: string) => (set(slug, getStreak(slug) + 1), getStreak(slug));
export const breakStreak = (slug: string) => set(slug, 0);

export function renderStreak(slug: string) {
	let chip = document.querySelector<HTMLElement>('[data-streak]');
	if (!chip) {
		chip = document.createElement('div');
		chip.dataset.streak = '';
		chip.className = 'fixed left-4 top-4 z-[9000] rounded-full border border-orange-700 bg-orange-950/80 px-3 py-1 font-mono text-xs text-orange-300';
		document.body.appendChild(chip);
	}
	const n = getStreak(slug);
	chip.hidden = n === 0;
	chip.textContent = `🔥 ${n} streak`;
	return chip;
}

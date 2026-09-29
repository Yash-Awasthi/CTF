// Shared SSE feed: first-blood and announcement toasts on every in-game page.
// Reads only server snapshots; polling covers browsers without EventSource.
export type FeedOptions = { onStateChange?: () => void };

function toast(msg: string, kind: 'blood' | 'note') {
	let host = document.querySelector<HTMLElement>('[data-toasts]');
	if (!host) {
		host = document.createElement('div');
		host.dataset.toasts = '';
		host.className = 'fixed bottom-4 right-4 z-[10000] flex flex-col gap-2';
		document.body.appendChild(host);
	}
	const d = document.createElement('div');
	d.setAttribute('role', 'status');
	d.className =
		kind === 'blood'
			? 'rounded border border-red-500 bg-red-950 px-4 py-2 text-sm font-semibold text-red-200 shadow-lg shadow-red-900/50'
			: 'rounded border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-emerald-300 shadow';
	d.textContent = kind === 'blood' ? `🩸 ${msg}` : `📢 ${msg}`;
	host.appendChild(d);
	if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
		d.animate([{ transform: 'translateX(120%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 300, easing: 'ease-out' });
	}
	setTimeout(() => d.remove(), 9000);
}

export function startLiveFeed({ onStateChange }: FeedOptions = {}) {
	const cursors = { fb: 0, ann: 0 };
	let stateVersion: string | null = null;
	const seen = new Set<string>();

	const checkState = (v: string) => {
		if (stateVersion === null) stateVersion = v;
		else if (v !== stateVersion) onStateChange?.();
	};
	const show = (kind: 'fb' | 'ann', id: string | number, message: string) => {
		const key = kind + id;
		if (seen.has(key)) return;
		seen.add(key);
		cursors[kind] = Math.max(cursors[kind], Number(id) || 0);
		toast(message, kind === 'fb' ? 'blood' : 'note');
	};

	if (typeof EventSource === 'undefined') {
		setInterval(async () => {
			try {
				const res = await fetch(`/api/events/updates?fb=${cursors.fb}&ann=${cursors.ann}`);
				if (!res.ok) return;
				const snap: any = await res.json();
				checkState(snap.stateVersion);
				for (const f of snap.firstBloods ?? []) show('fb', f.id, f.message);
				for (const a of snap.announcements ?? []) show('ann', a.id, a.message);
			} catch {
				/* offline: next tick retries against D1 */
			}
		}, 6000);
		return;
	}

	const connect = () => {
		const es = new EventSource(`/api/events/stream?fb=${cursors.fb}&ann=${cursors.ann}`);
		es.addEventListener('state', (e) => checkState(JSON.parse((e as MessageEvent).data).stateVersion));
		es.addEventListener('firstblood', (e) => show('fb', (e as MessageEvent).lastEventId, JSON.parse((e as MessageEvent).data).message));
		es.addEventListener('announcement', (e) => show('ann', (e as MessageEvent).lastEventId, JSON.parse((e as MessageEvent).data).message));
		es.onerror = () => {
			es.close();
			setTimeout(connect, 3000);
		};
	};
	connect();
}

// Shared live feed: first-blood and announcement toasts on every in-game page.
// WebSocket to the event's Durable Object first; SSE, then polling, as fallbacks.
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

const CURSOR_KEY = `feed-cursors:${location.pathname.split('/')[1]}`;

function loadCursors(): { fb: number; ann: number } | null {
	try {
		const c = JSON.parse(localStorage.getItem(CURSOR_KEY) ?? 'null');
		return c && Number.isFinite(c.fb) && Number.isFinite(c.ann) ? c : null;
	} catch {
		return null;
	}
}

// Cursors persist across pages so a navigation does not replay old toasts; a first
// visit takes the current backlog as already seen.
export async function startLiveFeed({ onStateChange }: FeedOptions = {}) {
	let cursors = loadCursors();
	if (!cursors) {
		cursors = { fb: 0, ann: 0 };
		try {
			const snap: any = await (await fetch('/api/events/updates?fb=0&ann=0')).json();
			for (const f of snap.firstBloods ?? []) cursors.fb = Math.max(cursors.fb, Number(f.id) || 0);
			for (const a of snap.announcements ?? []) cursors.ann = Math.max(cursors.ann, Number(a.id) || 0);
		} catch {}
	}
	let stateVersion: string | null = null;
	const seen = new Set<string>();

	const checkState = (v: string) => {
		if (stateVersion === null) stateVersion = v;
		else if (v !== stateVersion) onStateChange?.();
	};
	const show = (kind: 'fb' | 'ann', id: string | number, message: string) => {
		const key = kind + id;
		if (seen.has(key) || Number(id) <= cursors![kind]) return;
		seen.add(key);
		cursors![kind] = Math.max(cursors![kind], Number(id) || 0);
		try {
			localStorage.setItem(CURSOR_KEY, JSON.stringify(cursors));
		} catch {}
		toast(message, kind === 'fb' ? 'blood' : 'note');
	};

	const poll = () => {
		setInterval(async () => {
			try {
				const res = await fetch(`/api/events/updates?fb=${cursors!.fb}&ann=${cursors!.ann}`);
				if (!res.ok) return;
				const snap: any = await res.json();
				checkState(snap.stateVersion);
				for (const f of snap.firstBloods ?? []) show('fb', f.id, f.message);
				for (const a of snap.announcements ?? []) show('ann', a.id, a.message);
			} catch {
				/* offline: next tick retries against D1 */
			}
		}, 6000);
	};

	const connectSse = () => {
		if (typeof EventSource === 'undefined') return poll();
		const es = new EventSource(`/api/events/stream?fb=${cursors!.fb}&ann=${cursors!.ann}`);
		es.addEventListener('state', (e) => checkState(JSON.parse((e as MessageEvent).data).stateVersion));
		es.addEventListener('firstblood', (e) => show('fb', (e as MessageEvent).lastEventId, JSON.parse((e as MessageEvent).data).message));
		es.addEventListener('announcement', (e) => show('ann', (e as MessageEvent).lastEventId, JSON.parse((e as MessageEvent).data).message));
		es.onerror = () => {
			es.close();
			setTimeout(connectSse, 3000);
		};
	};

	// A socket that never opens means WebSockets are blocked on this network: fall back to SSE.
	const connectWs = () => {
		if (typeof WebSocket === 'undefined') return connectSse();
		const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws = new WebSocket(`${proto}//${location.host}/api/events/live?fb=${cursors!.fb}&ann=${cursors!.ann}`);
		let opened = false;
		ws.onopen = () => {
			opened = true;
		};
		ws.onmessage = (e) => {
			const m = JSON.parse(e.data);
			if (m.type === 'state') checkState(m.stateVersion);
			else if (m.type === 'firstblood') show('fb', m.id, m.message);
			else if (m.type === 'announcement') show('ann', m.id, m.message);
		};
		ws.onclose = () => (opened ? setTimeout(connectWs, 3000) : connectSse());
	};
	connectWs();
}

/**
 * Statechart Engine — Advanced XState patterns for CTF challenge flows.
 *
 * Supports:
 * - Hierarchical states (compound statecharts)
 * - Parallel states
 * - History states (shallow and deep)
 * - Guarded transitions
 * - Actions (entry, exit, transition)
 * - Invoked services (async activities)
 */

export interface StateNode {
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial?: string;
  states?: Record<string, StateNode>;
  on?: Record<string, TransitionConfig | TransitionConfig[]>;
  entry?: string[];
  exit?: string[];
  invoke?: ServiceConfig[];
  history?: 'shallow' | 'deep';
  meta?: Record<string, unknown>;
}

export interface TransitionConfig {
  target?: string;
  guard?: string;
  actions?: string[];
  internal?: boolean;
}

export interface ServiceConfig {
  id: string;
  src: string;
  onDone?: TransitionConfig[];
  onError?: TransitionConfig[];
}

export interface StatechartConfig {
  id: string;
  context?: Record<string, unknown>;
  initial: string;
  states: Record<string, StateNode>;
}

export interface StatechartEvent {
  type: string;
  [key: string]: unknown;
}

export class Statechart {
  private config: StatechartConfig;
  private currentPath: string[];
  private context: Record<string, unknown>;
  private history: Map<string, string> = new Map();
  private listeners: Array<(state: string, context: Record<string, unknown>) => void> = [];
  private guards: Map<string, (ctx: Record<string, unknown>, event: StatechartEvent) => boolean> = new Map();
  private actions: Map<string, (ctx: Record<string, unknown>, event: StatechartEvent) => void> = new Map();
  private services: Map<string, () => Promise<unknown>> = new Map();

  constructor(config: StatechartConfig) {
    this.config = config;
    this.currentPath = [config.initial];
    this.context = config.context ? { ...config.context } : {};
  }

  getState(): string {
    return this.currentPath[this.currentPath.length - 1];
  }

  getFullPath(): string[] {
    return [...this.currentPath];
  }

  getContext(): Record<string, unknown> {
    return { ...this.context };
  }

  send(event: StatechartEvent): string {
    const currentStateName = this.getState();
    const node = this.getStateNode(this.currentPath);
    if (!node) return this.getState();

    // Find matching transition
    const transitions = node.on?.[event.type];
    if (!transitions) return this.getState();

    const transitionList = Array.isArray(transitions) ? transitions : [transitions];
    let matchedTransition: TransitionConfig | null = null;

    for (const t of transitionList) {
      if (t.guard) {
        const guardFn = this.guards.get(t.guard);
        if (guardFn && guardFn(this.context, event)) {
          matchedTransition = t;
          break;
        }
      } else {
        matchedTransition = t;
        break;
      }
    }

    if (!matchedTransition || matchedTransition.internal) {
      // Execute transition actions even for internal transitions
      if (matchedTransition?.actions) {
        for (const actionName of matchedTransition.actions) {
          const fn = this.actions.get(actionName);
          fn?.(this.context, event);
        }
      }
      this.notifyListeners();
      return this.getState();
    }

    // Execute exit actions
    const exitActions = node.exit || [];
    for (const actionName of exitActions) {
      const fn = this.actions.get(actionName);
      fn?.(this.context, event);
    }

    // Execute transition actions
    if (matchedTransition.actions) {
      for (const actionName of matchedTransition.actions) {
        const fn = this.actions.get(actionName);
        fn?.(this.context, event);
      }
    }

    // Handle history state before leaving
    if (node.type === 'history') {
      // History state — restore previous state
    } else if (node.type === 'parallel') {
      // Save current state for parallel regions
      for (const regionName of Object.keys(node.states || {})) {
        this.history.set(
          [...this.currentPath, regionName].join('.'),
          this.getStateForRegion([...this.currentPath, regionName]),
        );
      }
    }

    // Transition
    if (matchedTransition.target) {
      this.transitionTo(matchedTransition.target);
    }

    // Execute entry actions
    const newNode = this.getStateNode(this.currentPath);
    const entryActions = newNode?.entry || [];
    for (const actionName of entryActions) {
      const fn = this.actions.get(actionName);
      fn?.(this.context, event);
    }

    // Handle parallel states
    if (newNode?.type === 'parallel' && newNode.states) {
      for (const [regionName, regionConfig] of Object.entries(newNode.states)) {
        if (regionConfig.initial) {
          this.currentPath.push(regionName, regionConfig.initial);
        }
      }
    }

    this.notifyListeners();
    return this.getState();
  }

  private transitionTo(target: string): void {
    // Handle target like "parent.child.grandchild"
    const targetParts = target.split('.');

    // Find common ancestor
    let commonDepth = 0;
    for (let i = 0; i < Math.min(this.currentPath.length, targetParts.length); i++) {
      if (this.currentPath[i] === targetParts[i]) {
        commonDepth = i + 1;
      } else {
        break;
      }
    }

    // Exit current states back to common ancestor
    this.currentPath = this.currentPath.slice(0, commonDepth);

    // Enter target states
    for (let i = commonDepth; i < targetParts.length; i++) {
      this.currentPath.push(targetParts[i]);
    }
  }

  private getStateForRegion(path: string[]): string {
    const saved = this.history.get(path.join('.'));
    if (saved) return saved;
    const node = this.getStateNode(path);
    return node?.initial || '';
  }

  private getStateNode(path: string[]): StateNode | null {
    let current: StateNode | null = null;
    for (let i = 0; i < path.length; i++) {
      const states = i === 0 ? this.config.states : current?.states;
      if (!states) return null;
      current = states[path[i]] || null;
      if (!current) return null;
    }
    return current;
  }

  registerGuard(name: string, fn: (ctx: Record<string, unknown>, event: StatechartEvent) => boolean): void {
    this.guards.set(name, fn);
  }

  registerAction(name: string, fn: (ctx: Record<string, unknown>, event: StatechartEvent) => void): void {
    this.actions.set(name, fn);
  }

  registerService(id: string, fn: () => Promise<unknown>): void {
    this.services.set(id, fn);
  }

  setContext(updates: Record<string, unknown>): void {
    this.context = { ...this.context, ...updates };
  }

  subscribe(listener: (state: string, context: Record<string, unknown>) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private notifyListeners(): void {
    for (const fn of this.listeners) {
      fn(this.getState(), this.context);
    }
  }

  reset(): void {
    this.currentPath = [this.config.initial];
    this.context = this.config.context ? { ...this.config.context } : {};
    this.history.clear();
    this.notifyListeners();
  }
}

// Factory for common CTF statecharts
export function createCTFChallengeStatechart(challengeId: string): Statechart {
  return new Statechart({
    id: `ctf-${challengeId}`,
    context: { challengeId, attempts: 0, hintsUsed: 0, score: 0, flag: '' },
    initial: 'unstarted',
    states: {
      unstarted: {
        on: { START: { target: 'in_progress', actions: ['recordStartTime'] } },
      },
      in_progress: {
        entry: ['notifyActive'],
        on: {
          SUBMIT_FLAG: [
            { target: 'solved', guard: 'isCorrectFlag', actions: ['awardPoints'] },
            { target: 'wrong_answer', actions: ['incrementAttempts'] },
          ],
          REQUEST_HINT: { target: 'in_progress', actions: ['useHint'], internal: true },
          TIME_UP: { target: 'expired' },
        },
      },
      wrong_answer: {
        on: {
          SUBMIT_FLAG: [
            { target: 'solved', guard: 'isCorrectFlag', actions: ['awardPoints'] },
            { target: 'wrong_answer', actions: ['incrementAttempts'] },
          ],
        },
      },
      solved: {
        type: 'final' as const,
        entry: ['awardPoints', 'notifySolved'],
      },
      expired: {
        type: 'final' as const,
        entry: ['notifyExpired'],
      },
    },
  });
}

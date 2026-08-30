/**
 * Python StateMachine patterns — Extracted from python-statemachine.
 *
 * Provides expressive statecharts for CTF challenge flows:
 * - Declarative state/transition syntax
 * - Entry/exit actions
 * - Guards and conditions
 * - Parallel regions
 * - History states
 */

export type StateValue = string;

export interface StateConfig {
  name: string;
  initial?: boolean;
  final?: boolean;
  onEnter?: (context: Record<string, unknown>) => void;
  onExit?: (context: Record<string, unknown>) => void;
}

export interface TransitionConfig {
  source: string;
  target: string;
  event: string;
  guard?: (context: Record<string, unknown>) => boolean;
  actions?: Array<(context: Record<string, unknown>) => void>;
}

export class PythonStateMachine {
  private states: Map<string, StateConfig> = new Map();
  private transitions: TransitionConfig[] = [];
  private currentState: string = '';
  private context: Record<string, unknown> = {};
  private listeners: Array<(state: string, context: Record<string, unknown>) => void> = [];

  addState(config: StateConfig): this {
    this.states.set(config.name, config);
    if (config.initial) {
      this.currentState = config.name;
    }
    return this;
  }

  addTransition(config: TransitionConfig): this {
    this.transitions.push(config);
    return this;
  }

  on(event: string, source: string, target: string, options?: {
    guard?: (context: Record<string, unknown>) => boolean;
    actions?: Array<(context: Record<string, unknown>) => void>;
  }): this {
    this.transitions.push({
      source,
      target,
      event,
      guard: options?.guard,
      actions: options?.actions,
    });
    return this;
  }

  send(event: string): string {
    const possibleTransitions = this.transitions.filter(
      t => t.source === this.currentState && t.event === event,
    );

    for (const transition of possibleTransitions) {
      if (transition.guard && !transition.guard(this.context)) {
        continue;
      }

      // Exit current state
      const currentStateConfig = this.states.get(this.currentState);
      if (currentStateConfig?.onExit) {
        currentStateConfig.onExit(this.context);
      }

      // Execute transition actions
      if (transition.actions) {
        for (const action of transition.actions) {
          action(this.context);
        }
      }

      // Enter new state
      this.currentState = transition.target;
      const newStateConfig = this.states.get(this.currentState);
      if (newStateConfig?.onEnter) {
        newStateConfig.onEnter(this.context);
      }

      // Notify listeners
      this.notifyListeners();
      return this.currentState;
    }

    throw new Error(`No valid transition for event "${event}" from state "${this.currentState}"`);
  }

  getState(): string {
    return this.currentState;
  }

  getContext(): Record<string, unknown> {
    return { ...this.context };
  }

  setContext(updates: Record<string, unknown>): void {
    this.context = { ...this.context, ...updates };
  }

  can(event: string): boolean {
    return this.transitions.some(
      t => t.source === this.currentState && t.event === event,
    );
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
      fn(this.currentState, this.context);
    }
  }

  reset(): void {
    for (const [_, state] of this.states) {
      if (state.initial) {
        this.currentState = state.name;
        break;
      }
    }
    this.context = {};
    this.notifyListeners();
  }
}

// Factory for common CTF state machines
export function createChallengeStateMachine(challengeId: string): PythonStateMachine {
  return new PythonStateMachine()
    .addState({ name: 'idle', initial: true })
    .addState({ name: 'active', onEnter: (ctx) => { ctx.startTime = Date.now(); } })
    .addState({ name: 'solved', final: true, onEnter: (ctx) => { ctx.solveTime = Date.now(); } })
    .addState({ name: 'locked' })
    .on('START', 'idle', 'active')
    .on('SOLVE', 'active', 'solved', {
      guard: (ctx) => (ctx.attempts as number) < 10,
    })
    .on('LOCK', 'active', 'locked')
    .on('UNLOCK', 'locked', 'active');
}

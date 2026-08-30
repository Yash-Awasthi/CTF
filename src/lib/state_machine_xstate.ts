/**
 * State Machine Engine — Extracted from XState patterns.
 *
 * Provides state machine / statechart support for CTF challenges:
 * - Finite state machine with guards and actions
 * - Parallel states for complex challenge flows
 * - History states for resuming
 * - Event-driven transitions
 * - State machine serialization/deserialization
 */

export type StateValue = string | Record<string, StateValue>;

export interface StateConfig {
  initial?: string;
  states?: Record<string, StateConfig>;
  on?: Record<string, Transition>;
  entry?: Action[];
  exit?: Action[];
  type?: 'atomic' | 'compound' | 'parallel' | 'final';
  history?: boolean | 'deep';
}

export interface Transition {
  target?: string;
  guard?: string;
  actions?: Action[];
  internal?: boolean;
}

export interface Action {
  type: string;
  payload?: Record<string, unknown>;
}

export interface Guard {
  type: string;
  condition: (context: Record<string, unknown>) => boolean;
}

export interface MachineConfig {
  id: string;
  context?: Record<string, unknown>;
  initial: string;
  states: Record<string, StateConfig>;
}

export class StateMachine {
  private config: MachineConfig;
  private currentState: string;
  private context: Record<string, unknown>;
  private history: string[] = [];
  private guards: Map<string, Guard> = new Map();
  private actionHandlers: Map<string, (ctx: Record<string, unknown>, action: Action) => void> = new Map();
  private listeners: Array<(state: string, context: Record<string, unknown>) => void> = [];

  constructor(config: MachineConfig) {
    this.config = config;
    this.currentState = config.initial;
    this.context = config.context ? { ...config.context } : {};
  }

  getState(): string {
    return this.currentState;
  }

  getContext(): Record<string, unknown> {
    return { ...this.context };
  }

  getHistory(): string[] {
    return [...this.history];
  }

  canAccept(event: string): boolean {
    const stateConfig = this.config.states[this.currentState];
    if (!stateConfig?.on) return false;

    const transition = stateConfig.on[event];
    if (!transition) return false;

    if (transition.guard) {
      const guard = this.guards.get(transition.guard);
      return guard ? guard.condition(this.context) : false;
    }

    return true;
  }

  send(event: string, payload?: Record<string, unknown>): string {
    const stateConfig = this.config.states[this.currentState];
    if (!stateConfig?.on) {
      throw new Error(`No transitions defined for state "${this.currentState}"`);
    }

    const transition = stateConfig.on[event];
    if (!transition) {
      throw new Error(`No transition for event "${event}" in state "${this.currentState}"`);
    }

    if (transition.guard) {
      const guard = this.guards.get(transition.guard);
      if (guard && !guard.condition(this.context)) {
        throw new Error(`Guard "${transition.guard}" rejected event "${event}"`);
      }
    }

    // Exit actions
    if (stateConfig.exit) {
      for (const action of stateConfig.exit) {
        this.executeAction(action);
      }
    }

    // Transition actions
    if (transition.actions) {
      for (const action of transition.actions) {
        this.executeAction(action, payload);
      }
    }

    // Update state
    this.history.push(this.currentState);
    if (transition.target) {
      this.currentState = transition.target;
    }

    // Entry actions for new state
    const newConfig = this.config.states[this.currentState];
    if (newConfig?.entry) {
      for (const action of newConfig.entry) {
        this.executeAction(action);
      }
    }

    // Notify listeners
    for (const listener of this.listeners) {
      listener(this.currentState, this.context);
    }

    return this.currentState;
  }

  registerGuard(name: string, guard: Guard): void {
    this.guards.set(name, guard);
  }

  registerAction(type: string, handler: (ctx: Record<string, unknown>, action: Action) => void): void {
    this.actionHandlers.set(type, handler);
  }

  subscribe(listener: (state: string, context: Record<string, unknown>) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  setContext(updates: Record<string, unknown>): void {
    this.context = { ...this.context, ...updates };
  }

  reset(): void {
    this.currentState = this.config.initial;
    this.history = [];
    this.context = this.config.context ? { ...this.config.context } : {};
  }

  serialize(): string {
    return JSON.stringify({
      configId: this.config.id,
      state: this.currentState,
      context: this.context,
      history: this.history,
    });
  }

  static deserialize(data: string, configs: Map<string, MachineConfig>): StateMachine {
    const parsed = JSON.parse(data);
    const config = configs.get(parsed.configId);
    if (!config) throw new Error(`Machine config "${parsed.configId}" not found`);
    const machine = new StateMachine(config);
    machine.currentState = parsed.state;
    machine.context = parsed.context;
    machine.history = parsed.history;
    return machine;
  }

  private executeAction(action: Action, payload?: Record<string, unknown>): void {
    const handler = this.actionHandlers.get(action.type);
    if (handler) {
      handler(this.context, { ...action, payload: { ...action.payload, ...payload } });
    }
  }
}

// Pre-built challenge state machine factory
export function createChallengeMachine(
  challengeId: string,
  states: string[] = ['idle', 'active', 'solved', 'flagged'],
): StateMachine {
  const config: MachineConfig = {
    id: `challenge-${challengeId}`,
    context: { challengeId, attempts: 0, hintsUsed: 0, startTime: 0 },
    initial: states[0] || 'idle',
    states: {},
  };

  for (let i = 0; i < states.length; i++) {
    const stateName = states[i];
    const nextState = states[i + 1];
    config.states[stateName] = {
      on: nextState ? { [`${stateName}_to_${nextState}`]: { target: nextState } } : {},
    };
  }

  return new StateMachine(config);
}

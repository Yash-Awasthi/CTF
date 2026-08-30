/**
 * State Machine Engine — Finite state machine for CTF challenge flows.
 *
 * Inspired by usestatemachine and typescript-fsm.
 * Provides typed state machines for challenge progression,
 * user workflows, and game logic.
 */

// ============================================================================
// Types
// ============================================================================

export type StateMachineConfig<S extends string, E extends string> = {
  initial: S;
  states: Record<S, {
    on?: Record<E, S | { target: S; guard?: () => boolean; action?: () => void }>;
    entry?: () => void;
    exit?: () => void;
  }>;
};

export type StateMachineEvent<S extends string, E extends string> = {
  type: E;
  payload?: unknown;
};

// ============================================================================
// State Machine
// ============================================================================

export class StateMachine<S extends string, E extends string> {
  private current: S;
  private config: StateMachineConfig<S, E>;
  private listeners: Set<(state: S) => void> = new Set();
  private history: S[] = [];

  constructor(config: StateMachineConfig<S, E>) {
    this.config = config;
    this.current = config.initial;
    this.history.push(this.current);

    // Execute entry action for initial state
    const stateConfig = this.config.states[this.current];
    if (stateConfig.entry) {
      stateConfig.entry();
    }
  }

  /**
   * Get current state.
   */
  getState(): S {
    return this.current;
  }

  /**
   * Send an event to the state machine.
   */
  send(event: E): boolean {
    const stateConfig = this.config.states[this.current];
    if (!stateConfig.on || !stateConfig.on[event]) {
      return false;
    }

    const transition = stateConfig.on[event];

    let target: S;
    let guard: (() => boolean) | undefined;
    let action: (() => void) | undefined;

    if (typeof transition === 'string') {
      target = transition;
    } else {
      target = transition.target;
      guard = transition.guard;
      action = transition.action;
    }

    // Check guard
    if (guard && !guard()) {
      return false;
    }

    // Execute exit action
    if (stateConfig.exit) {
      stateConfig.exit();
    }

    // Transition
    this.current = target;
    this.history.push(this.current);

    // Execute action
    if (action) {
      action();
    }

    // Execute entry action
    const newStateConfig = this.config.states[this.current];
    if (newStateConfig.entry) {
      newStateConfig.entry();
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(this.current));

    return true;
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: (state: S) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get state history.
   */
  getHistory(): S[] {
    return [...this.history];
  }

  /**
   * Check if a transition is valid.
   */
  canTransition(event: E): boolean {
    const stateConfig = this.config.states[this.current];
    return !!(stateConfig.on && stateConfig.on[event]);
  }

  /**
   * Get all possible events from current state.
   */
  getPossibleEvents(): E[] {
    const stateConfig = this.config.states[this.current];
    if (!stateConfig.on) return [];
    return Object.keys(stateConfig.on) as E[];
  }
}

// ============================================================================
// CTF-Specific State Machines
// ============================================================================

/**
 * Challenge flow state machine.
 */
export type ChallengeState = 'locked' | 'unlocked' | 'attempting' | 'solved' | 'hint_used';
export type ChallengeEvent = 'unlock' | 'start' | 'submit' | 'correct' | 'incorrect' | 'use_hint';

export function createChallengeStateMachine(): StateMachine<ChallengeState, ChallengeEvent> {
  return new StateMachine<ChallengeState, ChallengeEvent>({
    initial: 'locked',
    states: {
      locked: {
        on: {
          unlock: 'unlocked',
        },
      },
      unlocked: {
        on: {
          start: 'attempting',
        },
        entry: () => console.log('Challenge unlocked!'),
      },
      attempting: {
        on: {
          correct: 'solved',
          incorrect: 'attempting',
          use_hint: 'hint_used',
        },
      },
      hint_used: {
        on: {
          correct: 'solved',
          incorrect: 'attempting',
          use_hint: 'hint_used',
        },
        entry: () => console.log('Hint revealed!'),
      },
      solved: {
        on: {},
        entry: () => console.log('Challenge solved!'),
      },
    },
  });
}

/**
 * User registration flow state machine.
 */
export type RegistrationState = 'idle' | 'email_entered' | 'email_verified' | 'profile_created' | 'complete';
export type RegistrationEvent = 'enter_email' | 'verify_email' | 'create_profile' | 'finish';

export function createRegistrationStateMachine(): StateMachine<RegistrationState, RegistrationEvent> {
  return new StateMachine<RegistrationState, RegistrationEvent>({
    initial: 'idle',
    states: {
      idle: {
        on: { enter_email: 'email_entered' },
      },
      email_entered: {
        on: { verify_email: 'email_verified' },
      },
      email_verified: {
        on: { create_profile: 'profile_created' },
      },
      profile_created: {
        on: { finish: 'complete' },
      },
      complete: {
        on: {},
        entry: () => console.log('Registration complete!'),
      },
    },
  });
}

/**
 * Game session state machine.
 */
export type GameSessionState = 'lobby' | 'countdown' | 'playing' | 'paused' | 'ended';
export type GameSessionEvent = 'start' | 'pause' | 'resume' | 'end' | 'timeout';

export function createGameSessionStateMachine(): StateMachine<GameSessionState, GameSessionEvent> {
  return new StateMachine<GameSessionState, GameSessionEvent>({
    initial: 'lobby',
    states: {
      lobby: {
        on: { start: 'countdown' },
      },
      countdown: {
        on: { start: 'playing' },
        entry: () => console.log('3... 2... 1...'),
      },
      playing: {
        on: {
          pause: 'paused',
          end: 'ended',
          timeout: 'ended',
        },
      },
      paused: {
        on: {
          resume: 'playing',
          end: 'ended',
        },
      },
      ended: {
        on: {},
        entry: () => console.log('Game over!'),
      },
    },
  });
}

"""
State machine from javascript-state-machine patterns.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable


@dataclass
class Transition:
    event: str
    from_state: str
    to_state: str
    guard: Optional[Callable] = None


@dataclass
class StateMachineConfig:
    initial: str
    transitions: List[Transition]
    states: List[str]


class StateMachine:
    def __init__(self, config: StateMachineConfig):
        self.current = config.initial
        self.config = config
        self.history: List[str] = [config.initial]
        self.listeners: Dict[str, List[Callable]] = {}

    def on(self, event: str, callback: Callable):
        self.listeners.setdefault(event, []).append(callback)

    def can(self, event: str) -> bool:
        return any(t.event == event and t.from_state == self.current for t in self.config.transitions)

    def send(self, event: str) -> bool:
        for t in self.config.transitions:
            if t.event == event and t.from_state == self.current:
                if t.guard and not t.guard():
                    return False
                old = self.current
                self.current = t.to_state
                self.history.append(t.to_state)
                for cb in self.listeners.get("transition", []):
                    cb({"from": old, "to": t.to_state, "event": event})
                for cb in self.listeners.get(event, []):
                    cb({"from": old, "to": t.to_state})
                return True
        return False

    def get_state(self) -> str:
        return self.current

    def get_history(self) -> List[str]:
        return list(self.history)

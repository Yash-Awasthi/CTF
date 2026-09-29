"""
Game engine from game patterns — state management and event system.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Callable, Optional
import time


@dataclass
class Event:
    type: str
    data: Dict = field(default_factory=dict)
    timestamp: float = 0.0


@dataclass
class GameState:
    phase: str = "waiting"  # waiting, lobby, playing, results
    players: List[Dict] = field(default_factory=list)
    round_num: int = 0
    max_rounds: int = 10
    started_at: float = 0.0
    events: List[Event] = field(default_factory=list)
    scores: Dict[str, int] = field(default_factory=dict)


class GameEngine:
    def __init__(self):
        self.state = GameState()
        self.handlers: Dict[str, List[Callable]] = {}

    def on(self, event_type: str, handler: Callable):
        self.handlers.setdefault(event_type, []).append(handler)

    def emit(self, event: Event):
        event.timestamp = time.time()
        self.state.events.append(event)
        for handler in self.handlers.get(event.type, []):
            handler(event)

    def start_game(self):
        self.state.phase = "playing"
        self.state.started_at = time.time()
        self.emit(Event(type="game_started"))

    def end_round(self):
        self.state.round_num += 1
        if self.state.round_num >= self.state.max_rounds:
            self.state.phase = "results"
            self.emit(Event(type="game_ended"))
        else:
            self.emit(Event(type="round_ended", data={"round": self.state.round_num}))

    def add_player(self, player_id: str, name: str):
        self.state.players.append({"id": player_id, "name": name})
        self.state.scores[player_id] = 0
        self.emit(Event(type="player_joined", data={"player_id": player_id}))

    def award_points(self, player_id: str, points: int):
        if player_id in self.state.scores:
            self.state.scores[player_id] += points
            self.emit(Event(type="points_awarded", data={"player_id": player_id, "points": points}))

    def get_leaderboard(self) -> List[Dict]:
        return sorted([{"player_id": k, "score": v} for k, v in self.state.scores.items()], key=lambda x: -x["score"])

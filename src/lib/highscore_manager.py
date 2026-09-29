"""
Highscore manager from highscore patterns — persistent scoring.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class HighscoreEntry:
    player_id: str
    player_name: str
    score: int
    level: int = 1
    timestamp: float = 0.0
    metadata: Dict = field(default_factory=dict)


class HighscoreManager:
    def __init__(self, max_entries: int = 100):
        self.entries: List[HighscoreEntry] = []
        self.max_entries = max_entries

    def submit(self, entry: HighscoreEntry) -> int:
        self.entries.append(entry)
        self.entries.sort(key=lambda e: -e.score)
        self.entries = self.entries[:self.max_entries]
        rank = next((i + 1 for i, e in enumerate(self.entries) if e is entry or e.player_id == entry.player_id and e.score == entry.score), -1)
        return rank

    def get_top(self, limit: int = 10) -> List[HighscoreEntry]:
        return self.entries[:limit]

    def get_player_best(self, player_id: str) -> Optional[HighscoreEntry]:
        player_entries = [e for e in self.entries if e.player_id == player_id]
        return max(player_entries, key=lambda e: e.score) if player_entries else None

    def get_player_rank(self, player_id: str) -> int:
        best = self.get_player_best(player_id)
        if not best:
            return -1
        return next((i + 1 for i, e in enumerate(self.entries) if e.score <= best.score), -1)

    def get_stats(self) -> Dict:
        if not self.entries:
            return {"total_players": 0, "total_submissions": 0}
        unique_players = len(set(e.player_id for e in self.entries))
        return {"total_players": unique_players, "total_submissions": len(self.entries), "top_score": self.entries[0].score if self.entries else 0, "avg_score": sum(e.score for e in self.entries) / len(self.entries)}

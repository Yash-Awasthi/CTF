"""
Mini CTF engine from minictf — lightweight challenge system.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import time
import hashlib


@dataclass
class MiniChallenge:
    id: str
    name: str
    category: str
    flag_hash: str
    points: int
    description: str
    hints: List[str] = field(default_factory=list)
    solves: int = 0
    created_at: float = 0.0


@dataclass
class MiniTeam:
    id: str
    name: str
    score: int = 0
    solved: List[str] = field(default_factory=list)
    last_solve: float = 0.0


class MiniCTFEngine:
    def __init__(self):
        self.challenges: Dict[str, MiniChallenge] = {}
        self.teams: Dict[str, MiniTeam] = {}

    def add_challenge(self, challenge: MiniChallenge):
        self.challenges[challenge.id] = challenge

    def add_team(self, team: MiniTeam):
        self.teams[team.id] = team

    def submit_flag(self, team_id: str, challenge_id: str, flag: str) -> Dict:
        team = self.teams.get(team_id)
        challenge = self.challenges.get(challenge_id)
        if not team or not challenge:
            return {"success": False, "error": "Not found"}
        if challenge_id in team.solved:
            return {"success": False, "error": "Already solved"}
        flag_hash = hashlib.sha256(flag.encode()).hexdigest()
        if flag_hash == challenge.flag_hash:
            team.solved.append(challenge_id)
            team.score += challenge.points
            team.last_solve = time.time()
            challenge.solves += 1
            return {"success": True, "points": challenge.points, "total_score": team.score}
        return {"success": False, "error": "Incorrect flag"}

    def get_leaderboard(self) -> List[Dict]:
        return sorted([{"team": t.name, "score": t.score, "solved": len(t.solved)} for t in self.teams.values()], key=lambda x: -x["score"])

    def get_challenge_stats(self) -> List[Dict]:
        return [{"name": c.name, "category": c.category, "solves": c.solves, "points": c.points} for c in self.challenges.values()]

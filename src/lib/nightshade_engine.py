"""
Nightshade engine from nightshade — CTF challenge framework.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import hashlib
import time


@dataclass
class NightshadeChallenge:
    id: str
    name: str
    category: str
    difficulty: int
    flag: str
    flag_hash: str = ""
    points: int = 100
    description: str = ""
    author: str = ""
    hints: List[str] = field(default_factory=list)
    solves: int = 0
    created_at: float = 0.0

    def __post_init__(self):
        if not self.flag_hash and self.flag:
            self.flag_hash = hashlib.sha256(self.flag.encode()).hexdigest()


@dataclass
class NightshadeTeam:
    id: str
    name: str
    score: int = 0
    solves: List[str] = field(default_factory=list)
    hints_used: int = 0
    last_solve: float = 0.0


class NightshadeEngine:
    def __init__(self):
        self.challenges: Dict[str, NightshadeChallenge] = {}
        self.teams: Dict[str, NightshadeTeam] = {}

    def add_challenge(self, challenge: NightshadeChallenge):
        self.challenges[challenge.id] = challenge

    def add_team(self, team: NightshadeTeam):
        self.teams[team.id] = team

    def submit_flag(self, team_id: str, challenge_id: str, flag: str) -> Dict:
        team = self.teams.get(team_id)
        challenge = self.challenges.get(challenge_id)
        if not team or not challenge:
            return {"success": False, "error": "Not found"}
        if challenge_id in team.solves:
            return {"success": False, "error": "Already solved"}
        if hashlib.sha256(flag.encode()).hexdigest() == challenge.flag_hash:
            team.solves.append(challenge_id)
            team.score += challenge.points
            team.last_solve = time.time()
            challenge.solves += 1
            return {"success": True, "points": challenge.points, "total": team.score}
        return {"success": False, "error": "Wrong flag"}

    def use_hint(self, team_id: str, challenge_id: str, hint_index: int) -> Optional[str]:
        team = self.teams.get(team_id)
        challenge = self.challenges.get(challenge_id)
        if team and challenge and 0 <= hint_index < len(challenge.hints):
            team.hints_used += 1
            return challenge.hints[hint_index]
        return None

    def get_leaderboard(self) -> List[Dict]:
        return sorted([{"team": t.name, "score": t.score, "solved": len(t.solves), "hints": t.hints_used} for t in self.teams.values()], key=lambda x: -x["score"])

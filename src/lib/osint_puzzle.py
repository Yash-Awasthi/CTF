"""
OSINT puzzle from osint-puzzle-game — investigation challenges.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import hashlib


@dataclass
class OSINTChallenge:
    id: str
    name: str
    description: str
    difficulty: int  # 1-5
    category: str  # web, crypto, forensics, network, osint
    flag: str
    flag_hash: str = ""
    hints: List[str] = field(default_factory=list)
    tools_needed: List[str] = field(default_factory=list)
    learning_outcomes: List[str] = field(default_factory=list)
    points: int = 100

    def __post_init__(self):
        if not self.flag_hash and self.flag:
            self.flag_hash = hashlib.sha256(self.flag.encode()).hexdigest()


@dataclass
class OSINTTeam:
    id: str
    name: str
    score: int = 0
    solved: List[str] = field(default_factory=list)
    specialties: List[str] = field(default_factory=list)


class OSINTEngine:
    def __init__(self):
        self.challenges: Dict[str, OSINTChallenge] = {}
        self.teams: Dict[str, OSINTTeam] = {}
        self.leaderboard: List[Dict] = []

    def add_challenge(self, challenge: OSINTChallenge):
        self.challenges[challenge.id] = challenge

    def add_team(self, team: OSINTTeam):
        self.teams[team.id] = team

    def solve(self, team_id: str, challenge_id: str, flag: str) -> Dict:
        team = self.teams.get(team_id)
        challenge = self.challenges.get(challenge_id)
        if not team or not challenge:
            return {"success": False, "error": "Not found"}
        if challenge_id in team.solved:
            return {"success": False, "error": "Already solved"}
        if hashlib.sha256(flag.encode()).hexdigest() == challenge.flag_hash:
            team.solved.append(challenge_id)
            team.score += challenge.points
            return {"success": True, "points": challenge.points, "total": team.score}
        return {"success": False, "error": "Wrong flag"}

    def get_hint(self, challenge_id: str, index: int) -> Optional[str]:
        challenge = self.challenges.get(challenge_id)
        if challenge and 0 <= index < len(challenge.hints):
            return challenge.hints[index]
        return None

    def get_challenges_by_category(self, category: str) -> List[OSINTChallenge]:
        return [c for c in self.challenges.values() if c.category == category]

    def get_leaderboard(self) -> List[Dict]:
        return sorted([{"team": t.name, "score": t.score, "solved": len(t.solved)} for t in self.teams.values()], key=lambda x: -x["score"])

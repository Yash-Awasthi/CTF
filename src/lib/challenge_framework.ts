"""
Challenge framework from kctf — challenge management.
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict


@dataclass
class Challenge:
    id: str
    name: str
    category: str
    difficulty: int  # 1-10
    points: int
    description: str
    flag: str
    hints: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    author: str = ""
    is_solved: bool = False
    solve_count: int = 0


class ChallengeFramework:
    def __init__(self):
        self.challenges: Dict[str, Challenge] = {}
        self.categories: Dict[str, List[str]] = {}

    def add_challenge(self, challenge: Challenge) -> None:
        self.challenges[challenge.id] = challenge
        self.categories.setdefault(challenge.category, []).append(challenge.id)

    def get_challenge(self, challenge_id: str) -> Optional[Challenge]:
        return self.challenges.get(challenge_id)

    def get_by_category(self, category: str) -> List[Challenge]:
        return [self.challenges[cid] for cid in self.categories.get(category, []) if cid in self.challenges]

    def get_unsolved(self) -> List[Challenge]:
        return [c for c in self.challenges.values() if not c.is_solved]

    def solve(self, challenge_id: str, submitted_flag: str) -> bool:
        challenge = self.challenges.get(challenge_id)
        if challenge and submitted_flag.strip() == challenge.flag.strip():
            challenge.is_solved = True
            challenge.solve_count += 1
            return True
        return False

    def get_hint(self, challenge_id: str, hint_index: int) -> Optional[str]:
        challenge = self.challenges.get(challenge_id)
        if challenge and 0 <= hint_index < len(challenge.hints):
            return challenge.hints[hint_index]
        return None

    def get_stats(self) -> Dict:
        total = len(self.challenges)
        solved = sum(1 for c in self.challenges.values() if c.is_solved)
        return {"total": total, "solved": solved, "unsolved": total - solved, "categories": len(self.categories)}

"""
Tournament system from extend-tournament-system — bracket and match management.
"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Team:
    id: str
    name: str
    seed: int = 0
    wins: int = 0
    losses: int = 0


@dataclass
class Match:
    id: str
    round_num: int
    team1: Optional[Team] = None
    team2: Optional[Team] = None
    winner: Optional[Team] = None
    score1: int = 0
    score2: int = 0
    is_complete: bool = False


@dataclass
class Tournament:
    id: str
    name: str
    teams: List[Team] = field(default_factory=list)
    matches: List[Match] = field(default_factory=list)
    current_round: int = 0
    total_rounds: int = 0


def create_bracket(tournament: Tournament) -> Tournament:
    teams = sorted(tournament.teams, key=lambda t: t.seed)
    tournament.total_rounds = max(1, len(teams).bit_length() - 1)
    round1_matches = []
    for i in range(0, len(teams), 2):
        if i + 1 < len(teams):
            match = Match(id=f"m_{len(tournament.matches)}", round_num=1, team1=teams[i], team2=teams[i + 1])
            round1_matches.append(match)
            tournament.matches.append(match)
    return tournament


def record_match_result(tournament: Tournament, match_id: str, score1: int, score2: int) -> Optional[Match]:
    match = next((m for m in tournament.matches if m.id == match_id), None)
    if not match:
        return None
    match.score1 = score1
    match.score2 = score2
    match.winner = match.team1 if score1 > score2 else match.team2
    match.is_complete = True
    if match.winner:
        match.winner.wins += 1
        loser = match.team2 if match.winner == match.team1 else match.team1
        if loser:
            loser.losses += 1
    return match


def get_standings(tournament: Tournament) -> List[dict]:
    return sorted([{"team": t.name, "wins": t.wins, "losses": t.losses, "seed": t.seed} for t in tournament.teams], key=lambda x: (-x["wins"], x["losses"]))

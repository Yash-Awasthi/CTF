import { describe, it, expect } from 'vitest';
import {
  calculateExpectedScore,
  updateElo,
  determineMatchResult,
  isDraw,
  getWinner,
  calculateStatistics,
  calculateRankings,
  pairSwissRound,
  updateSwissElo,
  generateSingleEliminationBracket,
  getTournamentSummary,
  createEmptyStatistics,
} from '../../src/lib/tournament_ranking';
import type { Team, Match, RankingConfig } from '../../src/lib/tournament_ranking';

describe('Tournament Ranking', () => {
  const team1: Team = { teamId: 't1', name: 'Alpha', elo: 1500 };
  const team2: Team = { teamId: 't2', name: 'Beta', elo: 1500 };
  const team3: Team = { teamId: 't3', name: 'Gamma', elo: 1500 };

  const makeMatch = (
    t1: string,
    t2: string,
    s1: number,
    s2: number,
    round = 1,
    draft = false
  ): Match => ({
    matchId: `m${t1}-${t2}-r${round}`,
    team1Id: t1,
    team2Id: t2,
    team1Score: s1,
    team2Score: s2,
    roundNum: round,
    isDraft: draft,
  });

  describe('ELO', () => {
    it('expected score for equal ratings', () => {
      expect(calculateExpectedScore(1500, 1500)).toBeCloseTo(0.5, 2);
    });

    it('expected score favors higher rated', () => {
      expect(calculateExpectedScore(1600, 1400)).toBeGreaterThan(0.5);
    });

    it('update elo on win', () => {
      const newElo = updateElo(1500, 0.5, 1.0);
      expect(newElo).toBeGreaterThan(1500);
    });

    it('update elo on loss', () => {
      const newElo = updateElo(1500, 0.5, 0.0);
      expect(newElo).toBeLessThan(1500);
    });
  });

  describe('Match Results', () => {
    it('team1 wins', () => {
      const match = makeMatch('t1', 't2', 3, 1);
      expect(determineMatchResult(match, 't1')).toBe('win');
      expect(determineMatchResult(match, 't2')).toBe('loss');
    });

    it('team2 wins', () => {
      const match = makeMatch('t1', 't2', 1, 3);
      expect(determineMatchResult(match, 't1')).toBe('loss');
      expect(determineMatchResult(match, 't2')).toBe('win');
    });

    it('draw', () => {
      const match = makeMatch('t1', 't2', 2, 2);
      expect(isDraw(match)).toBe(true);
      expect(getWinner(match)).toBeNull();
    });

    it('winner detection', () => {
      const match = makeMatch('t1', 't2', 5, 3);
      expect(getWinner(match)).toBe('t1');
    });
  });

  describe('Statistics', () => {
    it('empty statistics', () => {
      const stats = createEmptyStatistics();
      expect(stats.wins).toBe(0);
      expect(stats.matchesPlayed).toBe(0);
    });

    it('calculate from matches', () => {
      const matches = [
        makeMatch('t1', 't2', 3, 1),
        makeMatch('t1', 't3', 2, 4),
      ];
      const stats = calculateStatistics(matches, 't1');
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.matchesPlayed).toBe(2);
      expect(stats.points).toBe(3); // 3 for win, 0 for loss
    });

    it('ignores draft matches', () => {
      const matches = [makeMatch('t1', 't2', 3, 1, 1, true)];
      const stats = calculateStatistics(matches, 't1');
      expect(stats.matchesPlayed).toBe(0);
    });
  });

  describe('Rankings', () => {
    it('rankings sorted by points', () => {
      const matches = [
        makeMatch('t1', 't2', 3, 1),
        makeMatch('t2', 't3', 2, 2),
      ];
      const rankings = calculateRankings([team1, team2, team3], matches);
      expect(rankings[0].teamId).toBe('t1');
      expect(rankings[0].stats.points).toBe(3);
    });
  });

  describe('Swiss', () => {
    it('pair teams', () => {
      const matches = [
        makeMatch('t1', 't2', 3, 1),
        makeMatch('t3', 't1', 2, 2),
      ];
      const pairings = pairSwissRound([team1, team2, team3], matches, 2);
      expect(pairings.length).toBe(1); // 3 teams → 1 pairing
    });

    it('update swiss elo', () => {
      const match = makeMatch('t1', 't2', 3, 1);
      const [new1, new2] = updateSwissElo(team1, team2, match);
      expect(new1).toBeGreaterThan(1500);
      expect(new2).toBeLessThan(1500);
    });
  });

  describe('Elimination', () => {
    it('generate bracket', () => {
      const bracket = generateSingleEliminationBracket(['t1', 't2', 't3', 't4']);
      expect(bracket.length).toBe(2); // 2 rounds for 4 teams
    });

    it('handles non-power-of-2', () => {
      const bracket = generateSingleEliminationBracket(['t1', 't2', 't3']);
      expect(bracket.length).toBe(2);
    });
  });

  describe('Summary', () => {
    it('tournament summary', () => {
      const matches = [makeMatch('t1', 't2', 3, 1)];
      const summary = getTournamentSummary([team1, team2], matches);
      expect(summary.totalTeams).toBe(2);
      expect(summary.totalMatches).toBe(1);
      expect(summary.leader).toBe('t1');
    });
  });
});

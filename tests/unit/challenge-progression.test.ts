import { describe, expect, it } from 'vitest';
import {
	getChallengeAccessStatus,
	canAccessChallenge,
	assertChallengeAccess,
	isValidSlot,
	parseSlot,
} from '../../src/lib/challenges/access';
import {
	ChallengeLockedError,
	InvalidSlotError,
} from '../../src/lib/challenges/errors';

const at = (currentChallenge: number) => ({ currentChallenge });

describe('progression classification', () => {
	it('participant starts at challenge 1 = current; 2..30 locked', () => {
		const p = at(1);
		expect(getChallengeAccessStatus(p, 1)).toBe('current');
		expect(getChallengeAccessStatus(p, 2)).toBe('locked');
		expect(getChallengeAccessStatus(p, 30)).toBe('locked');
	});

	it('solved / current / locked around the frontier', () => {
		const p = at(10);
		expect(getChallengeAccessStatus(p, 9)).toBe('solved');
		expect(getChallengeAccessStatus(p, 10)).toBe('current');
		expect(getChallengeAccessStatus(p, 11)).toBe('locked');
	});

	it('slot 30 inaccessible until progression reaches 30', () => {
		expect(getChallengeAccessStatus(at(29), 30)).toBe('locked');
		expect(getChallengeAccessStatus(at(30), 30)).toBe('current');
	});

	it('canAccessChallenge blocks future slots (URL/API guard)', () => {
		expect(canAccessChallenge(at(5), 6)).toBe(false);
		expect(canAccessChallenge(at(5), 5)).toBe(true);
		expect(canAccessChallenge(at(5), 4)).toBe(true);
	});

	it('assertChallengeAccess throws on locked, returns status otherwise', () => {
		expect(() => assertChallengeAccess(at(5), 6)).toThrow(ChallengeLockedError);
		expect(assertChallengeAccess(at(5), 5)).toBe('current');
		expect(assertChallengeAccess(at(5), 3)).toBe('solved');
	});
});

describe('slot validation', () => {
	it('isValidSlot only 1..30 integers', () => {
		expect(isValidSlot(1)).toBe(true);
		expect(isValidSlot(30)).toBe(true);
		expect(isValidSlot(0)).toBe(false);
		expect(isValidSlot(31)).toBe(false);
		expect(isValidSlot(1.5)).toBe(false);
	});

	it('parseSlot parses valid, throws InvalidSlotError otherwise', () => {
		expect(parseSlot('7')).toBe(7);
		expect(() => parseSlot('0')).toThrow(InvalidSlotError);
		expect(() => parseSlot('31')).toThrow(InvalidSlotError);
		expect(() => parseSlot('abc')).toThrow(InvalidSlotError);
		expect(() => parseSlot(undefined)).toThrow(InvalidSlotError);
	});

	it('access status rejects invalid slot', () => {
		expect(() => getChallengeAccessStatus(at(1), 99)).toThrow(InvalidSlotError);
	});
});

/**
 * Phase 13 — Real challenge modules, aggregated in slot order.
 *
 * Each module is a default export from its challenge directory.
 * Import order here is authoritative for slot ordering — the registry
 * validates uniqueness and completeness independently.
 *
 * This file REPLACES PLACEHOLDER_CHALLENGES in registry.ts.
 * Do not add dev-only or placeholder entries here.
 */
import type { ChallengeModule } from './types';

import c01 from '../../../challenges/01/index';
import c02 from '../../../challenges/02/index';
import c03 from '../../../challenges/03/index';
import c04 from '../../../challenges/04/index';
import c05 from '../../../challenges/05/index';
import c06 from '../../../challenges/06/index';
import c07 from '../../../challenges/07/index';
import c08 from '../../../challenges/08/index';
import c09 from '../../../challenges/09/index';
import c10 from '../../../challenges/10/index';
import c11 from '../../../challenges/11/index';
import c12 from '../../../challenges/12/index';
import c13 from '../../../challenges/13/index';
import c14 from '../../../challenges/14/index';
import c15 from '../../../challenges/15/index';
import c16 from '../../../challenges/16/index';
import c17 from '../../../challenges/17/index';
import c18 from '../../../challenges/18/index';
import c19 from '../../../challenges/19/index';
import c20 from '../../../challenges/20/index';
import c21 from '../../../challenges/21/index';
import c22 from '../../../challenges/22/index';
import c23 from '../../../challenges/23/index';
import c24 from '../../../challenges/24/index';
import c25 from '../../../challenges/25/index';
import c26 from '../../../challenges/26/index';
import c27 from '../../../challenges/27/index';
import c28 from '../../../challenges/28/index';
import c29 from '../../../challenges/29/index';
import c30 from '../../../challenges/30-final/index';

export const REAL_CHALLENGES: ChallengeModule[] = [
	c01 as ChallengeModule,
	c02 as ChallengeModule,
	c03 as ChallengeModule,
	c04 as ChallengeModule,
	c05 as ChallengeModule,
	c06 as ChallengeModule,
	c07 as ChallengeModule,
	c08 as ChallengeModule,
	c09 as ChallengeModule,
	c10 as ChallengeModule,
	c11 as ChallengeModule,
	c12 as ChallengeModule,
	c13 as ChallengeModule,
	c14 as ChallengeModule,
	c15 as ChallengeModule,
	c16 as ChallengeModule,
	c17 as ChallengeModule,
	c18 as ChallengeModule,
	c19 as ChallengeModule,
	c20 as ChallengeModule,
	c21 as ChallengeModule,
	c22 as ChallengeModule,
	c23 as ChallengeModule,
	c24 as ChallengeModule,
	c25 as ChallengeModule,
	c26 as ChallengeModule,
	c27 as ChallengeModule,
	c28 as ChallengeModule,
	c29 as ChallengeModule,
	c30 as ChallengeModule,
];

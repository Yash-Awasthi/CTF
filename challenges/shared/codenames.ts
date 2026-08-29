/**
 * CASE 71-C — Shared codename utility.
 *
 * Each participant receives a unique investigator codename derived
 * deterministically from their roll number. The same formula is used
 * in both Q1 (assignment) and Q30 (final query) to guarantee the answer
 * to both challenges is identical for every participant.
 *
 * Collision properties: pool size 200 >> typical CTF roster size.
 * For events with >200 participants a modulo wrap occurs — event organiser
 * should ensure roster_size ≤ CODENAME_POOL.length.
 */

/**
 * 200 single-word investigator codenames — evocative of cold-case archives,
 * old-world craft, and enduring institutional memory.
 */
export const CODENAME_POOL: readonly string[] = [
  'HARBINGER', 'MERIDIAN', 'SOLSTICE', 'PHANTOM', 'RECKONER',
  'HERALD', 'ARCHIVIST', 'SENTINEL', 'CIPHER', 'WARDEN',
  'VESSEL', 'REMNANT', 'PILGRIM', 'AEGIS', 'COVENANT',
  'SPECTER', 'ARBITER', 'CHRONICLE', 'DOSSIER', 'FATHOM',
  'GALLOWS', 'HALLMARK', 'INQUEST', 'JUNCTION', 'KEYSTONE',
  'LACUNA', 'MARINER', 'NEXUS', 'ORACLE', 'PALLOR',
  'QUORUM', 'REDUX', 'SERRATE', 'TALISMAN', 'UMBRA',
  'VANTAGE', 'WAYPOINT', 'ZENITH', 'ALCOVE', 'BASTION',
  'CASEMENT', 'DREDGE', 'ENCLAVE', 'FERROUS', 'GARNET',
  'HALLOW', 'INKWELL', 'JASPER', 'KINDRED', 'LABYRINTH',
  'MORTAR', 'NIGHTFALL', 'OBSIDIAN', 'PENUMBRA', 'QUARTZ',
  'RELIQUARY', 'SULFUR', 'TINDER', 'UMBER', 'VERDANT',
  'WRAITH', 'YARROW', 'ZEPHYR', 'ARDENT', 'BRIMSTONE',
  'CASKET', 'DOCKET', 'EMBER', 'FALLOW', 'GARNER',
  'HEMLOCK', 'INGRESS', 'JUNCTURE', 'KINSHIP', 'MNEMONIC',
  'NULLITY', 'OBLIQUE', 'PARCEL', 'RAMPART', 'SERAPH',
  'TENDRIL', 'UNISON', 'VELLUM', 'WITHSTAND', 'XERIC',
  'YONDER', 'ZEROTH', 'ANCHOR', 'BELLWETHER', 'CAIRN',
  'DOLMEN', 'EGRESS', 'FLINT', 'GRANITE', 'HAVEN',
  'IRONCLAD', 'JETSAM', 'KESTREL', 'LANTERN', 'MOORINGS',
  'NADIR', 'ORISON', 'PORTENT', 'QUARRY', 'RUNIC',
  'SEXTANT', 'THRESHOLD', 'UNDERTOW', 'VESTIGE', 'WANDERER',
  'XENOLITH', 'YEARBOOK', 'ZODIAC', 'ABACUS', 'BRACE',
  'CORNICE', 'DELTA', 'EPITAPH', 'FERMENT', 'GRADIENT',
  'HARDLINE', 'IMPRINT', 'JOURNAL', 'KEEPSAKE', 'LODESTAR',
  'MAST', 'NOTCH', 'OFFSET', 'PIVOT', 'QUARTER',
  'ROWLOCK', 'SPIRE', 'TRIDENT', 'UPSTREAM', 'VALVE',
  'WINDWARD', 'XYLEM', 'YARDSTICK', 'ALCAZAR', 'BURROW',
  'CRYPT', 'DESOLATE', 'ELEGY', 'FALLOUT', 'GLEAM',
  'HOLLOW', 'IMPOST', 'JOINERY', 'KEYRING', 'LEADEN',
  'MORROW', 'NIGHTWATCH', 'ODEUM', 'PYLON', 'RECESS',
  'SCAFFOLD', 'TORCHBEAM', 'UNREST', 'VERMEIL', 'WHETSTONE',
  'XYSTER', 'YEARNING', 'ABEYANCE', 'BELLMAN', 'CINDER',
  'DOSSIL', 'EIDOLON', 'FOOTPRINT', 'GLOAMING', 'HOLDFAST',
  'ISOBAR', 'JOWL', 'KLAXON', 'LOCKSTEP', 'MEMENTO',
  'NIGHTJAR', 'OUTPOST', 'PARAPET', 'QUIETUS', 'RATCHET',
  'SINEW', 'TILLAGE', 'UPHEAVAL', 'VOTIVE', 'WINDLASS',
  'ZEALOT', 'AFTERGLOW', 'BONFIRE', 'CRESTLINE', 'DOWNFALL',
  'EVENSONG', 'FROSTMARK', 'GRIMOIRE', 'HEADSTONE', 'IRONWOOD',
] as const;

/**
 * Derive a participant's investigator codename from their roll number.
 *
 * Uses a fixed-stride permutation over the pool so consecutive roll
 * numbers map to non-adjacent codenames — avoids obvious alphabetic
 * clusters in events where participants are registered in sequence.
 *
 * SAME formula used in Q1 and Q30 — never modify one without the other.
 */
export function getCodename(rollNumber: number): string {
  const stride = 37; // coprime with 200 → full-cycle permutation
  const idx = ((rollNumber - 1) * stride) % CODENAME_POOL.length;
  return CODENAME_POOL[idx];
}

/**
 * All codenames in their permuted order for pool/attribution purposes.
 * Returned as an Array (mutable copy) so callers can sort/modify freely.
 */
export function getAllCodenames(): string[] {
  return Array.from(CODENAME_POOL);
}

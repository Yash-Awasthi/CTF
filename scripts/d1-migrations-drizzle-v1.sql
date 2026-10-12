-- One-time rename for databases migrated before Drizzle Kit 1.0 moved each
-- migration into its own folder. Run once before the next `migrations apply`.
UPDATE d1_migrations SET name = '20260707125409_sturdy_annihilus/migration.sql' WHERE name = '0000_sturdy_annihilus.sql';
UPDATE d1_migrations SET name = '20260707131017_huge_sunspot/migration.sql' WHERE name = '0001_huge_sunspot.sql';
UPDATE d1_migrations SET name = '20260707191321_gifted_proemial_gods/migration.sql' WHERE name = '0002_gifted_proemial_gods.sql';
UPDATE d1_migrations SET name = '20260707195915_smart_centennial/migration.sql' WHERE name = '0003_smart_centennial.sql';
UPDATE d1_migrations SET name = '20260929072031_known_krista_starr/migration.sql' WHERE name = '0004_known_krista_starr.sql';

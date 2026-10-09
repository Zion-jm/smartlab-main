-- Check existing equipment with scripts/check-equipment-validation.cjs before deployment.
-- Archived records retain their names and transaction history.
CREATE UNIQUE INDEX equipment_name_normalized_key ON equipment
  (lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))));

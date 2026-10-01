-- Explicitly apply after schema setup; ordinary startup never runs this file.
-- NOT VALID avoids silently accepting old bad rows: validation below must succeed.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_inventory_consistent' AND conrelid = 'equipment'::regclass) THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_inventory_consistent CHECK (
      "totalQuantity" >= 0 AND "availableQuantity" >= 0 AND "borrowedQuantity" >= 0 AND "damagedQuantity" >= 0
      AND "totalQuantity"::bigint = "availableQuantity"::bigint + "borrowedQuantity"::bigint + "damagedQuantity"::bigint
    ) NOT VALID;
  END IF;
END $$;
ALTER TABLE equipment VALIDATE CONSTRAINT equipment_inventory_consistent;

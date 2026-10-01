-- One-time backfill only when the column is introduced. Re-running is safe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'equipment' AND column_name = 'retiredAt') THEN
    ALTER TABLE "equipment" ADD COLUMN "retiredAt" TIMESTAMP(3);
    -- The old status cannot distinguish manual retirement from zero stock.
    -- Preserve every existing UNAVAILABLE restriction until explicit review/restore.
    UPDATE "equipment" SET "retiredAt" = CURRENT_TIMESTAMP WHERE status = 'UNAVAILABLE';
  END IF;
END $$;

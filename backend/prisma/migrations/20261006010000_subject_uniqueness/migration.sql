-- Expression indexes intentionally maintained in SQL. Preserve display text and linked IDs.
-- Existing normalized duplicates must be resolved explicitly before deployment.
CREATE UNIQUE INDEX "subjects_code_normalized_key" ON "subjects" (lower(btrim(regexp_replace("code", '[[:space:]]+', ' ', 'g'))));
CREATE UNIQUE INDEX "subjects_name_normalized_key" ON "subjects" (lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g'))));

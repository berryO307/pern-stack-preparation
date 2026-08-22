-- NOT VALID: existing rows predate this constraint and were generated in a
-- different format (7-char lowercase base36, not AAA###) - grandfathered in
-- rather than backfilled, since every non-permanent workspace self-heals
-- within an hour via lazy expiry + reseed with the new generator. New
-- inserts and updates are checked from this point on regardless.
ALTER TABLE "classes" ADD CONSTRAINT "classes_invite_code_format" CHECK ("classes"."invite_code" ~ '^[A-Z]{3}[0-9]{3}$') NOT VALID;
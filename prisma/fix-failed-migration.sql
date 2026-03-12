-- Fix: remove failed and renamed migrations from _prisma_migrations table
-- so prisma migrate deploy can re-apply them with the correct names/order
DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN (
  '20260312_erp_compatibility_fields',
  '20260312_intercambio_erp',
  '20260312_super_admin'
);

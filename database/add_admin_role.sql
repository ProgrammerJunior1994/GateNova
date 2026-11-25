-- Ejecuta este archivo y confirma antes de correr migrate_gatenova.sql.
-- PostgreSQL requiere confirmar el nuevo valor del enum antes de usarlo.
ALTER TYPE public.rol_user ADD VALUE IF NOT EXISTS 'admin';

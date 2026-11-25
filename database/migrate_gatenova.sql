-- Ejecutar una sola vez sobre la base de datos gatenova.
-- Alinea la tabla users con el formulario: una persona puede existir
-- antes de que se le asigne una tarjeta RFID.
BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS username character varying(60),
    ADD COLUMN IF NOT EXISTS password character varying(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
    ON public.users (lower(username))
    WHERE username IS NOT NULL;

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS ck_users_admin_credentials;

ALTER TABLE public.users
    ADD CONSTRAINT ck_users_admin_credentials
    CHECK (
        (username IS NULL AND password IS NULL)
        OR (
            username IS NOT NULL
            AND password IS NOT NULL
            AND rol = 'admin'
        )
    );

-- Esta relación era redundante: la tabla cards ya contiene user_id.
-- Además, card_user NOT NULL obligaba a crear una tarjeta al crear al usuario.
ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_card_user_fkey;

ALTER TABLE public.users
    DROP COLUMN IF EXISTS card_user;

COMMIT;

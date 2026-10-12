-- Telegram OpenID Connect sign-in: client credentials, the public origin used for the redirect URI
-- and the linked owner account. All nullable / default false, so existing installs are unaffected.

-- AlterTable
ALTER TABLE "auth_config" ADD COLUMN     "telegram_client_id" TEXT,
ADD COLUMN     "telegram_client_secret_enc" BYTEA,
ADD COLUMN     "telegram_display_name" TEXT,
ADD COLUMN     "telegram_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegram_origin" TEXT,
ADD COLUMN     "telegram_user_id" TEXT;

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encryption key to be stored as a secret (NOTION_ENCRYPTION_KEY)
-- This migration prepares the database for encrypted storage

-- Add a new column for encrypted API key
ALTER TABLE profiles ADD COLUMN notion_api_key_encrypted TEXT;

-- Encrypt existing keys using the secret key (will be provided via secret)
-- Users will need to re-enter their keys to have them encrypted
UPDATE profiles 
SET notion_api_key_encrypted = CASE 
  WHEN notion_api_key IS NOT NULL 
  THEN encode(pgp_sym_encrypt(notion_api_key, current_setting('app.settings.encryption_key', true)), 'base64')
  ELSE NULL
END
WHERE notion_api_key IS NOT NULL;

-- Drop the plaintext column
ALTER TABLE profiles DROP COLUMN notion_api_key;

-- Add comment explaining the encryption
COMMENT ON COLUMN profiles.notion_api_key_encrypted IS 'Notion API key encrypted using pgp_sym_encrypt with app.settings.encryption_key';
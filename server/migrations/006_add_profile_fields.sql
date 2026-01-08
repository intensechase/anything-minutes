-- Migration: Add profile fields for first name and username change tracking
-- Run this in your Supabase SQL Editor

-- Add first_name column (nullable initially for existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(20);

-- Add username_changed_at to track 30-day change limit
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMP WITH TIME ZONE;

-- Add profile_complete flag to track if user has completed onboarding
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false;

-- Add email_verified and phone_verified flags
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Add pending_email for verification flow (email isn't updated until verified)
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_expires TIMESTAMP WITH TIME ZONE;

-- Update existing users: mark profile as incomplete so they get prompted
-- (they need to add first_name)
UPDATE users SET profile_complete = false WHERE first_name IS NULL;

-- For users who signed up with email auth, mark email as verified
-- (Firebase verified it during signup)
UPDATE users SET email_verified = true WHERE email IS NOT NULL;

-- Create index for pending email lookups
CREATE INDEX IF NOT EXISTS idx_users_pending_email_token ON users(pending_email_token);

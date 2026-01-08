-- Migration: Add profile settings and blocking features
-- Run this in your Supabase SQL Editor

-- Add new profile/settings fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS venmo_handle VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS friend_request_setting VARCHAR(20) DEFAULT 'everyone';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'everyone';
ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_from_search BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_iou_visibility VARCHAR(20) DEFAULT 'private';
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_currency VARCHAR(10) DEFAULT '$';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY';
ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '12h';

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- Prevent self-blocking
ALTER TABLE blocked_users ADD CONSTRAINT no_self_block CHECK (blocker_id != blocked_id);

-- Function to check if two users have a mutual friend
CREATE OR REPLACE FUNCTION has_mutual_friend(user1 UUID, user2 UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_mutual BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM friendships f1
    JOIN friendships f2 ON (
      (f1.requester_id = f2.requester_id AND f1.requester_id != user1 AND f1.requester_id != user2) OR
      (f1.requester_id = f2.addressee_id AND f1.requester_id != user1 AND f1.requester_id != user2) OR
      (f1.addressee_id = f2.requester_id AND f1.addressee_id != user1 AND f1.addressee_id != user2) OR
      (f1.addressee_id = f2.addressee_id AND f1.addressee_id != user1 AND f1.addressee_id != user2)
    )
    WHERE f1.status = 'accepted'
      AND f2.status = 'accepted'
      AND (f1.requester_id = user1 OR f1.addressee_id = user1)
      AND (f2.requester_id = user2 OR f2.addressee_id = user2)
  ) INTO has_mutual;

  RETURN has_mutual;
END;
$$ LANGUAGE plpgsql;

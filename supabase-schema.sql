-- Anything Minutes Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    profile_pic_url TEXT,
    street_cred_visibility VARCHAR(20) DEFAULT 'friends_only' CHECK (street_cred_visibility IN ('private', 'friends_only', 'public')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friendships table
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id)
);

-- IOUs table
CREATE TABLE ious (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debtor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creditor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'payment_pending', 'paid', 'cancelled')),
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    due_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better query performance
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_ious_debtor ON ious(debtor_id);
CREATE INDEX idx_ious_creditor ON ious(creditor_id);
CREATE INDEX idx_ious_status ON ious(status);
CREATE INDEX idx_ious_due_date ON ious(due_date);

-- Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ious ENABLE ROW LEVEL SECURITY;

-- Policies for service role (allows full access for backend)
CREATE POLICY "Service role has full access to users" ON users
    FOR ALL USING (true);

CREATE POLICY "Service role has full access to friendships" ON friendships
    FOR ALL USING (true);

CREATE POLICY "Service role has full access to ious" ON ious
    FOR ALL USING (true);

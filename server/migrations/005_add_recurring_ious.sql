-- Create recurring IOUs table
CREATE TABLE IF NOT EXISTS recurring_ious (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id UUID NOT NULL REFERENCES users(id),
  creditor_id UUID NOT NULL REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2),
  visibility VARCHAR(20) DEFAULT 'private',
  notes TEXT,

  -- Recurrence settings
  frequency VARCHAR(20) NOT NULL,  -- 'weekly' or 'monthly'
  day_of_week INTEGER,  -- 0=Sunday, 1=Monday, etc. (for weekly)
  day_of_month INTEGER,  -- 1-31 (for monthly)

  -- Tracking
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  next_due_at TIMESTAMP WITH TIME ZONE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_ious_debtor_id ON recurring_ious(debtor_id);
CREATE INDEX IF NOT EXISTS idx_recurring_ious_creditor_id ON recurring_ious(creditor_id);
CREATE INDEX IF NOT EXISTS idx_recurring_ious_next_due ON recurring_ious(next_due_at) WHERE is_active = true;

-- Enable RLS
ALTER TABLE recurring_ious ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view recurring IOUs they're involved in
CREATE POLICY "Users can view their recurring IOUs" ON recurring_ious
  FOR SELECT USING (
    debtor_id = auth.uid() OR creditor_id = auth.uid()
  );

-- Policy: Users can create recurring IOUs
CREATE POLICY "Users can create recurring IOUs" ON recurring_ious
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

-- Policy: Users can update recurring IOUs they created
CREATE POLICY "Users can update their recurring IOUs" ON recurring_ious
  FOR UPDATE USING (
    created_by = auth.uid()
  );

-- Policy: Users can delete recurring IOUs they created
CREATE POLICY "Users can delete their recurring IOUs" ON recurring_ious
  FOR DELETE USING (
    created_by = auth.uid()
  );

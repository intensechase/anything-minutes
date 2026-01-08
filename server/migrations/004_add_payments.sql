-- Add amount column to ious table
ALTER TABLE ious ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);

-- Create payments table for tracking partial payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iou_id UUID NOT NULL REFERENCES ious(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2),  -- Optional numeric amount
  description TEXT NOT NULL,  -- Flexible description like "$25" or "half the pizza"
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_iou_id ON payments(iou_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payments for IOUs they're involved in
CREATE POLICY "Users can view payments for their IOUs" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ious
      WHERE ious.id = payments.iou_id
      AND (ious.debtor_id = auth.uid() OR ious.creditor_id = auth.uid())
    )
  );

-- Policy: Users can insert payments for IOUs they're involved in
CREATE POLICY "Users can add payments to their IOUs" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ious
      WHERE ious.id = iou_id
      AND (ious.debtor_id = auth.uid() OR ious.creditor_id = auth.uid())
    )
  );

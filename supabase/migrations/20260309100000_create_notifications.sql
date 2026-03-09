-- Migration: In-app notification system
-- Stores notifications for suppliers (contract updates, BD messages, etc.)

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('contract', 'onboarding', 'message', 'general')),
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries: unread first, newest first
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- RLS: users can only see their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert notifications (from API routes)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

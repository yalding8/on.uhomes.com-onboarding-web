-- Applications: track which BD is assigned to review/manage each application
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS assigned_bd_id uuid;

-- Suppliers: BD-specific referral code for tracking partner referrals
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

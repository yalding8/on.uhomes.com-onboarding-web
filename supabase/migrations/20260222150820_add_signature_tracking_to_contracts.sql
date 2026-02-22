-- Migration to support external e-signature platforms (e.g. OpenSign/DocuSign) integration features

-- Step 1: Add a unique reference ID column to the contracts table to map provider signature requests
ALTER TABLE public.contracts
ADD COLUMN signature_request_id text UNIQUE;

-- Step 2: Add signing URL specifically for storing the dynamic embedded iframe session token
ALTER TABLE public.contracts
ADD COLUMN embedded_signing_url text;

-- Step 3: Add provider specifier in case of fallback from OpenSign to DocuSign / Dropbox Sign
ALTER TABLE public.contracts
ADD COLUMN signature_provider text DEFAULT 'OPENSIGN';

-- Optional: Add metadata jsonb to store raw webhook callback events for audit tracing
ALTER TABLE public.contracts
ADD COLUMN provider_metadata jsonb DEFAULT '{}'::jsonb;

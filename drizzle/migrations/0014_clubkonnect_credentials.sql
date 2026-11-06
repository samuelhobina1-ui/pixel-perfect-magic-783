CREATE TABLE public.clubkonnect_credentials (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id text NOT NULL,
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.clubkonnect_credentials TO service_role;
ALTER TABLE public.clubkonnect_credentials ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: credentials are readable only by service-role server code.
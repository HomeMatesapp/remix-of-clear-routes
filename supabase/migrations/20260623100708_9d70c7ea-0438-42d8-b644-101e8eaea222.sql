CREATE TABLE public.institution_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  work_email text NOT NULL,
  institution text NOT NULL,
  job_title text NOT NULL,
  learner_count text,
  message text NOT NULL,
  enquiry_type text NOT NULL DEFAULT 'demo',
  contact_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.institution_enquiries TO anon;
GRANT INSERT ON public.institution_enquiries TO authenticated;
GRANT ALL ON public.institution_enquiries TO service_role;

ALTER TABLE public.institution_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an institution enquiry"
  ON public.institution_enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (contact_consent = true);
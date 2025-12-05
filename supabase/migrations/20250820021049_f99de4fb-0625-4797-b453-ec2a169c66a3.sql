-- Update profiles table to match Prox requirements
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS household_size integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS grocer_1 text,
ADD COLUMN IF NOT EXISTS grocer_2 text,
ADD COLUMN IF NOT EXISTS push_token text;

-- Add constraints to profiles
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_household_size_check CHECK (household_size >= 1 AND household_size <= 12);

-- Update items table to match Prox requirements  
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS store_name text,
ADD COLUMN IF NOT EXISTS estimate_source text;

-- Add constraint for estimate_source
ALTER TABLE public.items 
ADD CONSTRAINT items_estimate_source_check CHECK (estimate_source IN ('heuristic', 'llm'));

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_estimated_expiration_at ON public.items(estimated_expiration_at);
CREATE INDEX IF NOT EXISTS idx_items_estimated_restock_at ON public.items(estimated_restock_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
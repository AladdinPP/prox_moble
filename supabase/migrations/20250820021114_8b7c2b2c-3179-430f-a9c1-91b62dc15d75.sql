-- Update profiles table to match Prox requirements (only add columns if they don't exist)
DO $$ 
BEGIN
    -- Add zip_code column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'zip_code') THEN
        ALTER TABLE public.profiles ADD COLUMN zip_code text;
    END IF;
    
    -- Add household_size column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'household_size') THEN
        ALTER TABLE public.profiles ADD COLUMN household_size integer DEFAULT 1;
    END IF;
    
    -- Add grocer_1 column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'grocer_1') THEN
        ALTER TABLE public.profiles ADD COLUMN grocer_1 text;
    END IF;
    
    -- Add grocer_2 column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'grocer_2') THEN
        ALTER TABLE public.profiles ADD COLUMN grocer_2 text;
    END IF;
    
    -- Add push_token column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'push_token') THEN
        ALTER TABLE public.profiles ADD COLUMN push_token text;
    END IF;
END $$;

-- Update items table to match Prox requirements (only add columns if they don't exist)
DO $$
BEGIN
    -- Add store_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'store_name') THEN
        ALTER TABLE public.items ADD COLUMN store_name text;
    END IF;
    
    -- Add estimate_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'estimate_source') THEN
        ALTER TABLE public.items ADD COLUMN estimate_source text;
    END IF;
END $$;

-- Add constraints only if they don't exist
DO $$
BEGIN
    -- Add household_size constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'profiles_household_size_check') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_household_size_check CHECK (household_size >= 1 AND household_size <= 12);
    END IF;
    
    -- Add estimate_source constraint if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'items_estimate_source_check') THEN
        ALTER TABLE public.items ADD CONSTRAINT items_estimate_source_check CHECK (estimate_source IN ('heuristic', 'llm'));
    END IF;
END $$;

-- Create indices for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_estimated_expiration_at ON public.items(estimated_expiration_at);
CREATE INDEX IF NOT EXISTS idx_items_estimated_restock_at ON public.items(estimated_restock_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
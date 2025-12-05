-- Create households table
CREATE TABLE IF NOT EXISTS public.households (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    head_of UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    join_key UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_households_head_of ON public.households(head_of);
CREATE INDEX IF NOT EXISTS idx_households_join_key ON public.households(join_key);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_households_updated_at
    BEFORE UPDATE ON public.households
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

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

-- Enable RLS on households table
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view households they belong to
CREATE POLICY "Users can view their household" ON households
  FOR SELECT USING (
    auth.uid() = head_of OR 
    auth.uid()::text IN (
      SELECT raw_user_meta_data->>'household' 
      FROM auth.users 
      WHERE raw_user_meta_data->>'household' = households.id::text
    )
  );

-- Create policy for users to insert households (only as head_of)
CREATE POLICY "Users can create households" ON households
  FOR INSERT WITH CHECK (auth.uid() = head_of);

-- Create policy for users to update households they own
CREATE POLICY "Users can update their household" ON households
  FOR UPDATE USING (auth.uid() = head_of) WITH CHECK (auth.uid() = head_of);

-- Create policy for users to delete households they own
CREATE POLICY "Users can delete their household" ON households
  FOR DELETE USING (auth.uid() = head_of);

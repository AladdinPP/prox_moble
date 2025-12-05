-- Enable RLS on items table if not already enabled
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own items" ON public.items;
DROP POLICY IF EXISTS "Household members can view household items" ON public.items;
DROP POLICY IF EXISTS "Users can insert their own items" ON public.items;
DROP POLICY IF EXISTS "Users can update their own items" ON public.items;
DROP POLICY IF EXISTS "Users can delete their own items" ON public.items;

-- Create policy for users to view their own items
CREATE POLICY "Users can view their own items" ON public.items
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy for household members to view each other's items
CREATE POLICY "Household members can view household items" ON public.items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM auth.users u1, auth.users u2
      WHERE u1.id = auth.uid()
        AND u2.id = items.user_id
        AND u1.raw_user_meta_data->>'household' = u2.raw_user_meta_data->>'household'
        AND u1.raw_user_meta_data->>'household' IS NOT NULL
    )
  );

-- Create policy for users to insert their own items
CREATE POLICY "Users can insert their own items" ON public.items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own items
CREATE POLICY "Users can update their own items" ON public.items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create policy for users to delete their own items
CREATE POLICY "Users can delete their own items" ON public.items
  FOR DELETE USING (auth.uid() = user_id);

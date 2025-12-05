-- Enable RLS on other_categories table (if not already enabled)
ALTER TABLE other_categories ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own categories
CREATE POLICY "Users can view their own categories" ON other_categories
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy for users to insert their own categories
CREATE POLICY "Users can insert their own categories" ON other_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own categories
CREATE POLICY "Users can update their own categories" ON other_categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create policy for users to delete their own categories
CREATE POLICY "Users can delete their own categories" ON other_categories
  FOR DELETE USING (auth.uid() = user_id);

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
-- Create function to get household members
CREATE OR REPLACE FUNCTION get_household_members(household_id_param BIGINT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    (u.raw_user_meta_data->>'first_name')::TEXT as first_name,
    (u.raw_user_meta_data->>'last_name')::TEXT as last_name
  FROM auth.users u
  WHERE (u.raw_user_meta_data->>'household')::BIGINT = household_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_household_members(BIGINT) TO authenticated;

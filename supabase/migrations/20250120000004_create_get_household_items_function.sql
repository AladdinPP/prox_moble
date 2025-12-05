-- Create function to get household items (bypasses RLS)
CREATE OR REPLACE FUNCTION get_household_items(household_id_param BIGINT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  purchased_at TIMESTAMP WITH TIME ZONE,
  estimated_expiration_at TIMESTAMP WITH TIME ZONE,
  estimated_restock_at TIMESTAMP WITH TIME ZONE,
  store_name TEXT,
  quantity INTEGER,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  guest_owner_id TEXT,
  estimate_source TEXT,
  owner_first_name TEXT,
  owner_last_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    i.category,
    i.purchased_at,
    i.estimated_expiration_at,
    i.estimated_restock_at,
    i.store_name,
    i.quantity,
    i.unit,
    i.created_at,
    i.updated_at,
    i.user_id,
    i.guest_owner_id,
    i.estimate_source,
    (u.raw_user_meta_data->>'first_name')::TEXT as owner_first_name,
    (u.raw_user_meta_data->>'last_name')::TEXT as owner_last_name
  FROM public.items i
  JOIN auth.users u ON u.id = i.user_id
  WHERE (u.raw_user_meta_data->>'household')::BIGINT = household_id_param
  ORDER BY i.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_household_items(BIGINT) TO authenticated;

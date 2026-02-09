export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string | null
          id: number
          name: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          brand: string | null
          category: string
          created_at: string | null
          estimate_source: string | null
          estimated_expiration_at: string | null
          estimated_restock_at: string | null
          guest_owner_id: string | null
          id: string
          name: string
          purchased_at: string
          quantity: number | null
          store_name: string | null
          unit: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string | null
          estimate_source?: string | null
          estimated_expiration_at?: string | null
          estimated_restock_at?: string | null
          guest_owner_id?: string | null
          id?: string
          name: string
          purchased_at: string
          quantity?: number | null
          store_name?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string | null
          estimate_source?: string | null
          estimated_expiration_at?: string | null
          estimated_restock_at?: string | null
          guest_owner_id?: string | null
          id?: string
          name?: string
          purchased_at?: string
          quantity?: number | null
          store_name?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      other_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_preference: string | null
          birthday: string | null
          created_at: string | null
          date_of_birth: string | null
          display_name: string | null
          email: string
          first_name: string | null
          gender_identity: string | null
          grocer_1: string | null
          grocer_2: string | null
          household_size: number | null
          id: string
          last_name: string | null
          phone_number: string | null
          preferred_retailers: string[] | null
          push_token: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          app_preference?: string | null
          birthday?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          gender_identity?: string | null
          grocer_1?: string | null
          grocer_2?: string | null
          household_size?: number | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          preferred_retailers?: string[] | null
          push_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          app_preference?: string | null
          birthday?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          gender_identity?: string | null
          grocer_1?: string | null
          grocer_2?: string | null
          household_size?: number | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          preferred_retailers?: string[] | null
          push_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      households: {
        Row: {
          id: number
          name: string
          head_of: string
          join_key: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          name: string
          head_of: string
          join_key?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          name?: string
          head_of?: string
          join_key?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_head_of_fkey"
            columns: ["head_of"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      // ---------- NEW: waitlist ----------
      waitlist: {
        Row: {
          brand_preference: string | null
          created_at: string | null
          date_of_birth: string | null
          device_preference: string | null
          estimated_address: string | null
          email: string
          feedback: string | null
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json | null
          name: string
          phone_number: string | null
          preferred_retailers: string[] | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          brand_preference?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          device_preference?: string | null
          estimated_address?: string | null
          email?: string
          feedback?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          name?: string
          phone_number?: string | null
          preferred_retailers?: string[] | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          brand_preference?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          device_preference?: string | null
          estimated_address?: string | null
          email?: string
          feedback?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          name?: string
          phone_number?: string | null
          preferred_retailers?: string[] | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      pantry_item_images: {
        Row: {
          created_at: string | null
          image_link: string | null
          pantry_item_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          image_link?: string | null
          pantry_item_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          image_link?: string | null
          pantry_item_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pantry_tracker: {
        Row: {
          brand: string | null
          category: string
          created_at: string | null
          estimate_source: string | null
          estimated_expiration_at: string | null
          estimated_restock_at: string | null
          guest_owner_id: string | null
          id: string
          name: string
          purchased_at: string
          quantity: number | null
          store_name: string | null
          unit: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string | null
          estimate_source?: string | null
          estimated_expiration_at?: string | null
          estimated_restock_at?: string | null
          guest_owner_id?: string | null
          id?: string
          name: string
          purchased_at: string
          quantity?: number | null
          store_name?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string | null
          estimate_source?: string | null
          estimated_expiration_at?: string | null
          estimated_restock_at?: string | null
          guest_owner_id?: string | null
          id?: string
          name?: string
          purchased_at?: string
          quantity?: number | null
          store_name?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      saved_carts: {
        Row: {
          cart_items: Json
          created_at: string | null
          id: string
          store_count: number
          stores: string[]
          total_price: number
          user_id: string | null
        }
        Insert: {
          cart_items: Json
          created_at?: string | null
          id?: string
          store_count: number
          stores: string[]
          total_price: number
          user_id?: string | null
        }
        Update: {
          cart_items?: Json
          created_at?: string | null
          id?: string
          store_count?: number
          stores?: string[]
          total_price?: number
          user_id?: string | null
        }
        Relationships: []
      }
      shopping_cart_items: {
        Row: {
          brand: string | null
          created_at: string | null
          details: string | null
          id: string
          image_url: string | null
          product_name: string
          product_price: number | null
          product_size: string | null
          retailer: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          image_url?: string | null
          product_name: string
          product_price?: number | null
          product_size?: string | null
          retailer?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          image_url?: string | null
          product_name?: string
          product_price?: number | null
          product_size?: string | null
          retailer?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string | null
          feedback: string
          id: string
          metadata: Json | null
          page: string | null
          source: string | null
          star_rating: number | null
          waitlist_id: string
        }
        Insert: {
          created_at?: string | null
          feedback: string
          id?: string
          metadata?: Json | null
          page?: string | null
          source?: string | null
          star_rating?: number | null
          waitlist_id: string
        }
        Update: {
          created_at?: string | null
          feedback?: string
          id?: string
          metadata?: Json | null
          page?: string | null
          source?: string | null
          star_rating?: number | null
          waitlist_id?: string
        }
        Relationships: []
      }
      flyer_deals: {
        Row: {
          created_at: string | null
          distance_m: number | null
          id: number
          image_link: string | null
          product_name: string | null
          product_price: number | null
          product_size: string | null
          retailer: string | null
          retailer_logo_url: string | null
          zip_code: string | null
        }
        Insert: {
          created_at?: string | null
          distance_m?: number | null
          id?: number
          image_link?: string | null
          product_name?: string | null
          product_price?: number | null
          product_size?: string | null
          retailer?: string | null
          retailer_logo_url?: string | null
          zip_code?: string | null
        }
        Update: {
          created_at?: string | null
          distance_m?: number | null
          id?: number
          image_link?: string | null
          product_name?: string | null
          product_price?: number | null
          product_size?: string | null
          retailer?: string | null
          retailer_logo_url?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      // ---------- END waitlist ----------
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_waitlist_email: {
        Args: {
          lookup_email: string
        }
        Returns: {
          existing_data: Json | null
          message: string
          status: string
        }
      }
      get_deal_menu_v8: {
        Args: {
          items_to_find: Json
          min_date: string
          radius_meters: number
          user_zip: string
        }
        Returns: {
          distance_m: number | null
          image_link: string | null
          product_name: string | null
          product_price: number | null
          product_size: string | null
          retailer: string | null
          retailer_logo_url: string | null
          searched_item_name: string | null
          zip_code: string | null
        }[]
      }
      get_household_items: {
        Args: {
          household_id_param: number
        }
        Returns: {
          category: string
          created_at: string
          estimate_source: string | null
          estimated_expiration_at: string | null
          estimated_restock_at: string | null
          guest_owner_id: string | null
          id: string
          name: string
          owner_first_name: string | null
          owner_last_name: string | null
          purchased_at: string
          quantity: number | null
          store_name: string | null
          unit: string | null
          updated_at: string | null
          user_id: string | null
        }[]
      }
      get_household_members: {
        Args: {
          household_id_param: number
        }
        Returns: {
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
        }[]
      }
      search_deals_fuzzy: {
        Args: {
          max_distance_meters: number
          max_rows: number
          min_date: string
          radius_meters: number
          search_terms: string[]
          user_zip: string
        }
        Returns: {
          distance_m: number | null
          id: number
          image_link: string | null
          product_name: string | null
          product_price: number | null
          product_size: string | null
          retailer: string | null
          retailer_logo_url: string | null
          searched_item_name: string | null
          zip_code: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

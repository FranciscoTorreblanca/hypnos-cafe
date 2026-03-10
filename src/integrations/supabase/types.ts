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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      combo_choice_groups: {
        Row: {
          combo_id: string
          display_order: number
          id: string
          label: string
          label_en: string
        }
        Insert: {
          combo_id: string
          display_order?: number
          id?: string
          label: string
          label_en?: string
        }
        Update: {
          combo_id?: string
          display_order?: number
          id?: string
          label?: string
          label_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_choice_groups_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_choice_options: {
        Row: {
          choice_group_id: string
          id: string
          menu_item_id: string
        }
        Insert: {
          choice_group_id: string
          id?: string
          menu_item_id: string
        }
        Update: {
          choice_group_id?: string
          id?: string
          menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_choice_options_choice_group_id_fkey"
            columns: ["choice_group_id"]
            isOneToOne: false
            referencedRelation: "combo_choice_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_choice_options_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_items: {
        Row: {
          combo_id: string
          id: string
          menu_item_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          id?: string
          menu_item_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          id?: string
          menu_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          created_at: string
          description: string
          description_en: string
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          name_en: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          name_en?: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          name_en?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string
          presentation_cost: number
          presentation_qty: number
          provider_link: string
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string
          presentation_cost?: number
          presentation_qty?: number
          provider_link?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string
          presentation_cost?: number
          presentation_qty?: number
          provider_link?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          name_en?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_item_ingredients: {
        Row: {
          id: string
          ingredient_id: string | null
          menu_item_id: string
          quantity: number
          source_menu_item_id: string | null
        }
        Insert: {
          id?: string
          ingredient_id?: string | null
          menu_item_id: string
          quantity?: number
          source_menu_item_id?: string | null
        }
        Update: {
          id?: string
          ingredient_id?: string | null
          menu_item_id?: string
          quantity?: number
          source_menu_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_source_menu_item_id_fkey"
            columns: ["source_menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          description: string
          description_en: string
          id: string
          image_url: string | null
          inventory_count: number | null
          is_available: boolean
          name: string
          name_en: string
          price: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_available?: boolean
          name: string
          name_en?: string
          price?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_available?: boolean
          name?: string
          name_en?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          menu_item_id: string
          notes: string
          order_id: string
          quantity: number
          status: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          menu_item_id: string
          notes?: string
          order_id: string
          quantity?: number
          status?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          menu_item_id?: string
          notes?: string
          order_id?: string
          quantity?: number
          status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string
          status: Database["public"]["Enums"]["order_status"]
          table_number: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_number: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          order_id: string
          payment_method: string
          tip: number
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          id?: string
          order_id: string
          payment_method?: string
          tip?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          order_id?: string
          payment_method?: string
          tip?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "waiter" | "billing" | "kitchen"
      order_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "ready"
        | "served"
        | "paid"
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
    Enums: {
      app_role: ["admin", "waiter", "billing", "kitchen"],
      order_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        "ready",
        "served",
        "paid",
      ],
    },
  },
} as const

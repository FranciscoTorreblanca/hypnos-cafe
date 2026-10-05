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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_devices: {
        Row: {
          allow_pin_fallback: boolean
          business_id: string
          created_at: string
          device_token_hash: string
          fingerprint_bridge_version: string | null
          id: string
          is_time_clock: boolean
          label: string
          last_seen_at: string | null
          updated_at: string
        }
        Insert: {
          allow_pin_fallback?: boolean
          business_id: string
          created_at?: string
          device_token_hash: string
          fingerprint_bridge_version?: string | null
          id?: string
          is_time_clock?: boolean
          label: string
          last_seen_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_pin_fallback?: boolean
          business_id?: string
          created_at?: string
          device_token_hash?: string
          fingerprint_bridge_version?: string | null
          id?: string
          is_time_clock?: boolean
          label?: string
          last_seen_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_devices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          business_id: string
          check_in_at: string
          check_in_method: string
          check_out_at: string | null
          check_out_method: string | null
          created_at: string
          device_id: string | null
          fingerprint_hash: string | null
          id: string
          late: boolean
          notes: string | null
          scheduled_check_in: string | null
          scheduled_check_out: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          check_in_at?: string
          check_in_method?: string
          check_out_at?: string | null
          check_out_method?: string | null
          created_at?: string
          device_id?: string | null
          fingerprint_hash?: string | null
          id?: string
          late?: boolean
          notes?: string | null
          scheduled_check_in?: string | null
          scheduled_check_out?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          check_in_at?: string
          check_in_method?: string
          check_out_at?: string | null
          check_out_method?: string | null
          created_at?: string
          device_id?: string | null
          fingerprint_hash?: string | null
          id?: string
          late?: boolean
          notes?: string | null
          scheduled_check_in?: string | null
          scheduled_check_out?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "attendance_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_adjustments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string
          id: string
          kind: string
          note: string
          source: string
          till_transaction_id: string | null
        }
        Insert: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          note?: string
          source?: string
          till_transaction_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          note?: string
          source?: string
          till_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_adjustments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_adjustments_till_transaction_id_fkey"
            columns: ["till_transaction_id"]
            isOneToOne: false
            referencedRelation: "till_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          business_id: string
          color: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          key: string
          kind: string
          label: string
          label_en: string
        }
        Insert: {
          business_id?: string
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          key: string
          kind?: string
          label: string
          label_en?: string
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          label?: string
          label_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_features: {
        Row: {
          analytics: boolean
          budget: boolean
          business_id: string
          calendar: boolean
          cash_closing: boolean
          cost_calculator: boolean
          delivery: boolean
          kitchen: boolean
          loyalty: boolean
          menu_generator: boolean
          mercado_pago: boolean
          push_notifications: boolean
          stock: boolean
          tickets: boolean
          time_attendance: boolean
          updated_at: string
          wifi: boolean
        }
        Insert: {
          analytics?: boolean
          budget?: boolean
          business_id: string
          calendar?: boolean
          cash_closing?: boolean
          cost_calculator?: boolean
          delivery?: boolean
          kitchen?: boolean
          loyalty?: boolean
          menu_generator?: boolean
          mercado_pago?: boolean
          push_notifications?: boolean
          stock?: boolean
          tickets?: boolean
          time_attendance?: boolean
          updated_at?: string
          wifi?: boolean
        }
        Update: {
          analytics?: boolean
          budget?: boolean
          business_id?: string
          calendar?: boolean
          cash_closing?: boolean
          cost_calculator?: boolean
          delivery?: boolean
          kitchen?: boolean
          loyalty?: boolean
          menu_generator?: boolean
          mercado_pago?: boolean
          push_notifications?: boolean
          stock?: boolean
          tickets?: boolean
          time_attendance?: boolean
          updated_at?: string
          wifi?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "business_features_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_default: boolean
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          card_commission_rate: number
          created_at: string
          currency: string
          email: string | null
          id: string
          language: string
          legal_name: string | null
          logo_url: string | null
          mp_access_token: string | null
          mp_device_id: string | null
          name: string
          phone: string | null
          slug: string
          status: string
          tax_id: string | null
          ticket_footer: string | null
          ticket_header: string | null
          timezone: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          address?: string | null
          card_commission_rate?: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          language?: string
          legal_name?: string | null
          logo_url?: string | null
          mp_access_token?: string | null
          mp_device_id?: string | null
          name: string
          phone?: string | null
          slug: string
          status?: string
          tax_id?: string | null
          ticket_footer?: string | null
          ticket_header?: string | null
          timezone?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          address?: string | null
          card_commission_rate?: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          language?: string
          legal_name?: string | null
          logo_url?: string | null
          mp_access_token?: string | null
          mp_device_id?: string | null
          name?: string
          phone?: string | null
          slug?: string
          status?: string
          tax_id?: string | null
          ticket_footer?: string | null
          ticket_header?: string | null
          timezone?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      combo_choice_groups: {
        Row: {
          business_id: string
          combo_id: string
          display_order: number
          id: string
          label: string
          label_en: string
        }
        Insert: {
          business_id?: string
          combo_id: string
          display_order?: number
          id?: string
          label: string
          label_en?: string
        }
        Update: {
          business_id?: string
          combo_id?: string
          display_order?: number
          id?: string
          label?: string
          label_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_choice_groups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
          business_id: string
          choice_group_id: string
          id: string
          menu_item_id: string
        }
        Insert: {
          business_id?: string
          choice_group_id: string
          id?: string
          menu_item_id: string
        }
        Update: {
          business_id?: string
          choice_group_id?: string
          id?: string
          menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_choice_options_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
          business_id: string
          combo_id: string
          id: string
          menu_item_id: string
          quantity: number
        }
        Insert: {
          business_id?: string
          combo_id: string
          id?: string
          menu_item_id: string
          quantity?: number
        }
        Update: {
          business_id?: string
          combo_id?: string
          id?: string
          menu_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
          business_id: string
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
          business_id?: string
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
          business_id?: string
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
        Relationships: [
          {
            foreignKeyName: "combos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_platforms: {
        Row: {
          business_id: string
          commission_pct: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          payout_offset_days: number
          payout_weekday: number
          slug: string
          updated_at: string
        }
        Insert: {
          business_id: string
          commission_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          payout_offset_days?: number
          payout_weekday?: number
          slug: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          commission_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          payout_offset_days?: number
          payout_weekday?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_platforms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      event_cost_categories: {
        Row: {
          business_id: string
          created_at: string
          display_order: number
          id: string
          key: string
          label: string
          label_en: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          display_order?: number
          id?: string
          key: string
          label: string
          label_en?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          display_order?: number
          id?: string
          key?: string
          label?: string
          label_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_cost_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      event_cost_items: {
        Row: {
          amount: number
          business_id: string
          category_key: string | null
          created_at: string
          display_order: number
          event_id: string
          id: string
          name: string
          notes: string
        }
        Insert: {
          amount?: number
          business_id?: string
          category_key?: string | null
          created_at?: string
          display_order?: number
          event_id: string
          id?: string
          name: string
          notes?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category_key?: string | null
          created_at?: string
          display_order?: number
          event_id?: string
          id?: string
          name?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_cost_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_cost_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          business_id: string
          capacity: number | null
          color: string
          cover_charge: number
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string
          ends_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          instagram_url: string
          is_public: boolean
          location: string
          name: string
          notes: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          business_id?: string
          capacity?: number | null
          color?: string
          cover_charge?: number
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          ends_at: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          instagram_url?: string
          is_public?: boolean
          location?: string
          name: string
          notes?: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          business_id?: string
          capacity?: number | null
          color?: string
          cover_charge?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          instagram_url?: string
          is_public?: boolean
          location?: string
          name?: string
          notes?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          amount: number
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string
          id: string
          note: string
          paid_at: string
          payment_source: string
          recurring_id: string | null
          till_transaction_id: string | null
        }
        Insert: {
          amount?: number
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          note?: string
          paid_at?: string
          payment_source?: string
          recurring_id?: string | null
          till_transaction_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          paid_at?: string
          payment_source?: string
          recurring_id?: string | null
          till_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_till_transaction_id_fkey"
            columns: ["till_transaction_id"]
            isOneToOne: false
            referencedRelation: "till_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_stock_movements: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          delta: number
          id: string
          ingredient_id: string
          kind: string
          note: string
          order_item_id: string | null
          packs: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          ingredient_id: string
          kind: string
          note?: string
          order_item_id?: string | null
          packs?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          ingredient_id?: string
          kind?: string
          note?: string
          order_item_id?: string | null
          packs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          business_id: string
          created_at: string
          id: string
          low_stock_threshold: number | null
          name: string
          notes: string
          presentation_cost: number
          presentation_qty: number
          provider_link: string
          stock_qty: number | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          name: string
          notes?: string
          presentation_cost?: number
          presentation_qty?: number
          provider_link?: string
          stock_qty?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          name?: string
          notes?: string
          presentation_cost?: number
          presentation_qty?: number
          provider_link?: string
          stock_qty?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_coupon_items: {
        Row: {
          business_id: string
          coupon_id: string
          id: string
          menu_item_id: string
        }
        Insert: {
          business_id?: string
          coupon_id: string
          id?: string
          menu_item_id: string
        }
        Update: {
          business_id?: string
          coupon_id?: string
          id?: string
          menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_coupon_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_coupon_items_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "loyalty_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_coupon_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_coupons: {
        Row: {
          business_id: string
          created_at: string
          description: string
          description_en: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          min_visits: number
          title: string
          title_en: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          description?: string
          description_en?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_visits?: number
          title: string
          title_en?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string
          description_en?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_visits?: number
          title?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_coupons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_member_coupons: {
        Row: {
          business_id: string
          coupon_id: string
          granted_at: string
          id: string
          is_redeemed: boolean
          member_id: string
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          business_id?: string
          coupon_id: string
          granted_at?: string
          id?: string
          is_redeemed?: boolean
          member_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          business_id?: string
          coupon_id?: string
          granted_at?: string
          id?: string
          is_redeemed?: boolean
          member_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_member_coupons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_member_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "loyalty_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_member_coupons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "loyalty_members"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_members: {
        Row: {
          business_id: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          member_code: string
          name: string
          phone: string
          total_visits: number
          user_id: string | null
        }
        Insert: {
          business_id?: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          member_code: string
          name: string
          phone?: string
          total_visits?: number
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          member_code?: string
          name?: string
          phone?: string
          total_visits?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_visits: {
        Row: {
          business_id: string
          created_at: string
          id: string
          member_id: string
          notes: string
          registered_by: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          id?: string
          member_id: string
          notes?: string
          registered_by: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          member_id?: string
          notes?: string
          registered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_visits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "loyalty_members"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          business_id: string
          created_at: string
          display_order: number
          id: string
          name: string
          name_en: string
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          name_en?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_entries: {
        Row: {
          business_id: string
          combo_id: string | null
          created_at: string
          display_order: number
          id: string
          menu_id: string
          menu_item_id: string | null
          section_label: string
          section_label_en: string
        }
        Insert: {
          business_id?: string
          combo_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          menu_id: string
          menu_item_id?: string | null
          section_label?: string
          section_label_en?: string
        }
        Update: {
          business_id?: string
          combo_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          menu_id?: string
          menu_item_id?: string | null
          section_label?: string
          section_label_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_entries_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_entries_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_entries_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_addons: {
        Row: {
          business_id: string
          created_at: string
          display_order: number
          extra_price: number
          id: string
          menu_item_id: string
          name: string
          name_en: string
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          display_order?: number
          extra_price?: number
          id?: string
          menu_item_id: string
          name: string
          name_en?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          display_order?: number
          extra_price?: number
          id?: string
          menu_item_id?: string
          name?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_addons_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          business_id: string
          id: string
          ingredient_id: string | null
          menu_item_id: string
          quantity: number
          source_menu_item_id: string | null
        }
        Insert: {
          business_id?: string
          id?: string
          ingredient_id?: string | null
          menu_item_id: string
          quantity?: number
          source_menu_item_id?: string | null
        }
        Update: {
          business_id?: string
          id?: string
          ingredient_id?: string | null
          menu_item_id?: string
          quantity?: number
          source_menu_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
      menu_item_platforms: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_available: boolean
          menu_item_id: string
          platform_id: string
          price: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_available?: boolean
          menu_item_id: string
          platform_id: string
          price: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_available?: boolean
          menu_item_id?: string
          platform_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_platforms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_platforms_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "delivery_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_skus: {
        Row: {
          business_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          menu_item_id: string
        }
        Insert: {
          business_id?: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          menu_item_id: string
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_skus_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_skus_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          business_id: string
          category_id: string | null
          cooking_time_seconds: number | null
          cooking_warning_seconds: number
          cost: number
          created_at: string
          description: string
          description_en: string
          id: string
          image_url: string | null
          inventory_count: number | null
          is_available: boolean
          low_stock_threshold: number | null
          name: string
          name_en: string
          price: number
          promo_price: number | null
          requires_kitchen: boolean
          updated_at: string
        }
        Insert: {
          business_id?: string
          category_id?: string | null
          cooking_time_seconds?: number | null
          cooking_warning_seconds?: number
          cost?: number
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_available?: boolean
          low_stock_threshold?: number | null
          name: string
          name_en?: string
          price?: number
          promo_price?: number | null
          requires_kitchen?: boolean
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_id?: string | null
          cooking_time_seconds?: number | null
          cooking_warning_seconds?: number
          cost?: number
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_available?: boolean
          low_stock_threshold?: number | null
          name?: string
          name_en?: string
          price?: number
          promo_price?: number | null
          requires_kitchen?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          business_id: string
          created_at: string
          description: string
          description_en: string
          id: string
          is_online: boolean
          name: string
          name_en: string
          parent_menu_id: string | null
          status: Database["public"]["Enums"]["menu_status"]
          type: Database["public"]["Enums"]["menu_type"]
          updated_at: string
          version: number
        }
        Insert: {
          business_id?: string
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          is_online?: boolean
          name: string
          name_en?: string
          parent_menu_id?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          type?: Database["public"]["Enums"]["menu_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string
          description_en?: string
          id?: string
          is_online?: boolean
          name?: string
          name_en?: string
          parent_menu_id?: string | null
          status?: Database["public"]["Enums"]["menu_status"]
          type?: Database["public"]["Enums"]["menu_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "menus_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_parent_menu_id_fkey"
            columns: ["parent_menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          business_id: string
          combo_group_id: string | null
          combo_id: string | null
          created_at: string
          discount: number
          discount_amount: number
          id: string
          menu_item_id: string
          notes: string
          order_id: string
          quantity: number
          ready_at: string | null
          started_at: string | null
          status: string
          unit_price: number
        }
        Insert: {
          business_id?: string
          combo_group_id?: string | null
          combo_id?: string | null
          created_at?: string
          discount?: number
          discount_amount?: number
          id?: string
          menu_item_id: string
          notes?: string
          order_id: string
          quantity?: number
          ready_at?: string | null
          started_at?: string | null
          status?: string
          unit_price?: number
        }
        Update: {
          business_id?: string
          combo_group_id?: string | null
          combo_id?: string | null
          created_at?: string
          discount?: number
          discount_amount?: number
          id?: string
          menu_item_id?: string
          notes?: string
          order_id?: string
          quantity?: number
          ready_at?: string | null
          started_at?: string | null
          status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
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
          business_id: string
          cancel_reason: string | null
          created_at: string
          created_by: string
          delivery_platform_id: string | null
          delivery_status: string | null
          external_ref: string | null
          general_discount: number
          general_discount_amount: number
          id: string
          is_delivery: boolean
          notes: string
          parent_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_number: number
          total: number
          updated_at: string
        }
        Insert: {
          business_id?: string
          cancel_reason?: string | null
          created_at?: string
          created_by: string
          delivery_platform_id?: string | null
          delivery_status?: string | null
          external_ref?: string | null
          general_discount?: number
          general_discount_amount?: number
          id?: string
          is_delivery?: boolean
          notes?: string
          parent_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number: number
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string
          delivery_platform_id?: string | null
          delivery_status?: string | null
          external_ref?: string | null
          general_discount?: number
          general_discount_amount?: number
          id?: string
          is_delivery?: boolean
          notes?: string
          parent_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_platform_id_fkey"
            columns: ["delivery_platform_id"]
            isOneToOne: false
            referencedRelation: "delivery_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string
          delivery_platform_id: string | null
          evidence_reference: string | null
          evidence_url: string | null
          id: string
          order_id: string
          payment_method: string
          tip: number
        }
        Insert: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by: string
          delivery_platform_id?: string | null
          evidence_reference?: string | null
          evidence_url?: string | null
          id?: string
          order_id: string
          payment_method?: string
          tip?: number
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string
          delivery_platform_id?: string | null
          evidence_reference?: string | null
          evidence_url?: string | null
          id?: string
          order_id?: string
          payment_method?: string
          tip?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_delivery_platform_id_fkey"
            columns: ["delivery_platform_id"]
            isOneToOne: false
            referencedRelation: "delivery_platforms"
            referencedColumns: ["id"]
          },
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
          active_business_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          active_business_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          active_business_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_business_id_fkey"
            columns: ["active_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          business_id: string
          created_at: string
          enabled_events: string[]
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          business_id?: string
          created_at?: string
          enabled_events?: string[]
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          business_id?: string
          created_at?: string
          enabled_events?: string[]
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string
          frequency: string
          id: string
          is_active: boolean
          name: string
          next_due_date: string | null
          notes: string
          payment_source: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by: string
          frequency?: string
          id?: string
          is_active?: boolean
          name: string
          next_due_date?: string | null
          notes?: string
          payment_source?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string | null
          notes?: string
          payment_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          customer_email: string
          customer_instagram: string
          customer_name: string
          customer_phone: string
          deposit_amount: number
          deposit_method: string
          deposit_paid: boolean
          deposit_reference: string
          event_id: string | null
          id: string
          notes: string
          party_size: number
          reminder_sent: boolean
          reserved_for: string
          special_requests: string
          status: Database["public"]["Enums"]["reservation_status"]
          table_number: number | null
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          created_by: string
          customer_email?: string
          customer_instagram?: string
          customer_name: string
          customer_phone?: string
          deposit_amount?: number
          deposit_method?: string
          deposit_paid?: boolean
          deposit_reference?: string
          event_id?: string | null
          id?: string
          notes?: string
          party_size?: number
          reminder_sent?: boolean
          reserved_for: string
          special_requests?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          table_number?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          customer_email?: string
          customer_instagram?: string
          customer_name?: string
          customer_phone?: string
          deposit_amount?: number
          deposit_method?: string
          deposit_paid?: boolean
          deposit_reference?: string
          event_id?: string | null
          id?: string
          notes?: string
          party_size?: number
          reminder_sent?: boolean
          reserved_for?: string
          special_requests?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          table_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          business_id: string
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_employees: {
        Row: {
          business_id: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          business_id: string
          created_at: string
          date: string
          employee_id: string
          end_time: string | null
          id: string
          kind: string
          notes: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          date: string
          employee_id: string
          end_time?: string | null
          id?: string
          kind: string
          notes?: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          kind?: string
          notes?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "schedule_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_shifts: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          end_time: string
          id: string
          notes: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          end_time: string
          id?: string
          notes?: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "schedule_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_debts: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          is_settled: boolean
          issued_at: string
          notes: string
          paid_amount: number
          payment_source: string
          provider: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id: string
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          is_settled?: boolean
          issued_at?: string
          notes?: string
          paid_amount?: number
          payment_source?: string
          provider: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          is_settled?: boolean
          issued_at?: string
          notes?: string
          paid_amount?: number
          payment_source?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_debts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_prints: {
        Row: {
          business_id: string
          id: string
          printed_at: string
          printed_by: string
          ticket_id: string
        }
        Insert: {
          business_id?: string
          id?: string
          printed_at?: string
          printed_by: string
          ticket_id: string
        }
        Update: {
          business_id?: string
          id?: string
          printed_at?: string
          printed_by?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_prints_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_prints_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          customer_email_for_invoice: string
          customer_rfc: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          notes: string
          order_id: string
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          public_id: string
          requested_invoice: boolean
          snapshot: Json
          subtotal: number
          tip: number
          total: number
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          created_by: string
          customer_email_for_invoice?: string
          customer_rfc?: string
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          notes?: string
          order_id: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          public_id?: string
          requested_invoice?: boolean
          snapshot?: Json
          subtotal?: number
          tip?: number
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          customer_email_for_invoice?: string
          customer_rfc?: string
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          notes?: string
          order_id?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          public_id?: string
          requested_invoice?: boolean
          snapshot?: Json
          subtotal?: number
          tip?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      till_sessions: {
        Row: {
          business_id: string
          closed_at: string | null
          closed_by: string | null
          closing_counted: number | null
          closing_denominations: Json | null
          closing_difference: number | null
          closing_expected: number | null
          closing_notes: string | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          opening_float: number
          opening_notes: string | null
          status: string
          updated_at: string
          z_report: Json | null
        }
        Insert: {
          business_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_counted?: number | null
          closing_denominations?: Json | null
          closing_difference?: number | null
          closing_expected?: number | null
          closing_notes?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by: string
          opening_float?: number
          opening_notes?: string | null
          status?: string
          updated_at?: string
          z_report?: Json | null
        }
        Update: {
          business_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_counted?: number | null
          closing_denominations?: Json | null
          closing_difference?: number | null
          closing_expected?: number | null
          closing_notes?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string
          opening_float?: number
          opening_notes?: string | null
          status?: string
          updated_at?: string
          z_report?: Json | null
        }
        Relationships: []
      }
      till_transactions: {
        Row: {
          amount: number
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string
          id: string
          note: string
          origin: string
          payment_id: string | null
          till_session_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          note?: string
          origin?: string
          payment_id?: string | null
          till_session_id?: string | null
          type?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          origin?: string
          payment_id?: string | null
          till_session_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "till_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "till_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "till_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "till_transactions_till_session_id_fkey"
            columns: ["till_session_id"]
            isOneToOne: false
            referencedRelation: "till_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          action_name: string
          business_id: string
          created_at: string
          duration_ms: number | null
          event_type: string
          from_path: string
          id: string
          metadata: Json
          path: string
          role: string
          user_id: string
        }
        Insert: {
          action_name?: string
          business_id?: string
          created_at?: string
          duration_ms?: number | null
          event_type: string
          from_path?: string
          id?: string
          metadata?: Json
          path?: string
          role?: string
          user_id: string
        }
        Update: {
          action_name?: string
          business_id?: string
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          from_path?: string
          id?: string
          metadata?: Json
          path?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_fingerprints: {
        Row: {
          business_id: string
          created_at: string
          device_label: string | null
          id: string
          template_hash: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          device_label?: string | null
          id?: string
          template_hash: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          device_label?: string | null
          id?: string
          template_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fingerprints_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      user_shift_schedules: {
        Row: {
          active: boolean
          auto_logout_offset_minutes: number
          business_id: string
          check_in_time: string
          check_out_time: string
          created_at: string
          early_window_minutes: number
          id: string
          late_window_minutes: number
          updated_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          auto_logout_offset_minutes?: number
          business_id: string
          check_in_time?: string
          check_out_time?: string
          created_at?: string
          early_window_minutes?: number
          id?: string
          late_window_minutes?: number
          updated_at?: string
          user_id: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          auto_logout_offset_minutes?: number
          business_id?: string
          check_in_time?: string
          check_out_time?: string
          created_at?: string
          early_window_minutes?: number
          id?: string
          late_window_minutes?: number
          updated_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_shift_schedules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_ingredient_usage: {
        Args: {
          _kind: string
          _menu_item_id: string
          _order_item_id: string
          _qty: number
        }
        Returns: undefined
      }
      attempt_check_in:
        | {
            Args: {
              _device_id: string
              _fingerprint_hash: string
              _method?: string
              _user_id: string
            }
            Returns: {
              business_id: string
              check_in_at: string
              check_in_method: string
              check_out_at: string | null
              check_out_method: string | null
              created_at: string
              device_id: string | null
              fingerprint_hash: string | null
              id: string
              late: boolean
              notes: string | null
              scheduled_check_in: string | null
              scheduled_check_out: string | null
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "attendance_sessions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _device_id: string
              _fingerprint_hash: string
              _id?: string
              _method?: string
              _user_id: string
            }
            Returns: {
              business_id: string
              check_in_at: string
              check_in_method: string
              check_out_at: string | null
              check_out_method: string | null
              created_at: string
              device_id: string | null
              fingerprint_hash: string | null
              id: string
              late: boolean
              notes: string | null
              scheduled_check_in: string | null
              scheduled_check_out: string | null
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "attendance_sessions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      attempt_check_out: {
        Args: {
          _device_id: string
          _fingerprint_hash: string
          _method?: string
          _user_id: string
        }
        Returns: {
          business_id: string
          check_in_at: string
          check_in_method: string
          check_out_at: string | null
          check_out_method: string | null
          created_at: string
          device_id: string | null
          fingerprint_hash: string | null
          id: string
          late: boolean
          notes: string | null
          scheduled_check_in: string | null
          scheduled_check_out: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_schedule: { Args: { _business_id: string }; Returns: boolean }
      close_expired_sessions: { Args: never; Returns: number }
      close_till_session: {
        Args: {
          _counted: number
          _denominations?: Json
          _notes?: string
          _session_id: string
        }
        Returns: {
          business_id: string
          closed_at: string | null
          closed_by: string | null
          closing_counted: number | null
          closing_denominations: Json | null
          closing_difference: number | null
          closing_expected: number | null
          closing_notes: string | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          opening_float: number
          opening_notes: string | null
          status: string
          updated_at: string
          z_report: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "till_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_business_id: { Args: never; Returns: string }
      current_till_session: {
        Args: never
        Returns: {
          business_id: string
          closed_at: string | null
          closed_by: string | null
          closing_counted: number | null
          closing_denominations: Json | null
          closing_difference: number | null
          closing_expected: number | null
          closing_notes: string | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          opening_float: number
          opening_notes: string | null
          status: string
          updated_at: string
          z_report: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "till_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_schedule_for: {
        Args: { _at: string; _user_id: string }
        Returns: {
          active: boolean
          auto_logout_offset_minutes: number
          business_id: string
          check_in_time: string
          check_out_time: string
          created_at: string
          early_window_minutes: number
          id: string
          late_window_minutes: number
          updated_at: string
          user_id: string
          weekday: number | null
        }
        SetofOptions: {
          from: "*"
          to: "user_shift_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_business_role: {
        Args: { _business_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      has_open_attendance_session: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_member_of: { Args: { _business_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      open_till_session:
        | {
            Args: { _notes?: string; _opening_float: number }
            Returns: {
              business_id: string
              closed_at: string | null
              closed_by: string | null
              closing_counted: number | null
              closing_denominations: Json | null
              closing_difference: number | null
              closing_expected: number | null
              closing_notes: string | null
              created_at: string
              id: string
              opened_at: string
              opened_by: string
              opening_float: number
              opening_notes: string | null
              status: string
              updated_at: string
              z_report: Json | null
            }
            SetofOptions: {
              from: "*"
              to: "till_sessions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { _id?: string; _notes?: string; _opening_float: number }
            Returns: {
              business_id: string
              closed_at: string | null
              closed_by: string | null
              closing_counted: number | null
              closing_denominations: Json | null
              closing_difference: number | null
              closing_expected: number | null
              closing_notes: string | null
              created_at: string
              id: string
              opened_at: string
              opened_by: string
              opening_float: number
              opening_notes: string | null
              status: string
              updated_at: string
              z_report: Json | null
            }
            SetofOptions: {
              from: "*"
              to: "till_sessions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      restock_ingredient: {
        Args: {
          _ingredient_id: string
          _note?: string
          _packs: number
          _qty: number
        }
        Returns: number
      }
      set_active_business: {
        Args: { _business_id: string }
        Returns: undefined
      }
      till_tx_signed: {
        Args: { _amount: number; _type: string }
        Returns: number
      }
      till_x_report: { Args: { _session_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "waiter"
        | "billing"
        | "kitchen"
        | "loyalty_member"
        | "super_admin"
      event_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      event_type: "live_music" | "private" | "promo" | "workshop" | "other"
      menu_status: "draft" | "published" | "archived"
      menu_type: "main" | "seasonal" | "event"
      order_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "ready"
        | "served"
        | "paid"
      reservation_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "no_show"
        | "completed"
      ticket_kind: "pre_payment" | "receipt"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "waiter",
        "billing",
        "kitchen",
        "loyalty_member",
        "super_admin",
      ],
      event_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      event_type: ["live_music", "private", "promo", "workshop", "other"],
      menu_status: ["draft", "published", "archived"],
      menu_type: ["main", "seasonal", "event"],
      order_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        "ready",
        "served",
        "paid",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "cancelled",
        "no_show",
        "completed",
      ],
      ticket_kind: ["pre_payment", "receipt"],
    },
  },
} as const

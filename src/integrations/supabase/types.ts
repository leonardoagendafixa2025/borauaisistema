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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          neighborhood: string | null
          number: string | null
          state: string | null
          street: string
          zip_code: string | null
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          state?: string | null
          street: string
          zip_code?: string | null
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          state?: string | null
          street?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      cashier_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          restaurant_id: string
          total_orders: number
          total_revenue: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by: string
          restaurant_id: string
          total_orders?: number
          total_revenue?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string
          restaurant_id?: string
          total_orders?: number
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "cashier_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          restaurant_id: string
          skip_kitchen: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          restaurant_id: string
          skip_kitchen?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          restaurant_id?: string
          skip_kitchen?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          min_order_value: number | null
          restaurant_id: string
          used_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
          restaurant_id: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
          restaurant_id?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_telegram_links: {
        Row: {
          chat_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          link_token: string
          linked_at: string | null
          notify_status_updates: boolean
          status: string
          updated_at: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          link_token: string
          linked_at?: string | null
          notify_status_updates?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          link_token?: string
          linked_at?: string | null
          notify_status_updates?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_telegram_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          restaurant_id: string
          total_orders: number
          total_spent: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          restaurant_id: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          restaurant_id?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          access_pin: string | null
          created_at: string
          id: string
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          name: string
          phone: string | null
          restaurant_id: string
          status: string
          updated_at: string
          vehicle: string
        }
        Insert: {
          access_pin?: string | null
          created_at?: string
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          name: string
          phone?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
          vehicle?: string
        }
        Update: {
          access_pin?: string | null
          created_at?: string
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          name?: string
          phone?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
          vehicle?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          delivery_fee: number
          estimated_time: number | null
          id: string
          min_order_value: number | null
          neighborhood: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          delivery_fee?: number
          estimated_time?: number | null
          id?: string
          min_order_value?: number | null
          neighborhood: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          delivery_fee?: number
          estimated_time?: number | null
          id?: string
          min_order_value?: number | null
          neighborhood?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          driver_id: string
          id: string
          order_id: string
          rating: number
          restaurant_id: string
          tags: string[] | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          driver_id: string
          id?: string
          order_id: string
          rating: number
          restaurant_id: string
          tags?: string[] | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          driver_id?: string
          id?: string
          order_id?: string
          rating?: number
          restaurant_id?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_ratings_summary"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          restaurant_id: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          restaurant_id: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          restaurant_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          recurring: boolean
          recurring_interval: string | null
          restaurant_id: string
          status: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurring?: boolean
          recurring_interval?: string | null
          restaurant_id: string
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurring?: boolean
          recurring_interval?: string | null
          restaurant_id?: string
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          restaurant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          restaurant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_tokens: {
        Row: {
          admin_user_id: string
          created_at: string
          expires_at: string
          id: string
          reason: string | null
          restaurant_id: string | null
          target_user_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          expires_at: string
          id?: string
          reason?: string | null
          restaurant_id?: string | null
          target_user_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string | null
          restaurant_id?: string | null
          target_user_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active: boolean
          cost_per_unit: number
          created_at: string
          current_stock: number
          id: string
          min_stock: number
          name: string
          restaurant_id: string
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          min_stock?: number
          name: string
          restaurant_id: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          min_stock?: number
          name?: string
          restaurant_id?: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      master_broadcasts: {
        Row: {
          body: string
          channel: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_count: number
          id: string
          segment: Json | null
          sent_by: string | null
          sent_count: number
          status: string
          subject: string | null
          template_key: string | null
          total_recipients: number
        }
        Insert: {
          body: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number
          id?: string
          segment?: Json | null
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          template_key?: string | null
          total_recipients?: number
        }
        Update: {
          body?: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number
          id?: string
          segment?: Json | null
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          template_key?: string | null
          total_recipients?: number
        }
        Relationships: []
      }
      master_message_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          subject: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          active?: boolean
          body: string
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      music_requests: {
        Row: {
          billing_mode: string
          command_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          dedication: string | null
          id: string
          order_item_id: string | null
          payment_status: string
          played_at: string | null
          price: number
          rejected_reason: string | null
          restaurant_id: string
          song_text: string
          status: string
          table_label: string | null
          updated_at: string
        }
        Insert: {
          billing_mode?: string
          command_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          dedication?: string | null
          id?: string
          order_item_id?: string | null
          payment_status?: string
          played_at?: string | null
          price?: number
          rejected_reason?: string | null
          restaurant_id: string
          song_text: string
          status?: string
          table_label?: string | null
          updated_at?: string
        }
        Update: {
          billing_mode?: string
          command_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          dedication?: string | null
          id?: string
          order_item_id?: string | null
          payment_status?: string
          played_at?: string | null
          price?: number
          rejected_reason?: string | null
          restaurant_id?: string
          song_text?: string
          status?: string
          table_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_requests_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "table_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      nightlife_acts: {
        Row: {
          active: boolean
          artist_name: string
          created_at: string
          description: string | null
          ends_at: string
          genre: string | null
          id: string
          image_url: string | null
          restaurant_id: string
          sort_order: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist_name: string
          created_at?: string
          description?: string | null
          ends_at: string
          genre?: string | null
          id?: string
          image_url?: string | null
          restaurant_id: string
          sort_order?: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist_name?: string
          created_at?: string
          description?: string | null
          ends_at?: string
          genre?: string | null
          id?: string
          image_url?: string | null
          restaurant_id?: string
          sort_order?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      nightlife_hour_drinks: {
        Row: {
          active: boolean
          created_at: string
          custom_image_url: string | null
          custom_name: string | null
          ends_at: string
          highlight_text: string | null
          id: string
          product_id: string | null
          promo_price: number
          restaurant_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_image_url?: string | null
          custom_name?: string | null
          ends_at: string
          highlight_text?: string | null
          id?: string
          product_id?: string | null
          promo_price: number
          restaurant_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_image_url?: string | null
          custom_name?: string | null
          ends_at?: string
          highlight_text?: string | null
          id?: string
          product_id?: string | null
          promo_price?: number
          restaurant_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      nightlife_wristbands: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          credit_limit: number
          customer_name: string | null
          customer_phone: string | null
          id: string
          issued_at: string
          issued_by: string | null
          notes: string | null
          restaurant_id: string
          status: string
          tier: string
          total_consumed: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          code: string
          created_at?: string
          credit_limit?: number
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          restaurant_id: string
          status?: string
          tier?: string
          total_consumed?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          code?: string
          created_at?: string
          credit_limit?: number
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          restaurant_id?: string
          status?: string
          tier?: string
          total_consumed?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          restaurant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          restaurant_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          restaurant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          restaurant_id: string
          steps_done: Json
          tour_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          restaurant_id: string
          steps_done?: Json
          tour_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          restaurant_id?: string
          steps_done?: Json
          tour_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          command_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          options: Json | null
          order_id: string
          product_id: string | null
          qty: number
          total_price: number
          unit_price: number
        }
        Insert: {
          command_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          options?: Json | null
          order_id: string
          product_id?: string | null
          qty?: number
          total_price: number
          unit_price: number
        }
        Update: {
          command_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          options?: Json | null
          order_id?: string
          product_id?: string | null
          qty?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "table_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          bar_delivered_at: string | null
          bar_pickup_code: string | null
          bar_ready_at: string | null
          bar_status: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee: number
          delivery_zone_id: string | null
          discount: number
          dispatched_at: string | null
          driver_accepted_at: string | null
          driver_id: string | null
          id: string
          notes: string | null
          number: number
          payment_method: string | null
          payment_status: string | null
          restaurant_id: string
          served_by: string | null
          sla_acknowledged_at: string | null
          sla_alert_sent_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
          wristband_code: string | null
          wristband_id: string | null
        }
        Insert: {
          address?: string | null
          bar_delivered_at?: string | null
          bar_pickup_code?: string | null
          bar_ready_at?: string | null
          bar_status?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          discount?: number
          dispatched_at?: string | null
          driver_accepted_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          number?: number
          payment_method?: string | null
          payment_status?: string | null
          restaurant_id: string
          served_by?: string | null
          sla_acknowledged_at?: string | null
          sla_alert_sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
          wristband_code?: string | null
          wristband_id?: string | null
        }
        Update: {
          address?: string | null
          bar_delivered_at?: string | null
          bar_pickup_code?: string | null
          bar_ready_at?: string | null
          bar_status?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          discount?: number
          dispatched_at?: string | null
          driver_accepted_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          number?: number
          payment_method?: string | null
          payment_status?: string | null
          restaurant_id?: string
          served_by?: string | null
          sla_acknowledged_at?: string | null
          sla_alert_sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
          wristband_code?: string | null
          wristband_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_ratings_summary"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_coupons: {
        Row: {
          active: boolean
          applies_to_tier: string | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          duration_months: number
          id: string
          max_uses: number | null
          updated_at: string
          used_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          applies_to_tier?: string | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration_months?: number
          id?: string
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          applies_to_tier?: string | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration_months?: number
          id?: string
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      product_combo_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "product_combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_combos: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name: string
          price?: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_combos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_combos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          product_id: string
          quantity_used: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          product_id: string
          quantity_used?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          product_id?: string
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          id: string
          max_selections: number
          min_selections: number
          name: string
          product_id: string
          required: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_selections?: number
          min_selections?: number
          name: string
          product_id: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          max_selections?: number
          min_selections?: number
          name?: string
          product_id?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          active: boolean
          created_at: string
          group_id: string
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id: string
          id?: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          is_quick_sale: boolean
          name: string
          price: number
          price_per_kg: number | null
          promo_price: number | null
          restaurant_id: string
          sold_by_weight: boolean
          sold_out: boolean
          sort_order: number
          unit_label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          is_quick_sale?: boolean
          name: string
          price: number
          price_per_kg?: number | null
          promo_price?: number | null
          restaurant_id: string
          sold_by_weight?: boolean
          sold_out?: boolean
          sort_order?: number
          unit_label?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          is_quick_sale?: boolean
          name?: string
          price?: number
          price_per_kg?: number | null
          promo_price?: number | null
          restaurant_id?: string
          sold_by_weight?: boolean
          sold_out?: boolean
          sort_order?: number
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          restaurant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          restaurant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          restaurant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          active: boolean
          code: string
          commission_pct: number
          conversions_count: number
          created_at: string
          id: string
          restaurant_id: string
          total_earned: number
          uses_count: number
        }
        Insert: {
          active?: boolean
          code: string
          commission_pct?: number
          conversions_count?: number
          created_at?: string
          id?: string
          restaurant_id: string
          total_earned?: number
          uses_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          commission_pct?: number
          conversions_count?: number
          created_at?: string
          id?: string
          restaurant_id?: string
          total_earned?: number
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_conversions: {
        Row: {
          commission_amount: number
          confirmed_at: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          referral_code_id: string
          referred_restaurant_id: string
          status: string
        }
        Insert: {
          commission_amount?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          referral_code_id: string
          referred_restaurant_id: string
          status?: string
        }
        Update: {
          commission_amount?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          referral_code_id?: string
          referred_restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_conversions_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_conversions_referred_restaurant_id_fkey"
            columns: ["referred_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_conversions_referred_restaurant_id_fkey"
            columns: ["referred_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_banners: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          link_target: string | null
          link_type: string
          restaurant_id: string
          sort_order: number
          starts_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          link_target?: string | null
          link_type?: string
          restaurant_id: string
          sort_order?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          link_target?: string | null
          link_type?: string
          restaurant_id?: string
          sort_order?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_banners_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_banners_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_feature_flags: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          flag_key: string
          id: string
          notes: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          notes?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: {
          couvert_enabled: boolean
          couvert_value: number | null
          created_at: string
          delivery_enabled: boolean
          delivery_fee: number | null
          dine_in_enabled: boolean
          estimated_prep_time: number | null
          id: string
          min_order_value: number | null
          music_requests_enabled: boolean
          music_requests_price: number
          music_requests_require_approval: boolean
          music_requests_window_end: string | null
          music_requests_window_start: string | null
          opening_hours: Json | null
          payment_methods: Json | null
          pickup_enabled: boolean
          primary_color: string | null
          quick_sale_active_days: number[]
          quick_sale_auto_schedule: boolean
          quick_sale_commission_percent: number
          quick_sale_enabled: boolean
          quick_sale_end_time: string | null
          quick_sale_start_time: string | null
          quick_sale_thankyou_message: string | null
          quick_sale_welcome_message: string | null
          restaurant_id: string
          secondary_color: string | null
          service_fee_enabled: boolean
          service_fee_percent: number | null
          telegram_chat_id: string | null
          updated_at: string
        }
        Insert: {
          couvert_enabled?: boolean
          couvert_value?: number | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: number | null
          dine_in_enabled?: boolean
          estimated_prep_time?: number | null
          id?: string
          min_order_value?: number | null
          music_requests_enabled?: boolean
          music_requests_price?: number
          music_requests_require_approval?: boolean
          music_requests_window_end?: string | null
          music_requests_window_start?: string | null
          opening_hours?: Json | null
          payment_methods?: Json | null
          pickup_enabled?: boolean
          primary_color?: string | null
          quick_sale_active_days?: number[]
          quick_sale_auto_schedule?: boolean
          quick_sale_commission_percent?: number
          quick_sale_enabled?: boolean
          quick_sale_end_time?: string | null
          quick_sale_start_time?: string | null
          quick_sale_thankyou_message?: string | null
          quick_sale_welcome_message?: string | null
          restaurant_id: string
          secondary_color?: string | null
          service_fee_enabled?: boolean
          service_fee_percent?: number | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Update: {
          couvert_enabled?: boolean
          couvert_value?: number | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: number | null
          dine_in_enabled?: boolean
          estimated_prep_time?: number | null
          id?: string
          min_order_value?: number | null
          music_requests_enabled?: boolean
          music_requests_price?: number
          music_requests_require_approval?: boolean
          music_requests_window_end?: string | null
          music_requests_window_start?: string | null
          opening_hours?: Json | null
          payment_methods?: Json | null
          pickup_enabled?: boolean
          primary_color?: string | null
          quick_sale_active_days?: number[]
          quick_sale_auto_schedule?: boolean
          quick_sale_commission_percent?: number
          quick_sale_enabled?: boolean
          quick_sale_end_time?: string | null
          quick_sale_start_time?: string | null
          quick_sale_thankyou_message?: string | null
          quick_sale_welcome_message?: string | null
          restaurant_id?: string
          secondary_color?: string | null
          service_fee_enabled?: boolean
          service_fee_percent?: number | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          label: string | null
          number: number
          qr_code_url: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          label?: string | null
          number: number
          qr_code_url?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          label?: string | null
          number?: number
          qr_code_url?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          banner_url: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          force_closed: boolean
          id: string
          is_open: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["restaurant_status"]
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          force_closed?: boolean
          id?: string
          is_open?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["restaurant_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          force_closed?: boolean
          id?: string
          is_open?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["restaurant_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      satisfaction_surveys: {
        Row: {
          category: string | null
          comment: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivery_rating: number | null
          food_rating: number | null
          id: string
          order_id: string | null
          restaurant_id: string
          score: number
          service_rating: number | null
          tags: string[] | null
        }
        Insert: {
          category?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id?: string | null
          restaurant_id: string
          score: number
          service_rating?: number | null
          tags?: string[] | null
        }
        Update: {
          category?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id?: string | null
          restaurant_id?: string
          score?: number
          service_rating?: number | null
          tags?: string[] | null
        }
        Relationships: []
      }
      status_incidents: {
        Row: {
          component: string | null
          created_at: string
          description: string | null
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          component?: string | null
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          component?: string | null
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string | null
          raw_payload: Json | null
          restaurant_id: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          subscription_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          raw_payload?: Json | null
          restaurant_id: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          raw_payload?: Json | null
          restaurant_id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_plan_id: string | null
          from_status: string | null
          id: string
          reason: string | null
          restaurant_id: string
          subscription_id: string | null
          to_plan_id: string | null
          to_status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          restaurant_id: string
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          reason?: string | null
          restaurant_id?: string
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          advanced_reports: boolean
          created_at: string
          custom_domain: boolean
          description: string | null
          features: Json | null
          id: string
          max_coupons: number
          max_users: number
          name: string
          price: number
          stripe_lookup_key: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          visual_customization: boolean
        }
        Insert: {
          active?: boolean
          advanced_reports?: boolean
          created_at?: string
          custom_domain?: boolean
          description?: string | null
          features?: Json | null
          id?: string
          max_coupons?: number
          max_users?: number
          name: string
          price?: number
          stripe_lookup_key?: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          visual_customization?: boolean
        }
        Update: {
          active?: boolean
          advanced_reports?: boolean
          created_at?: string
          custom_domain?: boolean
          description?: string | null
          features?: Json | null
          id?: string
          max_coupons?: number
          max_users?: number
          name?: string
          price?: number
          stripe_lookup_key?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          visual_customization?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          environment: string
          id: string
          last_payment_at: string | null
          monthly_price: number
          plan_id: string
          platform_fee_percent: number | null
          restaurant_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          environment?: string
          id?: string
          last_payment_at?: string | null
          monthly_price?: number
          plan_id: string
          platform_fee_percent?: number | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          environment?: string
          id?: string
          last_payment_at?: string | null
          monthly_price?: number
          plan_id?: string
          platform_fee_percent?: number | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      table_commands: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          id: string
          opened_at: string
          restaurant_id: string
          status: string
          table_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          id?: string
          opened_at?: string
          restaurant_id: string
          status?: string
          table_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          id?: string
          opened_at?: string
          restaurant_id?: string
          status?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_commands_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_commands_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_commands_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_partial_payments: {
        Row: {
          amount: number
          closed: boolean
          created_at: string
          created_by: string | null
          id: string
          paid_by: string | null
          payment_method: string
          people_count: number
          restaurant_id: string
          session_started_at: string
          table_id: string
        }
        Insert: {
          amount: number
          closed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          paid_by?: string | null
          payment_method?: string
          people_count?: number
          restaurant_id: string
          session_started_at?: string
          table_id: string
        }
        Update: {
          amount?: number
          closed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          paid_by?: string | null
          payment_method?: string
          people_count?: number
          restaurant_id?: string
          session_started_at?: string
          table_id?: string
        }
        Relationships: []
      }
      table_reservations: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          people_count: number
          reservation_date: string
          reservation_time: string
          restaurant_id: string
          status: string
          table_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          people_count?: number
          reservation_date: string
          reservation_time: string
          restaurant_id: string
          status?: string
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          people_count?: number
          reservation_date?: string
          reservation_time?: string
          restaurant_id?: string
          status?: string
          table_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          restaurant_id: string
          session_id: string
          status: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          restaurant_id: string
          session_id: string
          status?: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          restaurant_id?: string
          session_id?: string
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_staff_links: {
        Row: {
          active: boolean
          chat_id: string
          created_at: string
          id: string
          restaurant_id: string
          staff_name: string
        }
        Insert: {
          active?: boolean
          chat_id: string
          created_at?: string
          id?: string
          restaurant_id: string
          staff_name: string
        }
        Update: {
          active?: boolean
          chat_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          staff_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_staff_links_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_staff_links_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          restaurant_id: string
          status: string
          table_id: string
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          restaurant_id: string
          status?: string
          table_id: string
          type?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string
          status?: string
          table_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      driver_ratings_summary: {
        Row: {
          avg_rating: number | null
          driver_id: string | null
          name: string | null
          restaurant_id: string | null
          total_ratings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings_public: {
        Row: {
          couvert_enabled: boolean | null
          couvert_value: number | null
          created_at: string | null
          delivery_enabled: boolean | null
          delivery_fee: number | null
          dine_in_enabled: boolean | null
          estimated_prep_time: number | null
          id: string | null
          min_order_value: number | null
          opening_hours: Json | null
          payment_methods: Json | null
          pickup_enabled: boolean | null
          primary_color: string | null
          quick_sale_active_days: number[] | null
          quick_sale_enabled: boolean | null
          quick_sale_end_time: string | null
          quick_sale_start_time: string | null
          quick_sale_thankyou_message: string | null
          quick_sale_welcome_message: string | null
          restaurant_id: string | null
          secondary_color: string | null
          service_fee_enabled: boolean | null
          service_fee_percent: number | null
          updated_at: string | null
        }
        Insert: {
          couvert_enabled?: boolean | null
          couvert_value?: number | null
          created_at?: string | null
          delivery_enabled?: boolean | null
          delivery_fee?: number | null
          dine_in_enabled?: boolean | null
          estimated_prep_time?: number | null
          id?: string | null
          min_order_value?: number | null
          opening_hours?: Json | null
          payment_methods?: Json | null
          pickup_enabled?: boolean | null
          primary_color?: string | null
          quick_sale_active_days?: number[] | null
          quick_sale_enabled?: boolean | null
          quick_sale_end_time?: string | null
          quick_sale_start_time?: string | null
          quick_sale_thankyou_message?: string | null
          quick_sale_welcome_message?: string | null
          restaurant_id?: string | null
          secondary_color?: string | null
          service_fee_enabled?: boolean | null
          service_fee_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          couvert_enabled?: boolean | null
          couvert_value?: number | null
          created_at?: string | null
          delivery_enabled?: boolean | null
          delivery_fee?: number | null
          dine_in_enabled?: boolean | null
          estimated_prep_time?: number | null
          id?: string | null
          min_order_value?: number | null
          opening_hours?: Json | null
          payment_methods?: Json | null
          pickup_enabled?: boolean | null
          primary_color?: string | null
          quick_sale_active_days?: number[] | null
          quick_sale_enabled?: boolean | null
          quick_sale_end_time?: string | null
          quick_sale_start_time?: string | null
          quick_sale_thankyou_message?: string | null
          quick_sale_welcome_message?: string | null
          restaurant_id?: string | null
          secondary_color?: string | null
          service_fee_enabled?: boolean | null
          service_fee_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants_public: {
        Row: {
          address: string | null
          banner_url: string | null
          city: string | null
          created_at: string | null
          force_closed: boolean | null
          id: string | null
          is_open: boolean | null
          logo_url: string | null
          name: string | null
          phone: string | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["restaurant_status"] | null
          updated_at: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          city?: string | null
          created_at?: string | null
          force_closed?: boolean | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          updated_at?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          city?: string | null
          created_at?: string | null
          force_closed?: boolean | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          updated_at?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_music_request: { Args: { _request_id: string }; Returns: Json }
      can_insert_recent_public_order_item: {
        Args: { _order_id: string }
        Returns: boolean
      }
      driver_confirm_receipt: {
        Args: { _driver_id: string; _order_id: string; _pin: string }
        Returns: {
          accepted_at: string
          already: boolean
          success: boolean
        }[]
      }
      driver_earnings_summary: {
        Args: { _driver_id: string; _pin: string }
        Returns: {
          month_deliveries: number
          month_earnings: number
          today_deliveries: number
          today_earnings: number
          total_deliveries: number
          total_earnings: number
          week_deliveries: number
          week_earnings: number
        }[]
      }
      driver_heartbeat: {
        Args: {
          _driver_id: string
          _lat: number
          _lng: number
          _pin: string
          _status?: string
        }
        Returns: boolean
      }
      driver_list_assigned_orders: {
        Args: { _driver_id: string; _pin: string }
        Returns: {
          address: string | null
          bar_delivered_at: string | null
          bar_pickup_code: string | null
          bar_ready_at: string | null
          bar_status: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee: number
          delivery_zone_id: string | null
          discount: number
          dispatched_at: string | null
          driver_accepted_at: string | null
          driver_id: string | null
          id: string
          notes: string | null
          number: number
          payment_method: string | null
          payment_status: string | null
          restaurant_id: string
          served_by: string | null
          sla_acknowledged_at: string | null
          sla_alert_sent_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
          wristband_code: string | null
          wristband_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      driver_list_history: {
        Args: { _driver_id: string; _limit?: number; _pin: string }
        Returns: {
          address: string
          created_at: string
          customer_name: string
          delivered_at: string
          delivery_fee: number
          dispatched_at: string
          id: string
          number: number
          payment_method: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }[]
      }
      driver_login: {
        Args: { _pin: string; _restaurant_slug: string }
        Returns: {
          driver_id: string
          driver_name: string
          restaurant_id: string
          restaurant_name: string
          vehicle: string
        }[]
      }
      driver_mark_delivered: {
        Args: { _driver_id: string; _order_id: string; _pin: string }
        Returns: boolean
      }
      find_orders_by_phone: {
        Args: { _phone: string; _restaurant_id: string }
        Returns: {
          created_at: string
          customer_name: string
          id: string
          number: number
          status: Database["public"]["Enums"]["order_status"]
          total: number
          type: Database["public"]["Enums"]["order_type"]
        }[]
      }
      generate_driver_pin: { Args: { _restaurant_id: string }; Returns: string }
      get_order_driver_location: {
        Args: { _order_id: string }
        Returns: {
          driver_name: string
          last_lat: number
          last_lng: number
          last_location_at: string
          order_address: string
          order_status: Database["public"]["Enums"]["order_status"]
          status: string
          vehicle: string
        }[]
      }
      get_order_for_tracking: {
        Args: { _order_id: string }
        Returns: {
          address: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          driver_id: string
          id: string
          items: Json
          notes: string
          number: number
          payment_method: string
          payment_status: string
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }[]
      }
      get_order_rating_status: {
        Args: { _order_id: string }
        Returns: {
          driver_done: boolean
          is_delivery: boolean
          restaurant_done: boolean
        }[]
      }
      get_table_open_orders: {
        Args: { _restaurant_id: string; _table_id: string }
        Returns: {
          created_at: string
          customer_name: string
          delivery_fee: number
          discount: number
          id: string
          items: Json
          notes: string
          number: number
          payment_method: string
          payment_status: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; rest_id: string }
        Returns: boolean
      }
      has_min_restaurant_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _restaurant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_restaurant_role: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_drink_category_name: { Args: { _name: string }; Returns: boolean }
      is_restaurant_orderable: { Args: { _id: string }; Returns: boolean }
      list_open_commands_for_table: {
        Args: { _restaurant_id: string; _table_label: string }
        Returns: {
          customer_name: string
          id: string
          open_total: number
          opened_at: string
        }[]
      }
      log_audit_event: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: undefined
      }
      notify_master_event: {
        Args: { _event_type: string; _payload: Json }
        Returns: undefined
      }
      notify_push_event: {
        Args: { _event_type: string; _payload: Json; _restaurant_id: string }
        Returns: undefined
      }
      notify_telegram_event: {
        Args: { _event_type: string; _payload: Json; _restaurant_id: string }
        Returns: undefined
      }
      reject_music_request: {
        Args: { _reason: string; _request_id: string }
        Returns: Json
      }
      restaurant_has_reservations: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      unaccent_simple: { Args: { _t: string }; Returns: string }
      validate_referral_code: {
        Args: { _code: string }
        Returns: {
          active: boolean
          code: string
          id: string
          restaurant_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "finance"
        | "support"
        | "commercial"
        | "owner"
        | "manager"
        | "attendant"
        | "kitchen"
      order_status:
        | "new"
        | "accepted"
        | "preparing"
        | "ready"
        | "delivering"
        | "waiting_pickup"
        | "completed"
        | "cancelled"
      order_type: "delivery" | "pickup" | "dine_in" | "quick_sale"
      plan_tier: "basic" | "professional" | "premium"
      restaurant_status:
        | "active"
        | "trial"
        | "overdue"
        | "suspended"
        | "cancelled"
      subscription_status:
        | "trial"
        | "active"
        | "overdue"
        | "suspended"
        | "cancelled"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
        | "paused"
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
      app_role: [
        "super_admin",
        "finance",
        "support",
        "commercial",
        "owner",
        "manager",
        "attendant",
        "kitchen",
      ],
      order_status: [
        "new",
        "accepted",
        "preparing",
        "ready",
        "delivering",
        "waiting_pickup",
        "completed",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "dine_in", "quick_sale"],
      plan_tier: ["basic", "professional", "premium"],
      restaurant_status: [
        "active",
        "trial",
        "overdue",
        "suspended",
        "cancelled",
      ],
      subscription_status: [
        "trial",
        "active",
        "overdue",
        "suspended",
        "cancelled",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
        "paused",
      ],
    },
  },
} as const

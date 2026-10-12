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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          auto_checks: Json | null
          category: string
          cost_price: number
          created_at: string
          customer_whatsapp: string
          delivered_at: string | null
          delivery_mode: string | null
          id: string
          order_code: string
          pin_delivered: string | null
          player_id: string
          price: number
          product_id: string | null
          product_name: string
          receipt_hash: string | null
          receipt_image_url: string
          reject_reason: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          auto_checks?: Json | null
          category: string
          cost_price?: number
          created_at?: string
          customer_whatsapp: string
          delivered_at?: string | null
          delivery_mode?: string | null
          id?: string
          order_code: string
          pin_delivered?: string | null
          player_id: string
          price: number
          product_id?: string | null
          product_name: string
          receipt_hash?: string | null
          receipt_image_url: string
          reject_reason?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          auto_checks?: Json | null
          category?: string
          cost_price?: number
          created_at?: string
          customer_whatsapp?: string
          delivered_at?: string | null
          delivery_mode?: string | null
          id?: string
          order_code?: string
          pin_delivered?: string | null
          player_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          receipt_hash?: string | null
          receipt_image_url?: string
          reject_reason?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pins_stock: {
        Row: {
          created_at: string
          id: string
          is_used: boolean
          pin_code: string
          product_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_used?: boolean
          pin_code: string
          product_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_used?: boolean
          pin_code?: string
          product_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pins_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "pins_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_change_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_price: number | null
          old_price: number | null
          product_id: string | null
          product_name: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          product_id?: string | null
          product_name?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          product_id?: string | null
          product_name?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string
          cost_price: number
          created_at: string
          deleted_at: string | null
          description: string | null
          how_to_use: string | null
          id: string
          image_url: string | null
          name: string
          price_naira: number
          status: string
          updated_at: string
        }
        Insert: {
          category_id: string
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          how_to_use?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_naira: number
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          how_to_use?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_naira?: number
          status?: string
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
        ]
      }
      settings: {
        Row: {
          auto_mode: boolean
          id: number
          low_stock_threshold: number
          opay_name: string
          opay_number: string
          whatsapp_number: string
          whatsapp_template: string
        }
        Insert: {
          auto_mode?: boolean
          id?: number
          low_stock_threshold?: number
          opay_name?: string
          opay_number?: string
          whatsapp_number?: string
          whatsapp_template?: string
        }
        Update: {
          auto_mode?: boolean
          id?: number
          low_stock_threshold?: number
          opay_name?: string
          opay_number?: string
          whatsapp_number?: string
          whatsapp_template?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_stock: {
        Row: {
          product_id: string | null
          stock_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_order: { Args: { _order_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_order: {
        Args: {
          _player_id: string
          _product_id: string
          _receipt_hash: string
          _receipt_url: string
          _transaction_id: string
          _whatsapp: string
        }
        Returns: Json
      }
      track_order: { Args: { _code: string; _whatsapp: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

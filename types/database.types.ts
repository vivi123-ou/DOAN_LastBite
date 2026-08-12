// Hand-written to match supabase/migrations/0001_init_schema.sql.
// Once the Supabase project is linked, regenerate with:
//   supabase gen types typescript --project-id <id> > types/database.types.ts
// and reconcile any drift — see .claude/rules/workflow.md.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "customer" | "store_owner";
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          address_line: string;
          geog: unknown;
          lat: number | null;
          lng: number | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["addresses"]["Row"]> & {
          user_id: string;
          address_line: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          default_lock_duration_minutes: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & {
          name: string;
          slug: string;
          default_lock_duration_minutes: number;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          address_line: string;
          geog: unknown;
          lat: number | null;
          lng: number | null;
          verification_status: "pending" | "verified" | "rejected" | "suspended";
          tier: "free" | "premium";
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stores"]["Row"]> & {
          owner_id: string;
          name: string;
          address_line: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Row"]>;
        Relationships: [];
      };
      store_verification_requests: {
        Row: {
          id: string;
          store_id: string;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          status: "pending" | "approved" | "rejected";
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["store_verification_requests"]["Row"]> & {
          store_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_verification_requests"]["Row"]>;
        Relationships: [];
      };
      combos: {
        Row: {
          id: string;
          store_id: string;
          category_id: string;
          name: string;
          description: string | null;
          original_price: number;
          current_price: number;
          initial_stock: number;
          remaining_stock: number;
          best_before: string;
          delivery_supported: boolean;
          pickup_supported: boolean;
          pricing_strategy: string;
          status: "draft" | "active" | "locked" | "sold_out" | "paused";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["combos"]["Row"]> & {
          store_id: string;
          category_id: string;
          name: string;
          original_price: number;
          current_price: number;
          initial_stock: number;
          remaining_stock: number;
          best_before: string;
        };
        Update: Partial<Database["public"]["Tables"]["combos"]["Row"]>;
        Relationships: [];
      };
      combo_items: {
        Row: {
          id: string;
          combo_id: string;
          item_name: string;
          item_description: string | null;
          quantity: number;
        };
        Insert: Partial<Database["public"]["Tables"]["combo_items"]["Row"]> & {
          combo_id: string;
          item_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["combo_items"]["Row"]>;
        Relationships: [];
      };
      combo_images: {
        Row: {
          id: string;
          combo_id: string;
          url: string;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["combo_images"]["Row"]> & {
          combo_id: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["combo_images"]["Row"]>;
        Relationships: [];
      };
      price_history: {
        Row: {
          id: string;
          combo_id: string;
          price: number;
          changed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["price_history"]["Row"]> & {
          combo_id: string;
          price: number;
        };
        Update: Partial<Database["public"]["Tables"]["price_history"]["Row"]>;
        Relationships: [];
      };
      group_orders: {
        Row: {
          id: string;
          initiator_id: string;
          store_id: string;
          invite_code: string;
          deadline: string;
          status: "open" | "finalized" | "cancelled";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["group_orders"]["Row"]> & {
          initiator_id: string;
          store_id: string;
          invite_code: string;
          deadline: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_orders"]["Row"]>;
        Relationships: [];
      };
      group_order_participants: {
        Row: {
          id: string;
          group_order_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["group_order_participants"]["Row"]> & {
          group_order_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_order_participants"]["Row"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          store_id: string;
          status: "pending" | "accepted" | "rejected" | "preparing" | "ready" | "completed" | "cancelled";
          fulfillment_type: "pickup" | "delivery";
          delivery_address_id: string | null;
          subtotal: number;
          discount_amount: number;
          bulk_discount_pct: number;
          total_amount: number;
          payment_status: "unpaid" | "success" | "failed" | "refunded";
          payment_method: "vnpay" | "momo" | null;
          qr_code_token: string | null;
          group_order_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          customer_id: string;
          store_id: string;
          fulfillment_type: "pickup" | "delivery";
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          combo_id: string;
          quantity: number;
          unit_price_at_purchase: number;
          subtotal: number;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          combo_id: string;
          quantity: number;
          unit_price_at_purchase: number;
          subtotal: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: "vnpay" | "momo";
          provider_txn_id: string | null;
          amount: number;
          status: "pending" | "success" | "failed";
          raw_response: Json | null;
          ipn_received_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          order_id: string;
          provider: "vnpay" | "momo";
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      bulk_discount_tiers: {
        Row: {
          id: string;
          store_id: string | null;
          min_quantity: number;
          discount_pct: number;
        };
        Insert: Partial<Database["public"]["Tables"]["bulk_discount_tiers"]["Row"]> & {
          min_quantity: number;
          discount_pct: number;
        };
        Update: Partial<Database["public"]["Tables"]["bulk_discount_tiers"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          payload: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          type: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      search_history: {
        Row: {
          id: string;
          user_id: string;
          query_text: string;
          searched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["search_history"]["Row"]> & {
          user_id: string;
          query_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["search_history"]["Row"]>;
        Relationships: [];
      };
      user_category_affinity: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          score: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_category_affinity"]["Row"]> & {
          user_id: string;
          category_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_category_affinity"]["Row"]>;
        Relationships: [];
      };
      co2_factors: {
        Row: {
          id: string;
          category_id: string;
          kg_co2_per_combo: number;
        };
        Insert: Partial<Database["public"]["Tables"]["co2_factors"]["Row"]> & {
          category_id: string;
          kg_co2_per_combo: number;
        };
        Update: Partial<Database["public"]["Tables"]["co2_factors"]["Row"]>;
        Relationships: [];
      };
      net_zero_ledger: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          co2_saved_kg: number;
          computed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["net_zero_ledger"]["Row"]> & {
          user_id: string;
          order_id: string;
          co2_saved_kg: number;
        };
        Update: Partial<Database["public"]["Tables"]["net_zero_ledger"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      nearby_combos: {
        Args: {
          in_lat: number;
          in_lng: number;
          radius_m?: number;
          max_results?: number;
          in_category_id?: string | null;
        };
        Returns: {
          combo_id: string;
          name: string;
          current_price: number;
          original_price: number;
          best_before: string;
          store_id: string;
          store_name: string;
          distance_m: number;
          image_url: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}

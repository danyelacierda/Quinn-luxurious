export type UserRole = "customer" | "staff" | "admin";
export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "pending" | "pending_payment";
export type ServiceCategory = "Eyelash Extensions" | "Lash Lift" | "Nails";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          role?: UserRole;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      staff: {
        Row: {
          id: string;
          user_id: string | null;
          full_name: string;
          role_title: string | null;
          bio: string | null;
          photo_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          full_name: string;
          role_title?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
      };
      services: {
        Row: {
          id: string;
          category: ServiceCategory;
          name: string;
          description: string | null;
          duration_minutes: number;
          price: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: ServiceCategory;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price: number;
          is_active?: boolean;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
      };
      appointments: {
        Row: {
          id: string;
          customer_id: string | null;
          service_id: string;
          staff_id: string | null;
          appointment_date: string;
          appointment_time: string;
          status: AppointmentStatus;
          full_name: string;
          phone: string;
          email: string;
          notes: string | null;
          payment_status: string;
          payment_method: string | null;
          payment_reference: string | null;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          needs_refund?: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          service_id: string;
          staff_id?: string | null;
          appointment_date: string;
          appointment_time: string;
          status?: AppointmentStatus;
          full_name: string;
          phone: string;
          email: string;
          notes?: string | null;
          payment_status?: string;
          payment_method?: string | null;
          payment_reference?: string | null;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          needs_refund?: boolean | null;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          customer_id: string | null;
          full_name: string;
          rating: number;
          review_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          full_name: string;
          rating: number;
          review_text: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      gallery: {
        Row: {
          id: string;
          category: string;
          image_url: string;
          caption: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          image_url: string;
          caption?: string | null;
          sort_order?: number;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["gallery"]["Insert"]>;
      };
      promotions: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          discount_code: string | null;
          discount_percent: number | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          discount_code?: string | null;
          discount_percent?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["promotions"]["Insert"]>;
      };
      inventory_items: {
        Row: {
          id: string;
          name: string;
          sku: string | null;
          category: string;
          unit: string;
          current_stock: number;
          low_stock_threshold: number;
          cost_per_unit: number;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sku?: string | null;
          category?: string;
          unit?: string;
          current_stock?: number;
          low_stock_threshold?: number;
          cost_per_unit?: number;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Insert"]>;
      };
      service_inventory_recipes: {
        Row: {
          id: string;
          service_id: string;
          inventory_item_id: string;
          quantity: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          inventory_item_id: string;
          quantity: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["service_inventory_recipes"]["Insert"]>;
      };
      inventory_movements: {
        Row: {
          id: string;
          inventory_item_id: string;
          change_quantity: number;
          previous_stock: number;
          new_stock: number;
          movement_type: "restock" | "adjustment" | "service_consumption" | "waste" | "cancellation_return";
          reason: string;
          appointment_id: string | null;
          service_id: string | null;
          staff_id: string | null;
          created_by_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_item_id: string;
          change_quantity: number;
          previous_stock: number;
          new_stock: number;
          movement_type: "restock" | "adjustment" | "service_consumption" | "waste" | "cancellation_return";
          reason: string;
          appointment_id?: string | null;
          service_id?: string | null;
          staff_id?: string | null;
          created_by_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["inventory_movements"]["Insert"]>;
      };
      appointment_inventory_deductions: {
        Row: {
          id: string;
          appointment_id: string;
          service_id: string;
          staff_id: string | null;
          deducted_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          service_id: string;
          staff_id?: string | null;
          deducted_at?: string;
        };
        Relationships: [];
        Update: Partial<Database["public"]["Tables"]["appointment_inventory_deductions"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InventoryItemRow = Database["public"]["Tables"]["inventory_items"]["Row"];
export type ServiceRecipeRow = Database["public"]["Tables"]["service_inventory_recipes"]["Row"];
export type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];
export type AppointmentDeductionRow = Database["public"]["Tables"]["appointment_inventory_deductions"]["Row"];

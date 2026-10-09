export type UserRole = "customer" | "staff" | "admin";
export type AppointmentStatus = "confirmed" | "completed" | "cancelled";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

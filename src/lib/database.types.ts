// Generated from the Supabase schema (supabase gen types), trimmed to what the app uses.
// Regenerate after changing migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProjectStatus = "active" | "on_hold" | "completed";
type TaskStatus = "not_started" | "in_progress" | "done";
type VendorType = "fabric_supplier" | "printer" | "manufacturer" | "shipper" | "other";
type PricingUnit = "metre" | "piece" | "design" | "shipment" | "set" | "kg" | "flat";
type PricingDetail = "none" | "text" | "product";

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

type Meta = { id: string; user_id: string; created_at: string; updated_at: string };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      clients: Table<
        Meta & {
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          archived_at: string | null;
        },
        "name"
      >;
      projects: Table<
        Meta & {
          client_id: string;
          name: string;
          delivery_date: string;
          status: ProjectStatus;
          notes: string | null;
          consulting_fee: number | null;
          consulting_fee_currency: string;
        },
        "client_id" | "name" | "delivery_date"
      >;
      stage_templates: Table<
        Meta & { name: string; sort_order: number; default_lead_days: number },
        "name" | "sort_order" | "default_lead_days"
      >;
      tasks: Table<
        Meta & {
          project_id: string;
          stage_name: string;
          sort_order: number;
          start_date: string;
          end_date: string;
          status: TaskStatus;
          vendor_id: string | null;
          designer_id: string | null;
          notes: string | null;
        },
        "project_id" | "stage_name" | "sort_order" | "start_date" | "end_date"
      >;
      vendors: Table<
        Meta & {
          name: string;
          type: VendorType;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          location: string | null;
          specialty: string | null;
          typical_lead_days: number | null;
          minimum_order: string | null;
          payment_terms: string | null;
          rating: number | null;
          notes: string | null;
        },
        "name"
      >;
      designers: Table<
        Meta & {
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          specialty: string | null;
          typical_lead_days: number | null;
          rate: string | null;
          rating: number | null;
          notes: string | null;
          portfolio_url: string | null;
        },
        "name"
      >;
      pricing_item_types: Table<
        Meta & { name: string; default_unit: PricingUnit; detail: PricingDetail; sort_order: number },
        "name"
      >;
      pricing_products: Table<Meta & { name: string; default_unit: PricingUnit }, "name">;
      pricing_lines: Table<
        Meta & {
          project_id: string;
          item_type_id: string;
          product_id: string | null;
          detail: string | null;
          quantity: number;
          unit: PricingUnit;
          vendor_rate: number;
          client_rate: number;
          client_currency: string;
          vendor_id: string | null;
          designer_id: string | null;
        },
        "project_id" | "item_type_id" | "quantity" | "unit"
      >;
      project_fx_rates: {
        Row: { user_id: string; project_id: string; currency: string; inr_per_unit: number; manual: boolean; locked_at: string };
        Insert: { user_id?: string; project_id: string; currency: string; inr_per_unit: number; manual?: boolean; locked_at?: string };
        Update: Partial<{ project_id: string; currency: string; inr_per_unit: number; manual: boolean; locked_at: string }>;
        Relationships: [];
      };
      fx_latest: {
        Row: { user_id: string; rates: Json; source: string; fetched_at: string };
        Insert: { user_id?: string; rates: Json; source: string; fetched_at?: string };
        Update: Partial<{ rates: Json; source: string; fetched_at: string }>;
        Relationships: [];
      };
      expense_categories: Table<Meta & { name: string; is_default: boolean }, "name">;
      expenses: Table<
        Meta & {
          project_id: string;
          task_id: string | null;
          category_id: string | null;
          vendor_id: string | null;
          designer_id: string | null;
          amount: number;
          spent_on: string;
          description: string | null;
        },
        "project_id" | "amount"
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_owner_account: { Args: { p_username: string; p_password: string }; Returns: undefined };
      create_project_with_tasks: {
        Args: {
          p_client_id: string;
          p_name: string;
          p_delivery_date: string;
          p_notes: string;
          p_tasks: Json;
        };
        Returns: string;
      };
      owner_exists: { Args: never; Returns: boolean };
    };
    Enums: {
      project_status: ProjectStatus;
      task_status: TaskStatus;
      vendor_type: VendorType;
      pricing_unit: PricingUnit;
      pricing_detail: PricingDetail;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type Enum<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

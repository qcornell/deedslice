export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ds_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          company_name: string | null;
          plan: "starter" | "pro" | "enterprise";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          properties_used: number;
          properties_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          company_name?: string | null;
          plan?: "starter" | "pro" | "enterprise";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          properties_used?: number;
          properties_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          company_name?: string | null;
          plan?: "starter" | "pro" | "enterprise";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          properties_used?: number;
          properties_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ds_properties: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address: string | null;
          property_type: "residential" | "commercial" | "land" | "industrial" | "mixed";
          valuation_usd: number;
          total_slices: number;
          description: string | null;
          image_url: string | null;
          nft_token_id: string | null;
          nft_serial: number | null;
          share_token_id: string | null;
          share_token_symbol: string | null;
          audit_topic_id: string | null;
          status: "draft" | "deploying" | "live" | "failed";
          network: "testnet" | "mainnet";
          deployed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          address?: string | null;
          property_type?: "residential" | "commercial" | "land" | "industrial" | "mixed";
          valuation_usd: number;
          total_slices: number;
          description?: string | null;
          image_url?: string | null;
          nft_token_id?: string | null;
          nft_serial?: number | null;
          share_token_id?: string | null;
          share_token_symbol?: string | null;
          audit_topic_id?: string | null;
          status?: "draft" | "deploying" | "live" | "failed";
          network?: "testnet" | "mainnet";
          deployed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          address?: string | null;
          property_type?: "residential" | "commercial" | "land" | "industrial" | "mixed";
          valuation_usd?: number;
          total_slices?: number;
          description?: string | null;
          image_url?: string | null;
          nft_token_id?: string | null;
          nft_serial?: number | null;
          share_token_id?: string | null;
          share_token_symbol?: string | null;
          audit_topic_id?: string | null;
          status?: "draft" | "deploying" | "live" | "failed";
          network?: "testnet" | "mainnet";
          deployed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ds_investors: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          email: string | null;
          wallet_address: string | null;
          slices_owned: number;
          percentage: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          email?: string | null;
          wallet_address?: string | null;
          slices_owned: number;
          percentage: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          email?: string | null;
          wallet_address?: string | null;
          slices_owned?: number;
          percentage?: number;
          added_at?: string;
        };
        Relationships: [];
      };
      ds_documents: {
        Row: {
          id: string;
          property_id: string;
          uploaded_by: string;
          label: string;
          document_type: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          storage_path: string;
          sha256_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          uploaded_by: string;
          label: string;
          document_type?: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          storage_path: string;
          sha256_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          uploaded_by?: string;
          label?: string;
          document_type?: string;
          file_name?: string;
          file_size?: number;
          mime_type?: string;
          storage_path?: string;
          sha256_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ds_audit_entries: {
        Row: {
          id: string;
          property_id: string;
          action: string;
          details: string | null;
          tx_id: string | null;
          hcs_sequence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          action: string;
          details?: string | null;
          tx_id?: string | null;
          hcs_sequence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          action?: string;
          details?: string | null;
          tx_id?: string | null;
          hcs_sequence?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience types
export type Profile = Database["public"]["Tables"]["ds_profiles"]["Row"];
export type Property = Database["public"]["Tables"]["ds_properties"]["Row"];
export type Investor = Database["public"]["Tables"]["ds_investors"]["Row"];
export type AuditEntry = Database["public"]["Tables"]["ds_audit_entries"]["Row"];
export type Document = Database["public"]["Tables"]["ds_documents"]["Row"];

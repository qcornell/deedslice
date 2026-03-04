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
          transfer_status: "pending" | "transferred" | "failed" | null;
          transfer_tx_id: string | null;
          transferred_at: string | null;
          kyc_status: "unverified" | "pending" | "verified" | "rejected";
          kyc_document_path: string | null;
          kyc_reviewed_at: string | null;
          kyc_notes: string | null;
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
          transfer_status?: "pending" | "transferred" | "failed" | null;
          transfer_tx_id?: string | null;
          transferred_at?: string | null;
          kyc_status?: "unverified" | "pending" | "verified" | "rejected";
          kyc_document_path?: string | null;
          kyc_reviewed_at?: string | null;
          kyc_notes?: string | null;
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
          transfer_status?: "pending" | "transferred" | "failed" | null;
          transfer_tx_id?: string | null;
          transferred_at?: string | null;
          kyc_status?: "unverified" | "pending" | "verified" | "rejected";
          kyc_document_path?: string | null;
          kyc_reviewed_at?: string | null;
          kyc_notes?: string | null;
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
      ds_api_keys: {
        Row: {
          id: string;
          user_id: string;
          key_prefix: string;
          key_hash: string;
          name: string;
          last_used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key_prefix: string;
          key_hash: string;
          name?: string;
          last_used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key_prefix?: string;
          key_hash?: string;
          name?: string;
          last_used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ds_webhooks: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          events: string[];
          secret: string;
          active: boolean;
          last_triggered_at: string | null;
          failure_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          events?: string[];
          secret?: string;
          active?: boolean;
          last_triggered_at?: string | null;
          failure_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          events?: string[];
          secret?: string;
          active?: boolean;
          last_triggered_at?: string | null;
          failure_count?: number;
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

      ds_organizations: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          custom_domain: string | null;
          domain_verified: boolean;
          domain_verification_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          custom_domain?: string | null;
          domain_verified?: boolean;
          domain_verification_token?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ds_organizations"]["Row"]>;
        Relationships: [];
      };
      ds_org_branding: {
        Row: {
          id: string;
          org_id: string;
          logo_url: string | null;
          favicon_url: string | null;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          text_color: string;
          bg_color: string;
          email_sender_name: string | null;
          portal_title: string | null;
          footer_text: string | null;
          show_powered_by: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          text_color?: string;
          bg_color?: string;
          email_sender_name?: string | null;
          portal_title?: string | null;
          footer_text?: string | null;
          show_powered_by?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["ds_org_branding"]["Row"]>;
        Relationships: [];
      };
      ds_org_settings: {
        Row: {
          id: string;
          org_id: string;
          require_kyc_for_transfer: boolean;
          allow_investor_self_register: boolean;
          default_property_visibility: string;
          timezone: string;
          currency: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          require_kyc_for_transfer?: boolean;
          allow_investor_self_register?: boolean;
          default_property_visibility?: string;
          timezone?: string;
          currency?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ds_org_settings"]["Row"]>;
        Relationships: [];
      };
      ds_lp_accounts: {
        Row: {
          id: string;
          org_id: string;
          investor_id: string | null;
          email: string;
          password_hash: string | null;
          magic_link_token: string | null;
          magic_link_expires: string | null;
          name: string | null;
          last_login_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          investor_id?: string | null;
          email: string;
          password_hash?: string | null;
          name?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ds_lp_accounts"]["Row"]>;
        Relationships: [];
      };
      ds_distributions: {
        Row: {
          id: string;
          property_id: string;
          investor_id: string;
          amount_usd: number;
          type: string;
          period: string | null;
          status: string;
          tx_id: string | null;
          notes: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          investor_id: string;
          amount_usd: number;
          type?: string;
          period?: string | null;
          status?: string;
          tx_id?: string | null;
          notes?: string | null;
          paid_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ds_distributions"]["Row"]>;
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
export type ApiKey = Database["public"]["Tables"]["ds_api_keys"]["Row"];
export type Webhook = Database["public"]["Tables"]["ds_webhooks"]["Row"];
export type Organization = Database["public"]["Tables"]["ds_organizations"]["Row"];
export type OrgBranding = Database["public"]["Tables"]["ds_org_branding"]["Row"];
export type OrgSettings = Database["public"]["Tables"]["ds_org_settings"]["Row"];
export type LpAccount = Database["public"]["Tables"]["ds_lp_accounts"]["Row"];
export type Distribution = Database["public"]["Tables"]["ds_distributions"]["Row"];

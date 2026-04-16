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
      chat_messages: {
        Row: {
          chat_session_id: number
          content: string
          created_at: string
          id: number
          role: Database["public"]["Enums"]["chat_role"]
        }
        Insert: {
          chat_session_id: number
          content: string
          created_at?: string
          id?: number
          role: Database["public"]["Enums"]["chat_role"]
        }
        Update: {
          chat_session_id?: number
          content?: string
          created_at?: string
          id?: number
          role?: Database["public"]["Enums"]["chat_role"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_retrieval_events: {
        Row: {
          agentic_rounds: number
          chat_session_id: number
          created_at: string
          id: number
          model_used: string | null
          retrieval_mode: Database["public"]["Enums"]["retrieval_mode"]
          selected_chunk_ids: number[] | null
          total_cost_usd: number
          user_message_id: number
        }
        Insert: {
          agentic_rounds?: number
          chat_session_id: number
          created_at?: string
          id?: number
          model_used?: string | null
          retrieval_mode: Database["public"]["Enums"]["retrieval_mode"]
          selected_chunk_ids?: number[] | null
          total_cost_usd?: number
          user_message_id: number
        }
        Update: {
          agentic_rounds?: number
          chat_session_id?: number
          created_at?: string
          id?: number
          model_used?: string | null
          retrieval_mode?: Database["public"]["Enums"]["retrieval_mode"]
          selected_chunk_ids?: number[] | null
          total_cost_usd?: number
          user_message_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_retrieval_events_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_retrieval_events_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: number
          project_id: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          project_id: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          project_id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chunk_processing_events: {
        Row: {
          chunk_id: number | null
          created_at: string
          document_id: number
          error_message: string | null
          id: number
          status: Database["public"]["Enums"]["processing_event_status"]
        }
        Insert: {
          chunk_id?: number | null
          created_at?: string
          document_id: number
          error_message?: string | null
          id?: number
          status?: Database["public"]["Enums"]["processing_event_status"]
        }
        Update: {
          chunk_id?: number | null
          created_at?: string
          document_id?: number
          error_message?: string | null
          id?: number
          status?: Database["public"]["Enums"]["processing_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "chunk_processing_events_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunk_processing_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          document_id: number
          embedding: string | null
          id: number
          metadata: Json
          page_number: number | null
          status: Database["public"]["Enums"]["chunk_status"]
        }
        Insert: {
          chunk_index: number
          content: string
          document_id: number
          embedding?: string | null
          id?: number
          metadata?: Json
          page_number?: number | null
          status?: Database["public"]["Enums"]["chunk_status"]
        }
        Update: {
          chunk_index?: number
          content?: string
          document_id?: number
          embedding?: string | null
          id?: number
          metadata?: Json
          page_number?: number | null
          status?: Database["public"]["Enums"]["chunk_status"]
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          global_metadata: Json
          id: number
          mime_type: string
          name: string
          project_id: number
          source_path: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          global_metadata?: Json
          id?: number
          mime_type?: string
          name: string
          project_id: number
          source_path?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          global_metadata?: Json
          id?: number
          mime_type?: string
          name?: string
          project_id?: number
          source_path?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          id: number
          metadata: Json
          name: string
          project_id: number
          type: Database["public"]["Enums"]["entity_type"]
        }
        Insert: {
          id?: number
          metadata?: Json
          name: string
          project_id: number
          type: Database["public"]["Enums"]["entity_type"]
        }
        Update: {
          id?: number
          metadata?: Json
          name?: string
          project_id?: number
          type?: Database["public"]["Enums"]["entity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "entities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relations: {
        Row: {
          id: number
          metadata: Json
          project_id: number
          relation_type: string
          source_entity_id: number
          target_entity_id: number
        }
        Insert: {
          id?: number
          metadata?: Json
          project_id: number
          relation_type: string
          source_entity_id: number
          target_entity_id: number
        }
        Update: {
          id?: number
          metadata?: Json
          project_id?: number
          relation_type?: string
          source_entity_id?: number
          target_entity_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_relations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_api_keys: {
        Row: {
          api_key: string
          id: number
          is_default: boolean
          model_name: string
          project_id: number
          provider: Database["public"]["Enums"]["provider_type"]
        }
        Insert: {
          api_key: string
          id?: number
          is_default?: boolean
          model_name: string
          project_id: number
          provider: Database["public"]["Enums"]["provider_type"]
        }
        Update: {
          api_key?: string
          id?: number
          is_default?: boolean
          model_name?: string
          project_id?: number
          provider?: Database["public"]["Enums"]["provider_type"]
        }
        Relationships: [
          {
            foreignKeyName: "project_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rag_settings: {
        Row: {
          agentic_enabled: boolean
          agentic_max_rounds: number
          ai_smart_description: string | null
          chunk_token_size: number | null
          chunking_strategy: Database["public"]["Enums"]["chunking_strategy"]
          cost_mode: Database["public"]["Enums"]["cost_mode"]
          enable_ai_vision: boolean
          enable_entity_extraction: boolean
          enable_relation_extraction: boolean
          human_in_the_loop_enabled: boolean
          id: number
          pages_per_chunk: number | null
          project_id: number
        }
        Insert: {
          agentic_enabled?: boolean
          agentic_max_rounds?: number
          ai_smart_description?: string | null
          chunk_token_size?: number | null
          chunking_strategy?: Database["public"]["Enums"]["chunking_strategy"]
          cost_mode?: Database["public"]["Enums"]["cost_mode"]
          enable_ai_vision?: boolean
          enable_entity_extraction?: boolean
          enable_relation_extraction?: boolean
          human_in_the_loop_enabled?: boolean
          id?: number
          pages_per_chunk?: number | null
          project_id: number
        }
        Update: {
          agentic_enabled?: boolean
          agentic_max_rounds?: number
          ai_smart_description?: string | null
          chunk_token_size?: number | null
          chunking_strategy?: Database["public"]["Enums"]["chunking_strategy"]
          cost_mode?: Database["public"]["Enums"]["cost_mode"]
          enable_ai_vision?: boolean
          enable_entity_extraction?: boolean
          enable_relation_extraction?: boolean
          human_in_the_loop_enabled?: boolean
          id?: number
          pages_per_chunk?: number | null
          project_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_rag_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          conversation_memory_window: number
          created_at: string
          current_spend_usd: number
          default_system_prompt: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          owner_id: string
          spending_cap_usd: number
          updated_at: string
        }
        Insert: {
          conversation_memory_window?: number
          created_at?: string
          current_spend_usd?: number
          default_system_prompt?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          owner_id?: string
          spending_cap_usd?: number
          updated_at?: string
        }
        Update: {
          conversation_memory_window?: number
          created_at?: string
          current_spend_usd?: number
          default_system_prompt?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          owner_id?: string
          spending_cap_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
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
      get_chat_session_project_owner: {
        Args: { p_session_id: number }
        Returns: string
      }
      get_document_project_owner: {
        Args: { p_document_id: number }
        Returns: string
      }
      get_project_owner: { Args: { p_project_id: number }; Returns: string }
      match_chunks: {
        Args: {
          match_count?: number
          match_project_id: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: number
          id: number
          metadata: Json
          page_number: number
          similarity: number
        }[]
      }
    }
    Enums: {
      chat_role: "user" | "assistant" | "system"
      chunk_status: "processed" | "error"
      chunking_strategy:
        | "standard"
        | "contextual"
        | "semantic"
        | "pro_contextual"
        | "ai_smart"
        | "page_based"
      cost_mode: "basic" | "balanced" | "premium"
      document_status: "uploaded" | "processing" | "processed" | "error"
      entity_type:
        | "organization"
        | "person"
        | "product"
        | "date"
        | "concept"
        | "event"
        | "technology"
        | "location"
        | "other"
      processing_event_status: "pending" | "success" | "error" | "retried"
      provider_type: "openai" | "anthropic" | "google" | "local" | "other"
      retrieval_mode: "mix" | "relation_only" | "global" | "human_in_the_loop"
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
      chat_role: ["user", "assistant", "system"],
      chunk_status: ["processed", "error"],
      chunking_strategy: [
        "standard",
        "contextual",
        "semantic",
        "pro_contextual",
        "ai_smart",
        "page_based",
      ],
      cost_mode: ["basic", "balanced", "premium"],
      document_status: ["uploaded", "processing", "processed", "error"],
      entity_type: [
        "organization",
        "person",
        "product",
        "date",
        "concept",
        "event",
        "technology",
        "location",
        "other",
      ],
      processing_event_status: ["pending", "success", "error", "retried"],
      provider_type: ["openai", "anthropic", "google", "local", "other"],
      retrieval_mode: ["mix", "relation_only", "global", "human_in_the_loop"],
    },
  },
} as const

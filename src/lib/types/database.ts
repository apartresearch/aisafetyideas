export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          legacy_id: number | null
          priority: number
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          legacy_id?: number | null
          priority?: number
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          legacy_id?: number | null
          priority?: number
          slug?: string
          title?: string
        }
        Relationships: []
      }
      experts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          featured: boolean
          id: string
          specialty: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          featured?: boolean
          id: string
          specialty?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          specialty?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "experts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experts_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          expert_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          expert_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          expert_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_categories: {
        Row: {
          category_id: string
          idea_id: string
        }
        Insert: {
          category_id: string
          idea_id: string
        }
        Update: {
          category_id?: string
          idea_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_categories_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_relations: {
        Row: {
          child_id: string
          created_at: string
          id: string
          legacy_id: number | null
          parent_id: string
          type: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          legacy_id?: number | null
          parent_id: string
          type?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          legacy_id?: number | null
          parent_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_relations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_relations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          author_id: string | null
          auto_resolve_days: number | null
          claim: string | null
          closes_at: string | null
          contact: string | null
          created_at: string
          currency: string
          estimated_hours: number | null
          from_date: string | null
          id: string
          importance: number | null
          legacy: Json
          legacy_id: number | null
          published_at: string | null
          resolution: string | null
          source_url: string | null
          status: string
          summary_md: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          auto_resolve_days?: number | null
          claim?: string | null
          closes_at?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          estimated_hours?: number | null
          from_date?: string | null
          id?: string
          importance?: number | null
          legacy?: Json
          legacy_id?: number | null
          published_at?: string | null
          resolution?: string | null
          source_url?: string | null
          status?: string
          summary_md?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          auto_resolve_days?: number | null
          claim?: string | null
          closes_at?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          estimated_hours?: number | null
          from_date?: string | null
          id?: string
          importance?: number | null
          legacy?: Json
          legacy_id?: number | null
          published_at?: string | null
          resolution?: string | null
          source_url?: string | null
          status?: string
          summary_md?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio_md: string | null
          career_stage: string | null
          created_at: string
          display_name: string | null
          handle: string
          id: string
          is_admin: boolean
          links: Json
        }
        Insert: {
          avatar_url?: string | null
          bio_md?: string | null
          career_stage?: string | null
          created_at?: string
          display_name?: string | null
          handle: string
          id: string
          is_admin?: boolean
          links?: Json
        }
        Update: {
          avatar_url?: string | null
          bio_md?: string | null
          career_stage?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string
          id?: string
          is_admin?: boolean
          links?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


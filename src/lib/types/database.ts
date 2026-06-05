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
      answer_artifacts: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          kind: string
          label: string | null
          legacy: Json
          legacy_id: number | null
          url: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          legacy?: Json
          legacy_id?: number | null
          url: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          legacy?: Json
          legacy_id?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_artifacts_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_reviews: {
        Row: {
          action: string
          actor_id: string | null
          amount_cents: number | null
          answer_id: string
          created_at: string
          id: string
          legacy_id: number | null
          note_md: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          amount_cents?: number | null
          answer_id: string
          created_at?: string
          id?: string
          legacy_id?: number | null
          note_md?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          amount_cents?: number | null
          answer_id?: string
          created_at?: string
          id?: string
          legacy_id?: number | null
          note_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_reviews_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_reviews_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejected_at?: string | null
          admin_rejected_by?: string | null
          created_at?: string
          explanation_md?: string | null
          id?: string
          idea_id: string
          legacy?: Json
          legacy_id?: number | null
          payout_amount_cents?: number | null
          payout_currency?: string
          status?: string
          submitter_id?: string | null
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejected_at?: string | null
          admin_rejected_by?: string | null
          created_at?: string
          explanation_md?: string | null
          id?: string
          idea_id?: string
          legacy?: Json
          legacy_id?: number | null
          payout_amount_cents?: number | null
          payout_currency?: string
          status?: string
          submitter_id?: string | null
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_admin_rejected_by_fkey"
            columns: ["admin_rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      comments: {
        Row: {
          author_id: string | null
          body_md: string
          created_at: string
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          reply_to: string | null
        }
        Insert: {
          author_id?: string | null
          body_md: string
          created_at?: string
          id?: string
          idea_id: string
          legacy?: Json
          legacy_id?: number | null
          reply_to?: string | null
        }
        Update: {
          author_id?: string | null
          body_md?: string
          created_at?: string
          id?: string
          idea_id?: string
          legacy?: Json
          legacy_id?: number | null
          reply_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
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
      idea_funding: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          funder_id: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          note_md: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          funder_id?: string | null
          id?: string
          idea_id: string
          legacy?: Json
          legacy_id?: number | null
          note_md?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          funder_id?: string | null
          id?: string
          idea_id?: string
          legacy?: Json
          legacy_id?: number | null
          note_md?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_funding_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_funding_idea_id_fkey"
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
      interest: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          note_md: string | null
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          legacy?: Json
          legacy_id?: number | null
          note_md?: string | null
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          legacy?: Json
          legacy_id?: number | null
          note_md?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interest_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_profile_id_fkey"
            columns: ["profile_id"]
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
      bounty_pot: {
        Row: {
          funder_count: number | null
          idea_id: string | null
          pot_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "idea_funding_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      admin_approve_payout: {
        Args: { p_answer_id: string; p_note?: string }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reject_payout: {
        Args: { p_answer_id: string; p_note?: string }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      reject_answer: {
        Args: { p_answer_id: string; p_note?: string }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_revision_answer: {
        Args: { p_answer_id: string; p_note?: string }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resubmit_answer: {
        Args: {
          p_answer_id: string
          p_explanation_md?: string
          p_title?: string
        }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      start_review: {
        Args: { p_answer_id: string }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      verify_answer: {
        Args: {
          p_answer_id: string
          p_note?: string
          p_payout_amount_cents?: number
          p_resolution?: string
        }
        Returns: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejected_at: string | null
          admin_rejected_by: string | null
          created_at: string
          explanation_md: string | null
          id: string
          idea_id: string
          legacy: Json
          legacy_id: number | null
          payout_amount_cents: number | null
          payout_currency: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
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


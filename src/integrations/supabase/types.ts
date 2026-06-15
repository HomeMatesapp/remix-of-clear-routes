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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alternative_careers: {
        Row: {
          created_at: string
          from_role_id: string | null
          id: string
          reason: string | null
          to_role_id: string | null
        }
        Insert: {
          created_at?: string
          from_role_id?: string | null
          id?: string
          reason?: string | null
          to_role_id?: string | null
        }
        Update: {
          created_at?: string
          from_role_id?: string | null
          id?: string
          reason?: string | null
          to_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alternative_careers_from_role_id_fkey"
            columns: ["from_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_careers_to_role_id_fkey"
            columns: ["to_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      apprenticeships: {
        Row: {
          age_restrictions: string | null
          apply_url: string | null
          completion_rate: string | null
          created_at: string
          duration: string | null
          employer: string | null
          equivalent_to: string | null
          format: string | null
          fully_funded: boolean | null
          funding_notes: string | null
          honest_notes: string | null
          id: string
          key_employers: string | null
          level: number | null
          location: string | null
          roles_covered: string[] | null
          standard_name: string
          training_provider: string | null
          typical_salary: string | null
          updated_at: string
        }
        Insert: {
          age_restrictions?: string | null
          apply_url?: string | null
          completion_rate?: string | null
          created_at?: string
          duration?: string | null
          employer?: string | null
          equivalent_to?: string | null
          format?: string | null
          fully_funded?: boolean | null
          funding_notes?: string | null
          honest_notes?: string | null
          id?: string
          key_employers?: string | null
          level?: number | null
          location?: string | null
          roles_covered?: string[] | null
          standard_name: string
          training_provider?: string | null
          typical_salary?: string | null
          updated_at?: string
        }
        Update: {
          age_restrictions?: string | null
          apply_url?: string | null
          completion_rate?: string | null
          created_at?: string
          duration?: string | null
          employer?: string | null
          equivalent_to?: string | null
          format?: string | null
          fully_funded?: boolean | null
          funding_notes?: string | null
          honest_notes?: string | null
          id?: string
          key_employers?: string | null
          level?: number | null
          location?: string | null
          roles_covered?: string[] | null
          standard_name?: string
          training_provider?: string | null
          typical_salary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decision_profiles: {
        Row: {
          area: string | null
          budget_band: string | null
          commute_flexibility: string | null
          created_at: string
          highest_qualification: string | null
          id: string
          need_to_earn: string | null
          starting_point: string | null
          updated_at: string
          user_id: string
          weekly_hours: string | null
        }
        Insert: {
          area?: string | null
          budget_band?: string | null
          commute_flexibility?: string | null
          created_at?: string
          highest_qualification?: string | null
          id?: string
          need_to_earn?: string | null
          starting_point?: string | null
          updated_at?: string
          user_id: string
          weekly_hours?: string | null
        }
        Update: {
          area?: string | null
          budget_band?: string | null
          commute_flexibility?: string | null
          created_at?: string
          highest_qualification?: string | null
          id?: string
          need_to_earn?: string | null
          starting_point?: string | null
          updated_at?: string
          user_id?: string
          weekly_hours?: string | null
        }
        Relationships: []
      }
      pathway_families: {
        Row: {
          description: string | null
          id: number
          name: string
        }
        Insert: {
          description?: string | null
          id: number
          name: string
        }
        Update: {
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      provider_pathways: {
        Row: {
          created_at: string
          id: string
          pathway_type: string | null
          priority: number | null
          provider_id: string | null
          role_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pathway_type?: string | null
          priority?: number | null
          provider_id?: string | null
          role_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pathway_type?: string | null
          priority?: number | null
          provider_id?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_pathways_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_pathways_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          apply_url: string | null
          avg_graduate_salary: string | null
          category: string | null
          clear_routes_note: string | null
          cost_gbp: number | null
          cost_range: string | null
          created_at: string
          duration: string | null
          employer_acceptance: string | null
          format: string | null
          funded: string | null
          funding_type: string | null
          honest_notes: string | null
          id: string
          is_active: boolean | null
          is_skills_bootcamp: boolean | null
          job_placement_support: string | null
          last_reviewed: string | null
          lead_capture_enabled: boolean
          location: string | null
          name: string
          next_start_date: string | null
          prerequisites: string | null
          provider_org: string | null
          publishes_note: string | null
          publishes_outcomes: boolean | null
          review_status: string | null
          roles_covered: string[] | null
          tier: string | null
          updated_at: string
          website: string | null
          what_to_ask: string | null
          who_its_for: string | null
        }
        Insert: {
          apply_url?: string | null
          avg_graduate_salary?: string | null
          category?: string | null
          clear_routes_note?: string | null
          cost_gbp?: number | null
          cost_range?: string | null
          created_at?: string
          duration?: string | null
          employer_acceptance?: string | null
          format?: string | null
          funded?: string | null
          funding_type?: string | null
          honest_notes?: string | null
          id?: string
          is_active?: boolean | null
          is_skills_bootcamp?: boolean | null
          job_placement_support?: string | null
          last_reviewed?: string | null
          lead_capture_enabled?: boolean
          location?: string | null
          name: string
          next_start_date?: string | null
          prerequisites?: string | null
          provider_org?: string | null
          publishes_note?: string | null
          publishes_outcomes?: boolean | null
          review_status?: string | null
          roles_covered?: string[] | null
          tier?: string | null
          updated_at?: string
          website?: string | null
          what_to_ask?: string | null
          who_its_for?: string | null
        }
        Update: {
          apply_url?: string | null
          avg_graduate_salary?: string | null
          category?: string | null
          clear_routes_note?: string | null
          cost_gbp?: number | null
          cost_range?: string | null
          created_at?: string
          duration?: string | null
          employer_acceptance?: string | null
          format?: string | null
          funded?: string | null
          funding_type?: string | null
          honest_notes?: string | null
          id?: string
          is_active?: boolean | null
          is_skills_bootcamp?: boolean | null
          job_placement_support?: string | null
          last_reviewed?: string | null
          lead_capture_enabled?: boolean
          location?: string | null
          name?: string
          next_start_date?: string | null
          prerequisites?: string | null
          provider_org?: string | null
          publishes_note?: string | null
          publishes_outcomes?: boolean | null
          review_status?: string | null
          roles_covered?: string[] | null
          tier?: string | null
          updated_at?: string
          website?: string | null
          what_to_ask?: string | null
          who_its_for?: string | null
        }
        Relationships: []
      }
      role_views: {
        Row: {
          id: string
          role_name: string
          role_slug: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          role_name: string
          role_slug: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          role_name?: string
          role_slug?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          ai_impact_level: string | null
          ai_impact_note: string | null
          ai_safety_2040: string | null
          alternative_careers: string | null
          best_path: string | null
          career_regret_risk: string | null
          competition_level: string | null
          competition_note: string | null
          confidence_level: string | null
          created_at: string
          degree_required: string | null
          demand: string | null
          demand_source: string | null
          id: string
          job_security: string | null
          key_employers: string[] | null
          last_reviewed: string | null
          merged_into: string | null
          most_common_route: string | null
          next_review: string | null
          next_step: string | null
          next_step_url: string | null
          opportunity_cost: string | null
          pathway_adjacent: string | null
          pathway_family: number | null
          pathway_graduate: string | null
          pathway_no_background: string | null
          pathway_school_leaver: string | null
          pathway_source_text: string | null
          previous_slugs: string[]
          progression_speed: string | null
          raw_why_text: string | null
          reality_check: string | null
          reality_rating: string | null
          remote_friendly: string | null
          review_owner: string | null
          review_status: string | null
          role_name: string
          role_slug: string
          salary_entry: number | null
          salary_experienced: number | null
          salary_senior: number | null
          salary_source: string | null
          second_path: string | null
          short_description: string | null
          third_path: string | null
          top_universities: string | null
          typical_backgrounds: string | null
          typical_time_to_entry: string | null
          uncomfortable_truth: string | null
          updated_at: string
          who_not_for: string | null
        }
        Insert: {
          ai_impact_level?: string | null
          ai_impact_note?: string | null
          ai_safety_2040?: string | null
          alternative_careers?: string | null
          best_path?: string | null
          career_regret_risk?: string | null
          competition_level?: string | null
          competition_note?: string | null
          confidence_level?: string | null
          created_at?: string
          degree_required?: string | null
          demand?: string | null
          demand_source?: string | null
          id?: string
          job_security?: string | null
          key_employers?: string[] | null
          last_reviewed?: string | null
          merged_into?: string | null
          most_common_route?: string | null
          next_review?: string | null
          next_step?: string | null
          next_step_url?: string | null
          opportunity_cost?: string | null
          pathway_adjacent?: string | null
          pathway_family?: number | null
          pathway_graduate?: string | null
          pathway_no_background?: string | null
          pathway_school_leaver?: string | null
          pathway_source_text?: string | null
          previous_slugs?: string[]
          progression_speed?: string | null
          raw_why_text?: string | null
          reality_check?: string | null
          reality_rating?: string | null
          remote_friendly?: string | null
          review_owner?: string | null
          review_status?: string | null
          role_name: string
          role_slug: string
          salary_entry?: number | null
          salary_experienced?: number | null
          salary_senior?: number | null
          salary_source?: string | null
          second_path?: string | null
          short_description?: string | null
          third_path?: string | null
          top_universities?: string | null
          typical_backgrounds?: string | null
          typical_time_to_entry?: string | null
          uncomfortable_truth?: string | null
          updated_at?: string
          who_not_for?: string | null
        }
        Update: {
          ai_impact_level?: string | null
          ai_impact_note?: string | null
          ai_safety_2040?: string | null
          alternative_careers?: string | null
          best_path?: string | null
          career_regret_risk?: string | null
          competition_level?: string | null
          competition_note?: string | null
          confidence_level?: string | null
          created_at?: string
          degree_required?: string | null
          demand?: string | null
          demand_source?: string | null
          id?: string
          job_security?: string | null
          key_employers?: string[] | null
          last_reviewed?: string | null
          merged_into?: string | null
          most_common_route?: string | null
          next_review?: string | null
          next_step?: string | null
          next_step_url?: string | null
          opportunity_cost?: string | null
          pathway_adjacent?: string | null
          pathway_family?: number | null
          pathway_graduate?: string | null
          pathway_no_background?: string | null
          pathway_school_leaver?: string | null
          pathway_source_text?: string | null
          previous_slugs?: string[]
          progression_speed?: string | null
          raw_why_text?: string | null
          reality_check?: string | null
          reality_rating?: string | null
          remote_friendly?: string | null
          review_owner?: string | null
          review_status?: string | null
          role_name?: string
          role_slug?: string
          salary_entry?: number | null
          salary_experienced?: number | null
          salary_senior?: number | null
          salary_source?: string | null
          second_path?: string | null
          short_description?: string | null
          third_path?: string | null
          top_universities?: string | null
          typical_backgrounds?: string | null
          typical_time_to_entry?: string | null
          uncomfortable_truth?: string | null
          updated_at?: string
          who_not_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_pathway_family_fkey"
            columns: ["pathway_family"]
            isOneToOne: false
            referencedRelation: "pathway_families"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_decisions: {
        Row: {
          backup_route_title: string | null
          best_route_title: string | null
          created_at: string
          first_move: string | null
          id: string
          input_snapshot: Json | null
          local_realism_rating: string | null
          overall_verdict: string | null
          result_snapshot: Json | null
          role_id: string | null
          role_name: string
          role_slug: string
          route_to_avoid_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_route_title?: string | null
          best_route_title?: string | null
          created_at?: string
          first_move?: string | null
          id?: string
          input_snapshot?: Json | null
          local_realism_rating?: string | null
          overall_verdict?: string | null
          result_snapshot?: Json | null
          role_id?: string | null
          role_name: string
          role_slug: string
          route_to_avoid_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_route_title?: string | null
          best_route_title?: string | null
          created_at?: string
          first_move?: string | null
          id?: string
          input_snapshot?: Json | null
          local_realism_rating?: string | null
          overall_verdict?: string | null
          result_snapshot?: Json | null
          role_id?: string | null
          role_name?: string
          role_slug?: string
          route_to_avoid_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_decisions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_organisations: {
        Row: {
          audience: string[]
          category: string | null
          created_at: string
          description: string | null
          display_order: number | null
          eligibility: string | null
          id: string
          is_free: boolean | null
          name: string
          updated_at: string
          website: string | null
          what_they_offer: string | null
        }
        Insert: {
          audience?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          eligibility?: string | null
          id?: string
          is_free?: boolean | null
          name: string
          updated_at?: string
          website?: string | null
          what_they_offer?: string | null
        }
        Update: {
          audience?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          eligibility?: string | null
          id?: string
          is_free?: boolean | null
          name?: string
          updated_at?: string
          website?: string | null
          what_they_offer?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          age_range: string | null
          changing_careers: string | null
          consented_sensitive: boolean | null
          created_at: string
          current_industry: string | null
          degree_subject: string | null
          employment_status: string | null
          first_name: string | null
          has_criminal_record: boolean | null
          has_degree: boolean | null
          has_disability: boolean | null
          highest_qualification: string | null
          id: string
          is_care_leaver: boolean | null
          is_first_generation: boolean | null
          is_refugee: boolean | null
          is_veteran: boolean | null
          is_woman_nb: boolean | null
          personalisation_completed_at: string | null
          personalisation_last_step: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_range?: string | null
          changing_careers?: string | null
          consented_sensitive?: boolean | null
          created_at?: string
          current_industry?: string | null
          degree_subject?: string | null
          employment_status?: string | null
          first_name?: string | null
          has_criminal_record?: boolean | null
          has_degree?: boolean | null
          has_disability?: boolean | null
          highest_qualification?: string | null
          id?: string
          is_care_leaver?: boolean | null
          is_first_generation?: boolean | null
          is_refugee?: boolean | null
          is_veteran?: boolean | null
          is_woman_nb?: boolean | null
          personalisation_completed_at?: string | null
          personalisation_last_step?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_range?: string | null
          changing_careers?: string | null
          consented_sensitive?: boolean | null
          created_at?: string
          current_industry?: string | null
          degree_subject?: string | null
          employment_status?: string | null
          first_name?: string | null
          has_criminal_record?: boolean | null
          has_degree?: boolean | null
          has_disability?: boolean | null
          highest_qualification?: string | null
          id?: string
          is_care_leaver?: boolean | null
          is_first_generation?: boolean | null
          is_refugee?: boolean | null
          is_veteran?: boolean | null
          is_woman_nb?: boolean | null
          personalisation_completed_at?: string | null
          personalisation_last_step?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _is_contaminated_field: { Args: { v: string }; Returns: boolean }
      _merge_roles: {
        Args: {
          final_name: string
          final_slug: string
          losers: string[]
          survivor: string
        }
        Returns: undefined
      }
      get_contamination_fn_def: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  public: {
    Enums: {},
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string;
          division_id: string | null;
          id: string;
          league_id: string;
          season_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by: string;
          division_id?: string | null;
          id?: string;
          league_id: string;
          season_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string;
          division_id?: string | null;
          id?: string;
          league_id?: string;
          season_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_division_id_league_id_season_id_fkey";
            columns: ["division_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "announcements_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      divisions: {
        Row: {
          created_at: string;
          id: string;
          league_id: string;
          max_rating: string;
          name: string;
          roster_max: number;
          roster_min: number;
          rules: Json | null;
          season_id: string;
          sport: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          league_id: string;
          max_rating: string;
          name: string;
          roster_max?: number;
          roster_min?: number;
          rules?: Json | null;
          season_id: string;
          sport?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          league_id?: string;
          max_rating?: string;
          name?: string;
          roster_max?: number;
          roster_min?: number;
          rules?: Json | null;
          season_id?: string;
          sport?: string;
        };
        Relationships: [
          {
            foreignKeyName: "divisions_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "divisions_season_id_league_id_fkey";
            columns: ["season_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
      game_events: {
        Row: {
          clock_ms: number | null;
          created_at: string;
          created_by: string;
          game_id: string;
          id: string;
          league_id: string;
          occurred_at: string;
          payload: Json;
          period: number | null;
          sequence: number;
          type: string;
        };
        Insert: {
          clock_ms?: number | null;
          created_at?: string;
          created_by: string;
          game_id: string;
          id: string;
          league_id: string;
          occurred_at: string;
          payload: Json;
          period?: number | null;
          sequence: number;
          type: string;
        };
        Update: {
          clock_ms?: number | null;
          created_at?: string;
          created_by?: string;
          game_id?: string;
          id?: string;
          league_id?: string;
          occurred_at?: string;
          payload?: Json;
          period?: number | null;
          sequence?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_events_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_events_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_events_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      game_results: {
        Row: {
          approved_at: string;
          approved_by: string;
          away_score: number;
          game_id: string;
          home_score: number;
          last_sequence: number;
          league_id: string;
          summary: Json;
        };
        Insert: {
          approved_at?: string;
          approved_by: string;
          away_score: number;
          game_id: string;
          home_score: number;
          last_sequence: number;
          league_id: string;
          summary: Json;
        };
        Update: {
          approved_at?: string;
          approved_by?: string;
          away_score?: number;
          game_id?: string;
          home_score?: number;
          last_sequence?: number;
          league_id?: string;
          summary?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "game_results_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_results_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_results_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_results_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      game_reviews: {
        Row: {
          action: string;
          actor_id: string;
          comment: string;
          created_at: string;
          game_id: string;
          id: string;
          league_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          comment?: string;
          created_at?: string;
          game_id: string;
          id?: string;
          league_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          comment?: string;
          created_at?: string;
          game_id?: string;
          id?: string;
          league_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_reviews_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_reviews_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_reviews_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_reviews_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      game_scorer_access: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          failed_attempts: number;
          game_id: string;
          league_id: string;
          pin_hash: string;
          pin_salt: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at: string;
          failed_attempts?: number;
          game_id: string;
          league_id: string;
          pin_hash: string;
          pin_salt: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          failed_attempts?: number;
          game_id?: string;
          league_id?: string;
          pin_hash?: string;
          pin_salt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_scorer_access_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_scorer_access_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_scorer_access_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_scorer_access_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      game_scorers: {
        Row: {
          game_id: string;
          granted_at: string;
          league_id: string;
          revoked_at: string | null;
          user_id: string;
        };
        Insert: {
          game_id: string;
          granted_at?: string;
          league_id: string;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: {
          game_id?: string;
          granted_at?: string;
          league_id?: string;
          revoked_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_scorers_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_scorers_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "game_scorers_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_scorers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          away_season_team_id: string;
          created_at: string;
          created_by: string;
          division_id: string;
          home_season_team_id: string;
          id: string;
          league_id: string;
          round: number | null;
          scheduled_at: string | null;
          season_id: string;
          status: string;
          updated_at: string;
          venue: string;
        };
        Insert: {
          away_season_team_id: string;
          created_at?: string;
          created_by: string;
          division_id: string;
          home_season_team_id: string;
          id?: string;
          league_id: string;
          round?: number | null;
          scheduled_at?: string | null;
          season_id: string;
          status?: string;
          updated_at?: string;
          venue?: string;
        };
        Update: {
          away_season_team_id?: string;
          created_at?: string;
          created_by?: string;
          division_id?: string;
          home_season_team_id?: string;
          id?: string;
          league_id?: string;
          round?: number | null;
          scheduled_at?: string | null;
          season_id?: string;
          status?: string;
          updated_at?: string;
          venue?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_away_season_team_id_league_id_season_id_fkey";
            columns: ["away_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_away_season_team_id_league_id_season_id_fkey";
            columns: ["away_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_division_id_league_id_season_id_fkey";
            columns: ["division_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_home_season_team_id_league_id_season_id_fkey";
            columns: ["home_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_home_season_team_id_league_id_season_id_fkey";
            columns: ["home_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      league_members: {
        Row: {
          created_at: string;
          league_id: string;
          role: Database["public"]["Enums"]["league_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          league_id: string;
          role: Database["public"]["Enums"]["league_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          league_id?: string;
          role?: Database["public"]["Enums"]["league_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "league_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      league_rating_scales: {
        Row: {
          labels: string[];
          league_id: string;
          updated_at: string;
        };
        Insert: {
          labels?: string[];
          league_id: string;
          updated_at?: string;
        };
        Update: {
          labels?: string[];
          league_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "league_rating_scales_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: true;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      leagues: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          settings: Json;
          slug: string;
          sport: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          settings?: Json;
          slug: string;
          sport?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          settings?: Json;
          slug?: string;
          sport?: string;
        };
        Relationships: [];
      };
      player_checks: {
        Row: {
          checked_by: string | null;
          documents_present: boolean;
          league_id: string;
          player_id: string;
          suspended: boolean;
          updated_at: string;
        };
        Insert: {
          checked_by?: string | null;
          documents_present?: boolean;
          league_id: string;
          player_id: string;
          suspended?: boolean;
          updated_at?: string;
        };
        Update: {
          checked_by?: string | null;
          documents_present?: boolean;
          league_id?: string;
          player_id?: string;
          suspended?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_checks_checked_by_fkey";
            columns: ["checked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_checks_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_checks_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "league_player_catalog";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "player_checks_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
      player_ratings: {
        Row: {
          created_at: string;
          effective_from: string;
          id: string;
          league_id: string;
          player_id: string;
          rating: string;
          reason: string;
          set_by: string;
        };
        Insert: {
          created_at?: string;
          effective_from: string;
          id?: string;
          league_id: string;
          player_id: string;
          rating: string;
          reason: string;
          set_by: string;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          id?: string;
          league_id?: string;
          player_id?: string;
          rating?: string;
          reason?: string;
          set_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_ratings_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_ratings_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "league_player_catalog";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "player_ratings_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "player_ratings_set_by_fkey";
            columns: ["set_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      players: {
        Row: {
          created_at: string;
          created_by: string;
          display_name: string;
          id: string;
          league_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          display_name: string;
          id?: string;
          league_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          display_name?: string;
          id?: string;
          league_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "players_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          display_name: string;
          id: string;
          is_platform_admin: boolean;
        };
        Insert: {
          avatar_url?: string | null;
          display_name?: string;
          id: string;
          is_platform_admin?: boolean;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string;
          id?: string;
          is_platform_admin?: boolean;
        };
        Relationships: [];
      };
      registration_reviews: {
        Row: {
          action: string;
          actor_id: string;
          change_request_id: string | null;
          comment: string;
          created_at: string;
          id: string;
          league_id: string;
          registration_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          change_request_id?: string | null;
          comment?: string;
          created_at?: string;
          id?: string;
          league_id: string;
          registration_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          change_request_id?: string | null;
          comment?: string;
          created_at?: string;
          id?: string;
          league_id?: string;
          registration_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registration_reviews_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registration_reviews_change_request_id_league_id_fkey";
            columns: ["change_request_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "roster_change_requests";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "registration_reviews_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registration_reviews_registration_id_league_id_fkey";
            columns: ["registration_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "registration_reviews_registration_id_league_id_fkey";
            columns: ["registration_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
      registration_settings: {
        Row: {
          deadline: string;
          fee_halalas: number;
          is_open: boolean;
          league_id: string;
          require_documents: boolean;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          deadline: string;
          fee_halalas?: number;
          is_open?: boolean;
          league_id: string;
          require_documents?: boolean;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          deadline?: string;
          fee_halalas?: number;
          is_open?: boolean;
          league_id?: string;
          require_documents?: boolean;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registration_settings_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registration_settings_season_id_league_id_fkey";
            columns: ["season_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
      roster_change_requests: {
        Row: {
          created_at: string;
          id: string;
          league_id: string;
          reason: string;
          registration_id: string;
          requested_by: string;
          review_comment: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          roster: Json;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          league_id: string;
          reason: string;
          registration_id: string;
          requested_by: string;
          review_comment?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          roster: Json;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          league_id?: string;
          reason?: string;
          registration_id?: string;
          requested_by?: string;
          review_comment?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          roster?: Json;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roster_change_requests_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_change_requests_registration_id_league_id_fkey";
            columns: ["registration_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "roster_change_requests_registration_id_league_id_fkey";
            columns: ["registration_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "roster_change_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_change_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      roster_entries: {
        Row: {
          accepted_at: string | null;
          active: boolean;
          created_at: string;
          division_id: string;
          id: string;
          jersey_number: number;
          league_id: string;
          player_id: string;
          player_name: string | null;
          rating_snapshot: string | null;
          registration_id: string;
          season_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          active?: boolean;
          created_at?: string;
          division_id?: string;
          id?: string;
          jersey_number: number;
          league_id: string;
          player_id: string;
          player_name?: string | null;
          rating_snapshot?: string | null;
          registration_id: string;
          season_id: string;
        };
        Update: {
          accepted_at?: string | null;
          active?: boolean;
          created_at?: string;
          division_id?: string;
          id?: string;
          jersey_number?: number;
          league_id?: string;
          player_id?: string;
          player_name?: string | null;
          rating_snapshot?: string | null;
          registration_id?: string;
          season_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roster_entries_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_entries_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "league_player_catalog";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "roster_entries_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "roster_entries_registration_id_league_id_season_id_fkey";
            columns: ["registration_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "roster_entries_registration_id_league_id_season_id_fkey";
            columns: ["registration_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
        ];
      };
      season_teams: {
        Row: {
          created_at: string;
          division_id: string;
          fee_halalas: number;
          id: string;
          league_id: string;
          review_comment: string;
          reviewed_at: string | null;
          season_id: string;
          status: string;
          submitted_at: string | null;
          team_id: string;
          team_name: string;
        };
        Insert: {
          created_at?: string;
          division_id: string;
          fee_halalas: number;
          id?: string;
          league_id: string;
          review_comment?: string;
          reviewed_at?: string | null;
          season_id: string;
          status?: string;
          submitted_at?: string | null;
          team_id: string;
          team_name: string;
        };
        Update: {
          created_at?: string;
          division_id?: string;
          fee_halalas?: number;
          id?: string;
          league_id?: string;
          review_comment?: string;
          reviewed_at?: string | null;
          season_id?: string;
          status?: string;
          submitted_at?: string | null;
          team_id?: string;
          team_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_teams_division_id_league_id_season_id_fkey";
            columns: ["division_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "season_teams_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_teams_season_id_league_id_fkey";
            columns: ["season_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "season_teams_team_id_league_id_fkey";
            columns: ["team_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          created_by: string;
          end_date: string;
          id: string;
          league_id: string;
          name: string;
          rating_scale: string[];
          rules: Json;
          sport: string;
          start_date: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          end_date: string;
          id?: string;
          league_id: string;
          name: string;
          rating_scale: string[];
          rules: Json;
          sport?: string;
          start_date: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          end_date?: string;
          id?: string;
          league_id?: string;
          name?: string;
          rating_scale?: string[];
          rules?: Json;
          sport?: string;
          start_date?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasons_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      suspensions: {
        Row: {
          created_at: string;
          created_by: string;
          game_id: string;
          id: string;
          league_id: string;
          player_id: string;
          reason: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          game_id: string;
          id?: string;
          league_id: string;
          player_id: string;
          reason: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          game_id?: string;
          id?: string;
          league_id?: string;
          player_id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suspensions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suspensions_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "suspensions_game_id_league_id_fkey";
            columns: ["game_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "published_games";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "suspensions_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suspensions_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "league_player_catalog";
            referencedColumns: ["id", "league_id"];
          },
          {
            foreignKeyName: "suspensions_player_id_league_id_fkey";
            columns: ["player_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
      team_ledger: {
        Row: {
          amount_halalas: number;
          created_at: string;
          fine_reason: string | null;
          id: string;
          kind: string;
          league_id: string;
          method: string | null;
          note: string;
          paid_on: string;
          recorded_by: string;
          reverses_id: string | null;
          season_id: string;
          season_team_id: string;
        };
        Insert: {
          amount_halalas: number;
          created_at?: string;
          fine_reason?: string | null;
          id?: string;
          kind: string;
          league_id: string;
          method?: string | null;
          note?: string;
          paid_on: string;
          recorded_by: string;
          reverses_id?: string | null;
          season_id: string;
          season_team_id: string;
        };
        Update: {
          amount_halalas?: number;
          created_at?: string;
          fine_reason?: string | null;
          id?: string;
          kind?: string;
          league_id?: string;
          method?: string | null;
          note?: string;
          paid_on?: string;
          recorded_by?: string;
          reverses_id?: string | null;
          season_id?: string;
          season_team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_ledger_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ledger_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ledger_reverses_id_fkey";
            columns: ["reverses_id"];
            isOneToOne: true;
            referencedRelation: "team_ledger";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ledger_season_team_id_league_id_season_id_fkey";
            columns: ["season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "team_ledger_season_team_id_league_id_season_id_fkey";
            columns: ["season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          id: string;
          league_id: string;
          manager_id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          league_id: string;
          manager_id: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          league_id?: string;
          manager_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      league_player_catalog: {
        Row: {
          created_at: string | null;
          current_rating: string | null;
          display_name: string | null;
          id: string | null;
          league_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "players_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      published_games: {
        Row: {
          away_score: number | null;
          away_season_team_id: string | null;
          away_team_name: string | null;
          division_id: string | null;
          division_name: string | null;
          home_score: number | null;
          home_season_team_id: string | null;
          home_team_name: string | null;
          id: string | null;
          league_id: string | null;
          round: number | null;
          scheduled_at: string | null;
          season_id: string | null;
          status: string | null;
          venue: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_away_season_team_id_league_id_season_id_fkey";
            columns: ["away_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_away_season_team_id_league_id_season_id_fkey";
            columns: ["away_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_division_id_league_id_season_id_fkey";
            columns: ["division_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_home_season_team_id_league_id_season_id_fkey";
            columns: ["home_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "published_season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_home_season_team_id_league_id_season_id_fkey";
            columns: ["home_season_team_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "season_teams";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "games_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      published_season_teams: {
        Row: {
          division_id: string | null;
          division_name: string | null;
          id: string | null;
          league_id: string | null;
          season_id: string | null;
          team_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "season_teams_division_id_league_id_season_id_fkey";
            columns: ["division_id", "league_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "league_id", "season_id"];
          },
          {
            foreignKeyName: "season_teams_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_teams_season_id_league_id_fkey";
            columns: ["season_id", "league_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "league_id"];
          },
        ];
      };
    };
    Functions: {
      add_game: {
        Args: {
          p_away_season_team_id: string;
          p_division_id: string;
          p_home_season_team_id: string;
          p_league_id: string;
          p_scheduled_at: string;
          p_venue: string;
        };
        Returns: string;
      };
      add_player_rating: {
        Args: {
          p_effective_from: string;
          p_league_id: string;
          p_player_id: string;
          p_rating: string;
          p_reason: string;
        };
        Returns: string;
      };
      approve_game: {
        Args: {
          p_away_score: number;
          p_game_id: string;
          p_home_score: number;
          p_last_sequence: number;
          p_league_id: string;
          p_summary: Json;
          p_suspend_player_ids?: string[];
        };
        Returns: undefined;
      };
      check_registration_eligibility: {
        Args: {
          p_division_id: string;
          p_league_id: string;
          p_registration_id?: string;
          p_roster: Json;
          p_season_id: string;
        };
        Returns: Json;
      };
      claim_scorer_access: {
        Args: { p_game_id: string; p_pin?: string };
        Returns: string;
      };
      create_league_with_commissioner: {
        Args: {
          commissioner_email: string;
          league_name: string;
          league_slug: string;
          league_sport: string;
        };
        Returns: string;
      };
      create_registration_player: {
        Args: { p_league_id: string; p_name: string };
        Returns: string;
      };
      create_registration_team: {
        Args: { p_league_id: string; p_name: string };
        Returns: string;
      };
      create_scorer_pin: {
        Args: { p_game_id: string; p_league_id: string };
        Returns: string;
      };
      join_league_registration: {
        Args: { p_league_id: string; p_season_id: string };
        Returns: undefined;
      };
      record_game_events: {
        Args: { p_events: Json; p_game_id: string };
        Returns: number;
      };
      record_ledger_entry: {
        Args: {
          p_amount_halalas: number;
          p_fine_reason: string;
          p_kind: string;
          p_league_id: string;
          p_method: string;
          p_note: string;
          p_paid_on: string;
          p_season_team_id: string;
        };
        Returns: string;
      };
      registration_player_catalog: {
        Args: {
          p_league_id: string;
          p_registration_id?: string;
          p_season_id: string;
        };
        Returns: Json;
      };
      reopen_game: {
        Args: { p_comment: string; p_game_id: string; p_league_id: string };
        Returns: undefined;
      };
      request_roster_change: {
        Args: {
          p_league_id: string;
          p_reason: string;
          p_registration_id: string;
          p_roster: Json;
        };
        Returns: string;
      };
      reverse_ledger_entry: {
        Args: { p_entry_id: string; p_league_id: string; p_note: string };
        Returns: string;
      };
      review_roster_change: {
        Args: {
          p_approve: boolean;
          p_comment?: string;
          p_league_id: string;
          p_request_id: string;
        };
        Returns: undefined;
      };
      review_team_registration: {
        Args: {
          p_comment?: string;
          p_decision: string;
          p_league_id: string;
          p_registration_id: string;
        };
        Returns: undefined;
      };
      save_division_schedule: {
        Args: {
          p_division_id: string;
          p_games: Json;
          p_league_id: string;
          p_replace?: boolean;
        };
        Returns: number;
      };
      save_season_setup: {
        Args: { p_league_id: string; p_season_id?: string; p_setup: Json };
        Returns: string;
      };
      save_team_registration: {
        Args: {
          p_league_id: string;
          p_registration_id?: string;
          p_setup: Json;
          p_submit?: boolean;
        };
        Returns: string;
      };
      scorer_game_setup: { Args: { p_game_id: string }; Returns: Json };
      set_payment_policy: {
        Args: { p_league_id: string; p_policy: string };
        Returns: undefined;
      };
      set_player_checks: {
        Args: {
          p_documents_present: boolean;
          p_league_id: string;
          p_player_id: string;
          p_suspended: boolean;
        };
        Returns: undefined;
      };
      set_registration_settings: {
        Args: {
          p_deadline: string;
          p_fee_halalas: number;
          p_is_open: boolean;
          p_league_id: string;
          p_require_documents: boolean;
          p_season_id: string;
        };
        Returns: undefined;
      };
      submit_game: {
        Args: { p_game_id: string; p_last_sequence: number };
        Returns: undefined;
      };
      update_game: {
        Args: {
          p_game_id: string;
          p_league_id: string;
          p_scheduled_at: string;
          p_status: string;
          p_venue: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      league_role: "commissioner" | "league_staff" | "team_manager";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      league_role: ["commissioner", "league_staff", "team_manager"],
    },
  },
} as const;

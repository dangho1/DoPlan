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
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      calendar_events: {
        Row: {
          activity_name: string | null;
          child_id: string | null;
          created_at: string | null;
          end_time: string;
          event_type: string | null;
          id: string;
          location: string | null;
          notes: string | null;
          start_time: string;
          user_id: string | null;
        };
        Insert: {
          activity_name?: string | null;
          child_id?: string | null;
          created_at?: string | null;
          end_time: string;
          event_type?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          start_time: string;
          user_id?: string | null;
        };
        Update: {
          activity_name?: string | null;
          child_id?: string | null;
          created_at?: string | null;
          end_time?: string;
          event_type?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          start_time?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      children: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          date_of_birth: string | null;
          id: string;
          name: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      custody_schedules: {
        Row: {
          child_id: string;
          color: string;
          created_at: string | null;
          day_time_ranges: Json;
          days_of_week: number[];
          id: string;
          updated_at: string | null;
          user_id: string;
          week_pattern: string;
        };
        Insert: {
          child_id: string;
          color?: string;
          created_at?: string | null;
          day_time_ranges?: Json;
          days_of_week?: number[];
          id?: string;
          updated_at?: string | null;
          user_id: string;
          week_pattern?: string;
        };
        Update: {
          child_id?: string;
          color?: string;
          created_at?: string | null;
          day_time_ranges?: Json;
          days_of_week?: number[];
          id?: string;
          updated_at?: string | null;
          user_id?: string;
          week_pattern?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custody_schedules_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custody_schedules_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          child_id: string;
          created_at: string | null;
          date: string;
          description: string;
          id: string;
          payer: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          child_id: string;
          created_at?: string | null;
          date: string;
          description: string;
          id?: string;
          payer: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          child_id?: string;
          created_at?: string | null;
          date?: string;
          description?: string;
          id?: string;
          payer?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      friendships: {
        Row: {
          created_at: string | null;
          friend_id: string;
          id: string;
          status: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          friend_id: string;
          id?: string;
          status?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          friend_id?: string;
          id?: string;
          status?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
          {
            foreignKeyName: "friendships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string | null;
          created_by: string;
          id: string;
          participant_ids: string[];
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          id?: string;
          participant_ids: string[];
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          id?: string;
          participant_ids?: string[];
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          id: string;
          joined_at: string | null;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          id?: string;
          joined_at?: string | null;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          id?: string;
          joined_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string | null;
          created_at: string | null;
          id: string;
          read: boolean | null;
          receiver_id: string;
          sender_id: string;
          updated_at: string | null;
        };
        Insert: {
          content: string;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          read?: boolean | null;
          receiver_id: string;
          sender_id: string;
          updated_at?: string | null;
        };
        Update: {
          content?: string;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          read?: boolean | null;
          receiver_id?: string;
          sender_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      recurring_activities: {
        Row: {
          activity_name: string;
          activity_type: string | null;
          child_id: string;
          color: string | null;
          created_at: string | null;
          days_of_week: number[];
          end_time: string;
          id: string;
          is_active: boolean | null;
          location: string | null;
          notes: string | null;
          start_time: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          activity_name: string;
          activity_type?: string | null;
          child_id: string;
          color?: string | null;
          created_at?: string | null;
          days_of_week: number[];
          end_time: string;
          id?: string;
          is_active?: boolean | null;
          location?: string | null;
          notes?: string | null;
          start_time: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          activity_name?: string;
          activity_type?: string | null;
          child_id?: string;
          color?: string | null;
          created_at?: string | null;
          days_of_week?: number[];
          end_time?: string;
          id?: string;
          is_active?: boolean | null;
          location?: string | null;
          notes?: string | null;
          start_time?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_activities_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_activities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      user_children: {
        Row: {
          child_id: string;
          created_at: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          child_id: string;
          created_at?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          child_id?: string;
          created_at?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_children_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_children_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          age: number;
          avatar_url: string | null;
          birth_date: string;
          created_at: string | null;
          display_name: string;
          email: string;
          first_name: string;
          id: string;
          is_online: boolean | null;
          is_searchable: boolean | null;
          last_name: string;
          last_seen: string | null;
          phone_number: string | null;
          updated_at: string | null;
          user_id: string;
          username: string;
        };
        Insert: {
          age: number;
          avatar_url?: string | null;
          birth_date: string;
          created_at?: string | null;
          display_name: string;
          email: string;
          first_name: string;
          id?: string;
          is_online?: boolean | null;
          is_searchable?: boolean | null;
          last_name: string;
          last_seen?: string | null;
          phone_number?: string | null;
          updated_at?: string | null;
          user_id: string;
          username: string;
        };
        Update: {
          age?: number;
          avatar_url?: string | null;
          birth_date?: string;
          created_at?: string | null;
          display_name?: string;
          email?: string;
          first_name?: string;
          id?: string;
          is_online?: boolean | null;
          is_searchable?: boolean | null;
          last_name?: string;
          last_seen?: string | null;
          phone_number?: string | null;
          updated_at?: string | null;
          user_id?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
    };
    Views: {
      child_guardians: {
        Row: {
          child_id: string | null;
          created_at: string | null;
          guardian_name: string | null;
          user_id: string | null;
        };
        Insert: {
          child_id?: string | null;
          created_at?: string | null;
          guardian_name?: never;
          user_id?: string | null;
        };
        Update: {
          child_id?: string | null;
          created_at?: string | null;
          guardian_name?: never;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_children_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_children_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      conversation_list: {
        Row: {
          conversation_created_at: string | null;
          conversation_id: string | null;
          created_by: string | null;
          last_message: string | null;
          last_message_id: string | null;
          last_message_read: boolean | null;
          last_message_sender_id: string | null;
          last_message_time: string | null;
          participant_count: number | null;
          participant_ids: string[] | null;
          sender_avatar: string | null;
          sender_email: string | null;
          sender_name: string | null;
          title: string | null;
        };
        Relationships: [];
      };
      friendships_with_profiles: {
        Row: {
          friend_avatar_url: string | null;
          friend_display_name: string | null;
          friend_id: string | null;
          friendship_created_at: string | null;
          friendship_id: string | null;
          status: string | null;
          user_avatar_url: string | null;
          user_display_name: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
          {
            foreignKeyName: "friendships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_with_profiles";
            referencedColumns: ["auth_id"];
          },
        ];
      };
      users_with_profiles: {
        Row: {
          age: number | null;
          auth_created_at: string | null;
          auth_email: string | null;
          auth_id: string | null;
          avatar_url: string | null;
          birth_date: string | null;
          display_name: string | null;
          first_name: string | null;
          is_online: boolean | null;
          is_searchable: boolean | null;
          last_name: string | null;
          last_seen: string | null;
          phone_number: string | null;
          profile_created_at: string | null;
          profile_id: string | null;
          profile_updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_friend_request: {
        Args: { friendship_uuid: string };
        Returns: Json;
      };
      decline_friend_request: {
        Args: { friendship_uuid: string };
        Returns: Json;
      };
      delete_my_account: { Args: never; Returns: undefined };
      email_exists_for_reset: {
        Args: { input_email: string };
        Returns: boolean;
      };
      generate_unique_username: {
        Args: {
          p_display_name: string;
          p_email: string;
          p_first_name: string;
          p_last_name: string;
          p_preferred?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      create_conversation: {
        Args: {
          p_created_by: string;
          p_participant_ids: string[];
          p_title?: string;
        };
        Returns: string;
      };
      get_or_create_conversation: {
        Args: { user1_uuid: string; user2_uuid: string };
        Returns: string;
      };
      get_or_create_direct_channel: {
        Args: { user1_id: string; user2_id: string };
        Returns: string;
      };
      get_or_create_direct_conversation: {
        Args: { user1_id: string; user2_id: string };
        Returns: string;
      };
      get_user_friends: {
        Args: { current_user_id: string };
        Returns: {
          avatar_url: string;
          channel_id: string;
          display_name: string;
          email: string;
          friend_id: string;
        }[];
      };
      is_placeholder_display_name: {
        Args: { input_text: string };
        Returns: boolean;
      };
      normalize_username: { Args: { input_text: string }; Returns: string };
      search_users_by_email: {
        Args: { current_user_id: string; search_email: string };
        Returns: {
          avatar_url: string;
          display_name: string;
          email: string;
          user_id: string;
        }[];
      };
      send_friend_request: { Args: { friend_email: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

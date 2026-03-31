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
            blocked_users: {
                Row: {
                    blocked_id: string
                    blocker_id: string
                    created_at: string
                    id: string
                }
                Insert: {
                    blocked_id: string
                    blocker_id: string
                    created_at?: string
                    id?: string
                }
                Update: {
                    blocked_id?: string
                    blocker_id?: string
                    created_at?: string
                    id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "blocked_users_blocked_id_fkey"
                        columns: ["blocked_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "blocked_users_blocker_id_fkey"
                        columns: ["blocker_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            film_likes: {
                Row: {
                    created_at: string
                    film_id: string
                    id: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    film_id: string
                    id?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    film_id?: string
                    id?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "film_likes_film_id_fkey"
                        columns: ["film_id"]
                        isOneToOne: false
                        referencedRelation: "films"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "film_likes_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            film_views: {
                Row: {
                    film_id: string
                    id: string
                    viewed_at: string
                    viewer_id: string
                }
                Insert: {
                    film_id: string
                    id?: string
                    viewed_at?: string
                    viewer_id: string
                }
                Update: {
                    film_id?: string
                    id?: string
                    viewed_at?: string
                    viewer_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "film_views_film_id_fkey"
                        columns: ["film_id"]
                        isOneToOne: false
                        referencedRelation: "films"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "film_views_viewer_id_fkey"
                        columns: ["viewer_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            films: {
                Row: {
                    created_at: string
                    creator_id: string
                    id: string
                    location: string | null
                    target_user_id: string | null
                    thumbnail: string | null
                    type: string
                    uri: string
                }
                Insert: {
                    created_at?: string
                    creator_id: string
                    id?: string
                    location?: string | null
                    target_user_id?: string | null
                    thumbnail?: string | null
                    type: string
                    uri: string
                }
                Update: {
                    created_at?: string
                    creator_id?: string
                    id?: string
                    location?: string | null
                    target_user_id?: string | null
                    thumbnail?: string | null
                    type?: string
                    uri?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "films_creator_id_fkey"
                        columns: ["creator_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "films_target_user_id_fkey"
                        columns: ["target_user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            message_reactions: {
                Row: {
                    created_at: string
                    emoji: string
                    id: string
                    message_id: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    emoji: string
                    id?: string
                    message_id: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    emoji?: string
                    id?: string
                    message_id?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "message_reactions_message_id_fkey"
                        columns: ["message_id"]
                        isOneToOne: false
                        referencedRelation: "messages"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "message_reactions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            messages: {
                Row: {
                    disappeared: boolean
                    duration_sec: number | null
                    id: string
                    receiver_id: string
                    seen_at: string | null
                    sender_id: string
                    sent_at: string
                    text_content: string | null
                    type: string
                    uri: string | null
                    reaction: string | null
                }
                Insert: {
                    disappeared?: boolean
                    duration_sec?: number | null
                    id?: string
                    receiver_id: string
                    seen_at?: string | null
                    sender_id: string
                    sent_at?: string
                    text_content?: string | null
                    type: string
                    uri?: string | null
                    reaction?: string | null
                }
                Update: {
                    disappeared?: boolean
                    duration_sec?: number | null
                    id?: string
                    receiver_id?: string
                    seen_at?: string | null
                    sender_id?: string
                    sent_at?: string
                    text_content?: string | null
                    type?: string
                    uri?: string | null
                    reaction?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "messages_receiver_id_fkey"
                        columns: ["receiver_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "messages_sender_id_fkey"
                        columns: ["sender_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            partner_requests: {
                Row: {
                    created_at: string
                    id: string
                    receiver_id: string
                    sender_id: string
                    status: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    receiver_id: string
                    sender_id: string
                    status?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    receiver_id?: string
                    sender_id?: string
                    status?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "partner_requests_receiver_id_fkey"
                        columns: ["receiver_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "partner_requests_sender_id_fkey"
                        columns: ["sender_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            priorities: {
                Row: {
                    created_at: string
                    id: string
                    is_pinned: boolean
                    priority_user_id: string
                    rank: number
                    relationship: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    is_pinned?: boolean
                    priority_user_id: string
                    rank?: number
                    relationship?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    is_pinned?: boolean
                    priority_user_id?: string
                    rank?: number
                    relationship?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "priorities_priority_user_id_fkey"
                        columns: ["priority_user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "priorities_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            priority_requests: {
                Row: {
                    created_at: string
                    id: string
                    receiver_id: string
                    sender_id: string
                    sender_relationship: string | null
                    status: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    receiver_id: string
                    sender_id: string
                    sender_relationship?: string | null
                    status?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    receiver_id?: string
                    sender_id?: string
                    sender_relationship?: string | null
                    status?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "priority_requests_receiver_id_fkey"
                        columns: ["receiver_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "priority_requests_sender_id_fkey"
                        columns: ["sender_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    birthday: string | null
                    created_at: string
                    dominant_color: string | null
                    gender: string | null
                    id: string
                    name: string
                    partner_id: string | null
                    phone_number: string | null
                    profile_picture: string | null
                    relationship: string | null
                    unique_user_id: string
                    updated_at: string
                }
                Insert: {
                    birthday?: string | null
                    created_at?: string
                    dominant_color?: string | null
                    gender?: string | null
                    id: string
                    name: string
                    partner_id?: string | null
                    phone_number?: string | null
                    profile_picture?: string | null
                    relationship?: string | null
                    unique_user_id: string
                    updated_at?: string
                }
                Update: {
                    birthday?: string | null
                    created_at?: string
                    dominant_color?: string | null
                    gender?: string | null
                    id?: string
                    name?: string
                    partner_id?: string | null
                    phone_number?: string | null
                    profile_picture?: string | null
                    relationship?: string | null
                    unique_user_id?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_partner_id_fkey"
                        columns: ["partner_id"]
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
            accept_priority_request:
            | {
                Args: {
                    p_receiver_id: string
                    p_request_id: string
                    p_sender_id: string
                }
                Returns: undefined
            }
            | {
                Args: {
                    p_receiver_id: string
                    p_receiver_relationship?: string
                    p_request_id: string
                    p_sender_id: string
                }
                Returns: undefined
            }
            block_user: {
                Args: { p_blocked_id: string; p_blocker_id: string }
                Returns: undefined
            }
            get_my_priority_user_ids: {
                Args: { viewer_id: string }
                Returns: string[]
            }
            remove_priority: {
                Args: { p_priority_user_id: string; p_user_id: string }
                Returns: undefined
            }
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
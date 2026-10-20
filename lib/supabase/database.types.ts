
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "barber_hours": {
                  Row: {
                    "barber_id": string,"ends_at": string | null,"is_open": boolean,"starts_at": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"ends_at"?: string | null,"is_open": boolean,"starts_at"?: string | null,"weekday": number
                  }
                  Update: {
                    "barber_id"?: string,"ends_at"?: string | null,"is_open"?: boolean,"starts_at"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "barber_hours_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barber_hours_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    }
                  ]
                },"barber_invites": {
                  Row: {
                    "accepted_at": string | null,"barber_id": string,"created_at": string,"expires_at": string,"id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"barber_id": string,"created_at"?: string,"expires_at": string,"id"?: string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"barber_id"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "barber_invites_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barber_invites_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    }
                  ]
                },"barber_services": {
                  Row: {
                    "barber_id": string,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"service_id": string
                  }
                  Update: {
                    "barber_id"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "barber_services_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barber_services_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barber_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"barbers": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"id": string,"profile_id": string | null,"sort_order": number,"status": Database["public"]['Enums']["barber_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"id"?: string,"profile_id"?: string | null,"sort_order"?: number,"status"?: Database["public"]['Enums']["barber_status"]
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"profile_id"?: string | null,"sort_order"?: number,"status"?: Database["public"]['Enums']["barber_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_changes": {
                  Row: {
                    "booking_id": string,"changed_at": string,"id": string,"new_ends_at": string,"new_starts_at": string,"old_ends_at": string,"old_starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"changed_at"?: string,"id"?: string,"new_ends_at": string,"new_starts_at": string,"old_ends_at": string,"old_starts_at": string
                  }
                  Update: {
                    "booking_id"?: string,"changed_at"?: string,"id"?: string,"new_ends_at"?: string,"new_starts_at"?: string,"old_ends_at"?: string,"old_starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_changes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "barber_schedule"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_changes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "any_barber": boolean,"barber_id": string,"buffer_minutes": number,"busy_until": string,"cancelled_at": string | null,"cancelled_by": Database["public"]['Enums']["cancelled_by"] | null,"created_at": string,"customer_email": string,"customer_id": string | null,"customer_name": string,"duration_minutes": number,"ends_at": string,"guest_token_hash": string | null,"hold_expires_at": string | null,"id": string,"outcome_recorded_at": string | null,"outcome_recorded_by": string | null,"price_kobo": number,"reference": string,"refund_due": boolean | null,"service_id": string,"service_name": string,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "any_barber"?: boolean,"barber_id": string,"buffer_minutes"?: number,"busy_until": string,"cancelled_at"?: string | null,"cancelled_by"?: Database["public"]['Enums']["cancelled_by"] | null,"created_at"?: string,"customer_email": string,"customer_id"?: string | null,"customer_name": string,"duration_minutes": number,"ends_at": string,"guest_token_hash"?: string | null,"hold_expires_at"?: string | null,"id"?: string,"outcome_recorded_at"?: string | null,"outcome_recorded_by"?: string | null,"price_kobo": number,"reference"?: string,"refund_due"?: boolean | null,"service_id": string,"service_name": string,"starts_at": string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "any_barber"?: boolean,"barber_id"?: string,"buffer_minutes"?: number,"busy_until"?: string,"cancelled_at"?: string | null,"cancelled_by"?: Database["public"]['Enums']["cancelled_by"] | null,"created_at"?: string,"customer_email"?: string,"customer_id"?: string | null,"customer_name"?: string,"duration_minutes"?: number,"ends_at"?: string,"guest_token_hash"?: string | null,"hold_expires_at"?: string | null,"id"?: string,"outcome_recorded_at"?: string | null,"outcome_recorded_by"?: string | null,"price_kobo"?: number,"reference"?: string,"refund_due"?: boolean | null,"service_id"?: string,"service_name"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_outcome_recorded_by_fkey"
      columns: ["outcome_recorded_by"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_outcome_recorded_by_fkey"
      columns: ["outcome_recorded_by"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"name"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"opening_hours": {
                  Row: {
                    "closes_at": string | null,"is_open": boolean,"opens_at": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closes_at"?: string | null,"is_open": boolean,"opens_at"?: string | null,"weekday": number
                  }
                  Update: {
                    "closes_at"?: string | null,"is_open"?: boolean,"opens_at"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_kobo": number,"booking_id": string,"created_at": string,"id": string,"paid_at": string | null,"provider": string,"raw": Json | null,"reference": string,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_kobo": number,"booking_id": string,"created_at"?: string,"id"?: string,"paid_at"?: string | null,"provider"?: string,"raw"?: Json | null,"reference": string,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount_kobo"?: number,"booking_id"?: string,"created_at"?: string,"id"?: string,"paid_at"?: string | null,"provider"?: string,"raw"?: Json | null,"reference"?: string,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "barber_schedule"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name": string,"id": string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount_kobo": number,"created_at": string,"id": string,"payment_id": string,"processed_at": string | null,"provider_refund_id": string | null,"status": Database["public"]['Enums']["refund_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_kobo": number,"created_at"?: string,"id"?: string,"payment_id": string,"processed_at"?: string | null,"provider_refund_id"?: string | null,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Update: {
                    "amount_kobo"?: number,"created_at"?: string,"id"?: string,"payment_id"?: string,"processed_at"?: string | null,"provider_refund_id"?: string | null,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "buffer_minutes": number,"created_at": string,"description": string,"duration_minutes": number,"id": string,"is_active": boolean,"name": string,"price_kobo": number,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buffer_minutes"?: number,"created_at"?: string,"description"?: string,"duration_minutes": number,"id"?: string,"is_active"?: boolean,"name": string,"price_kobo": number,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "buffer_minutes"?: number,"created_at"?: string,"description"?: string,"duration_minutes"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"price_kobo"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shop_settings": {
                  Row: {
                    "address": string,"hold_minutes": number,"id": boolean,"name": string,"no_show_grace_minutes": number,"refund_window_hours": number,"time_zone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"hold_minutes"?: number,"id"?: boolean,"name": string,"no_show_grace_minutes"?: number,"refund_window_hours"?: number,"time_zone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"hold_minutes"?: number,"id"?: boolean,"name"?: string,"no_show_grace_minutes"?: number,"refund_window_hours"?: number,"time_zone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"time_blocks": {
                  Row: {
                    "barber_id": string,"created_at": string,"ends_at": string,"id": string,"is_whole_day": boolean,"reason": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barber_id": string,"created_at"?: string,"ends_at": string,"id"?: string,"is_whole_day"?: boolean,"reason"?: string | null,"starts_at": string
                  }
                  Update: {
                    "barber_id"?: string,"created_at"?: string,"ends_at"?: string,"id"?: string,"is_whole_day"?: boolean,"reason"?: string | null,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_blocks_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_blocks_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "barber_schedule": {
                  Row: {
                    "barber_id": string | null,"customer_name": string | null,"duration_minutes": number | null,"ends_at": string | null,"id": string | null,"outcome_recorded_at": string | null,"service_name": string | null,"starts_at": string | null,"status": Database["public"]['Enums']["booking_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                           "barber_id"?: string | null,"customer_name"?: string | null,"duration_minutes"?: number | null,"ends_at"?: string | null,"id"?: string | null,"outcome_recorded_at"?: string | null,"service_name"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["booking_status"] | null
                         }
                        Update: {
                           "barber_id"?: string | null,"customer_name"?: string | null,"duration_minutes"?: number | null,"ends_at"?: string | null,"id"?: string | null,"outcome_recorded_at"?: string | null,"service_name"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["booking_status"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "bookings_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_barber_id_fkey"
      columns: ["barber_id"]
isOneToOne: false
      referencedRelation: "public_barbers"
      referencedColumns: ["id"]
    }
                  ]
                },"public_barbers": {
                  Row: {
                    "full_name": string | null,"id": string | null,"sort_order": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "full_name"?: string | null,"id"?: string | null,"sort_order"?: number | null
                         }
                        Update: {
                           "full_name"?: string | null,"id"?: string | null,"sort_order"?: number | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "current_barber_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"generate_booking_reference":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"owner_cancel_booking":
{ Args: { "p_booking_id": string }; Returns: {
              "amount_kobo": number,
"created_at": string,
"id": string,
"payment_id": string,
"processed_at": string | null,
"provider_refund_id": string | null,
"status": Database["public"]['Enums']["refund_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "refunds"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "barber_status": "invited"|"active"|"inactive","booking_status": "pending_payment"|"expired"|"confirmed"|"completed"|"no_show"|"cancelled","cancelled_by": "customer"|"owner","payment_status": "pending"|"success"|"failed"|"abandoned","refund_status": "pending"|"processed"|"failed","user_role": "customer"|"barber"|"owner"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "barber_status": ["invited", "active", "inactive"],"booking_status": ["pending_payment", "expired", "confirmed", "completed", "no_show", "cancelled"],"cancelled_by": ["customer", "owner"],"payment_status": ["pending", "success", "failed", "abandoned"],"refund_status": ["pending", "processed", "failed"],"user_role": ["customer", "barber", "owner"]
          }
        }
} as const

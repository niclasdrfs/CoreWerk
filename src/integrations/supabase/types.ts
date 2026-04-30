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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assignment_materials: {
        Row: {
          created_at: string
          daily_assignment_id: string
          id: string
          material_id: string
          quantity: number | null
        }
        Insert: {
          created_at?: string
          daily_assignment_id: string
          id?: string
          material_id: string
          quantity?: number | null
        }
        Update: {
          created_at?: string
          daily_assignment_id?: string
          id?: string
          material_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_materials_daily_assignment_id_fkey"
            columns: ["daily_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_packing_list: {
        Row: {
          created_at: string | null
          daily_assignment_id: string
          employee_id: string | null
          id: string
          is_checked: boolean | null
          text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_assignment_id: string
          employee_id?: string | null
          id?: string
          is_checked?: boolean | null
          text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_assignment_id?: string
          employee_id?: string | null
          id?: string
          is_checked?: boolean | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_packing_list_daily_assignment_id_fkey"
            columns: ["daily_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_categories: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          default_margin_multiplier: number
          id: string
          name: string
          slug: string
          source: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          default_margin_multiplier?: number
          id?: string
          name: string
          slug: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          default_margin_multiplier?: number
          id?: string
          name?: string
          slug?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_folder_margins: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          folder_path: string
          id: string
          margin_multiplier: number
          updated_at: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          folder_path: string
          id?: string
          margin_multiplier?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          folder_path?: string
          id?: string
          margin_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_folder_margins_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "calculator_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_folder_margins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_presets: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          products: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          products?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          products?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_presets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_product_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          price?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "calculator_products"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_products: {
        Row: {
          article_number: string | null
          base_quantity: number
          category_id: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          margin_multiplier: number | null
          name: string
          supplier: string | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          article_number?: string | null
          base_quantity?: number
          category_id: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          margin_multiplier?: number | null
          name: string
          supplier?: string | null
          unit_type?: string
          updated_at?: string
        }
        Update: {
          article_number?: string | null
          base_quantity?: number
          category_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          margin_multiplier?: number | null
          name?: string
          supplier?: string | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "calculator_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculator_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      category_parameters: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          display_order: number
          id: string
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_parameters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "construction_site_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          chat_group_id: string | null
          company_id: string
          construction_site_id: string | null
          content: string | null
          created_at: string
          id: string
          image_path: string | null
          sender_id: string
        }
        Insert: {
          chat_group_id?: string | null
          company_id: string
          construction_site_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          sender_id: string
        }
        Update: {
          chat_group_id?: string | null
          company_id?: string
          construction_site_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_group_id_fkey"
            columns: ["chat_group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          subdomain: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          subdomain?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          subdomain?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      construction_site_categories: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_site_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_site_parameters: {
        Row: {
          construction_site_id: string
          created_at: string
          id: string
          is_outlier: boolean
          parameter_id: string
          updated_at: string
          value: number
        }
        Insert: {
          construction_site_id: string
          created_at?: string
          id?: string
          is_outlier?: boolean
          parameter_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          construction_site_id?: string
          created_at?: string
          id?: string
          is_outlier?: boolean
          parameter_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "construction_site_parameters_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_parameters_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "category_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_site_products: {
        Row: {
          calculator_product_id: string | null
          company_id: string
          construction_site_id: string
          created_at: string
          ek_price: number
          id: string
          name: string
          notes: string | null
          phase: string
          quantity: number
          unit_type: string
          updated_at: string
          vk_price: number
        }
        Insert: {
          calculator_product_id?: string | null
          company_id: string
          construction_site_id: string
          created_at?: string
          ek_price?: number
          id?: string
          name: string
          notes?: string | null
          phase?: string
          quantity?: number
          unit_type?: string
          updated_at?: string
          vk_price?: number
        }
        Update: {
          calculator_product_id?: string | null
          company_id?: string
          construction_site_id?: string
          created_at?: string
          ek_price?: number
          id?: string
          name?: string
          notes?: string | null
          phase?: string
          quantity?: number
          unit_type?: string
          updated_at?: string
          vk_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "construction_site_products_calculator_product_id_fkey"
            columns: ["calculator_product_id"]
            isOneToOne: false
            referencedRelation: "calculator_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_products_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_site_timeline_stages: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_completed: boolean | null
          name: string
          timeline_id: string
          visible_to_manager: boolean
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_completed?: boolean | null
          name: string
          timeline_id: string
          visible_to_manager?: boolean
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_completed?: boolean | null
          name?: string
          timeline_id?: string
          visible_to_manager?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "construction_site_timeline_stages_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_timeline_stages_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_timeline_stages_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "construction_site_timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_site_timelines: {
        Row: {
          construction_site_id: string
          created_at: string
          current_stage_index: number | null
          id: string
          is_custom: boolean | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          construction_site_id: string
          created_at?: string
          current_stage_index?: number | null
          id?: string
          is_custom?: boolean | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          construction_site_id?: string
          created_at?: string
          current_stage_index?: number | null
          id?: string
          is_custom?: boolean | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_site_timelines_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: true
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_site_timelines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "timeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_sites: {
        Row: {
          address: string | null
          category_id: string | null
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_last_name: string
          customer_phone: string | null
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_last_name: string
          customer_phone?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_last_name?: string
          customer_phone?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_sites_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "construction_site_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          address_line_2: string | null
          avatar_url: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_number: string | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_assignments: {
        Row: {
          assignment_date: string
          company_id: string
          construction_site_id: string
          created_at: string
          end_time: string | null
          id: string
          installation_manager_id: string
          notes: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          assignment_date: string
          company_id: string
          construction_site_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          installation_manager_id: string
          notes?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          assignment_date?: string
          company_id?: string
          construction_site_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          installation_manager_id?: string
          notes?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_assignments_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_assignments_installation_manager_id_fkey"
            columns: ["installation_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_assignments_installation_manager_id_fkey"
            columns: ["installation_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_assignments: {
        Row: {
          created_at: string
          daily_assignment_id: string
          employee_id: string
          id: string
        }
        Insert: {
          created_at?: string
          daily_assignment_id: string
          employee_id: string
          id?: string
        }
        Update: {
          created_at?: string
          daily_assignment_id?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_assignments_daily_assignment_id_fkey"
            columns: ["daily_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_custom_todos: {
        Row: {
          completed_at: string | null
          created_at: string | null
          daily_assignment_id: string
          employee_id: string | null
          id: string
          is_completed: boolean | null
          text: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          daily_assignment_id: string
          employee_id?: string | null
          id?: string
          is_completed?: boolean | null
          text: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          daily_assignment_id?: string
          employee_id?: string | null
          id?: string
          is_completed?: boolean | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_todos_daily_assignment_id_fkey"
            columns: ["daily_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_custom_todos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_custom_todos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_material_todos: {
        Row: {
          assignment_material_id: string
          completed_at: string | null
          created_at: string | null
          daily_assignment_id: string
          employee_id: string
          id: string
          is_completed: boolean | null
          notes: string | null
          quantity: number | null
          updated_at: string | null
        }
        Insert: {
          assignment_material_id: string
          completed_at?: string | null
          created_at?: string | null
          daily_assignment_id: string
          employee_id: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          assignment_material_id?: string
          completed_at?: string | null
          created_at?: string | null
          daily_assignment_id?: string
          employee_id?: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_employee_material_todos_assignment_material"
            columns: ["assignment_material_id"]
            isOneToOne: false
            referencedRelation: "assignment_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_material_todos_daily_assignment"
            columns: ["daily_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_material_todos_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee_material_todos_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_status: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          status: Database["public"]["Enums"]["employee_status_type"]
          status_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          status?: Database["public"]["Enums"]["employee_status_type"]
          status_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          status?: Database["public"]["Enums"]["employee_status_type"]
          status_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_status_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_limited: boolean | null
          name: string
          requires_quantity: boolean | null
          sort_numeric: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_limited?: boolean | null
          name: string
          requires_quantity?: boolean | null
          sort_numeric?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_limited?: boolean | null
          name?: string
          requires_quantity?: boolean | null
          sort_numeric?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      material_subfolders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_category: string
          parent_subfolder_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_category: string
          parent_subfolder_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_category?: string
          parent_subfolder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_subfolders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_subfolders_parent_subfolder_id_fkey"
            columns: ["parent_subfolder_id"]
            isOneToOne: false
            referencedRelation: "material_subfolders"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_limited: boolean
          name: string
          subfolder_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_limited?: boolean
          name: string
          subfolder_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_limited?: boolean
          name?: string
          subfolder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_subfolder_id_fkey"
            columns: ["subfolder_id"]
            isOneToOne: false
            referencedRelation: "material_subfolders"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_custom_pages: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_custom_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_custom_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_custom_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_block_articles: {
        Row: {
          block_id: string
          calculator_product_id: string
          company_id: string
          created_at: string
          id: string
          markup_percent: number
        }
        Insert: {
          block_id: string
          calculator_product_id: string
          company_id: string
          created_at?: string
          id?: string
          markup_percent?: number
        }
        Update: {
          block_id?: string
          calculator_product_id?: string
          company_id?: string
          created_at?: string
          id?: string
          markup_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_block_articles_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "product_configurator_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_block_articles_calculator_product_id_fkey"
            columns: ["calculator_product_id"]
            isOneToOne: false
            referencedRelation: "calculator_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_block_articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_blocks: {
        Row: {
          block_type: string
          category_id: string
          company_id: string
          config: Json
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          block_type: string
          category_id: string
          company_id: string
          config?: Json
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          category_id?: string
          company_id?: string
          config?: Json
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_blocks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_configurator_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_categories: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          display_order: number
          id: string
          material_ek: number
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number
          id?: string
          material_ek?: number
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number
          id?: string
          material_ek?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_dependencies: {
        Row: {
          company_id: string
          condition_type: string
          condition_value: string
          created_at: string
          effect_type: string
          effect_value: string | null
          id: string
          source_block_id: string
          target_block_id: string
        }
        Insert: {
          company_id: string
          condition_type: string
          condition_value: string
          created_at?: string
          effect_type: string
          effect_value?: string | null
          id?: string
          source_block_id: string
          target_block_id: string
        }
        Update: {
          company_id?: string
          condition_type?: string
          condition_value?: string
          created_at?: string
          effect_type?: string
          effect_value?: string | null
          id?: string
          source_block_id?: string
          target_block_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_dependencies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_dependencies_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "product_configurator_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_dependencies_target_block_id_fkey"
            columns: ["target_block_id"]
            isOneToOne: false
            referencedRelation: "product_configurator_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurator_sub_items: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          display_order: number
          id: string
          meters: number
          name: string
          price_per_meter: number
          updated_at: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          meters?: number
          name: string
          price_per_meter?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          meters?: number
          name?: string
          price_per_meter?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_configurator_sub_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_configurator_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_configurator_sub_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          calculated_hourly_wage: number | null
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          hourly_wage: number | null
          id: string
          phone_number: string | null
          updated_at: string
          vacation_days: number | null
        }
        Insert: {
          birth_date?: string | null
          calculated_hourly_wage?: number | null
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          hourly_wage?: number | null
          id: string
          phone_number?: string | null
          updated_at?: string
          vacation_days?: number | null
        }
        Update: {
          birth_date?: string | null
          calculated_hourly_wage?: number | null
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          hourly_wage?: number | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          vacation_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_quotes: {
        Row: {
          company_id: string
          construction_site_id: string | null
          created_at: string
          created_by: string
          id: string
          products: Json
          title: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          construction_site_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          products?: Json
          title?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          construction_site_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          products?: Json
          title?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      site_correspondence: {
        Row: {
          company_id: string
          construction_site_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          construction_site_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          construction_site_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_correspondence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_correspondence_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_customer_notes: {
        Row: {
          company_id: string
          construction_site_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          construction_site_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          construction_site_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_customer_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_customer_notes_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_documents: {
        Row: {
          category: string
          company_id: string
          construction_site_id: string
          created_at: string
          created_by: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          title: string | null
        }
        Insert: {
          category: string
          company_id: string
          construction_site_id: string
          created_at?: string
          created_by: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          construction_site_id?: string
          created_at?: string
          created_by?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_documents_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_documentation: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          stage_id: string
          title: string | null
          type: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          stage_id: string
          title?: string | null
          type: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          stage_id?: string
          title?: string | null
          type?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_documentation_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "construction_site_timeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_documentation_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_documentation_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_employee_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assignment_date: string | null
          daily_assignment_id: string | null
          employee_id: string
          id: string
          notes: string | null
          stage_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assignment_date?: string | null
          daily_assignment_id?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          stage_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assignment_date?: string | null
          daily_assignment_id?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_employee_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_employee_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_employee_assignments_daily_assignment_id_fkey"
            columns: ["daily_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_employee_assignments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "construction_site_timeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_out: string | null
          company_id: string
          construction_site_id: string | null
          created_at: string
          id: string
          leistung: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          company_id: string
          construction_site_id?: string | null
          created_at?: string
          id?: string
          leistung?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          company_id?: string
          construction_site_id?: string | null
          created_at?: string
          id?: string
          leistung?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_template_stage_packing_items: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          stage_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          stage_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          stage_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_template_stage_packing_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "timeline_template_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_template_stage_todos: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          stage_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          stage_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          stage_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_template_stage_todos_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "timeline_template_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_template_stages: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          template_id: string
          visible_to_manager: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          template_id: string
          visible_to_manager?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          template_id?: string
          visible_to_manager?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "timeline_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "timeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_templates: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "construction_site_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_limited: {
        Row: {
          company_id: string | null
          email: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_employee_assigned_to_daily_assignment: {
        Args: { _daily_assignment_id: string; _employee_id: string }
        Returns: boolean
      }
      is_ober_montageleiter: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "accounting"
        | "owner"
        | "installation_manager"
        | "employee"
        | "ober_montageleiter"
      customer_type: "new" | "existing" | "premium"
      employee_status_type: "available" | "sick" | "vacation"
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
      app_role: [
        "super_admin",
        "accounting",
        "owner",
        "installation_manager",
        "employee",
        "ober_montageleiter",
      ],
      customer_type: ["new", "existing", "premium"],
      employee_status_type: ["available", "sick", "vacation"],
    },
  },
} as const

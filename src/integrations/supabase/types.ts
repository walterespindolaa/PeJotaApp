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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_invite_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          metadata: Json | null
          source: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          metadata?: Json | null
          source: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          source?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_recados: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          expires_at: string | null
          id: string
          send_email: boolean
          target_plan: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          send_email?: boolean
          target_plan?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          send_email?: boolean
          target_plan?: string
          title?: string
        }
        Relationships: []
      }
      advisor_coupons: {
        Row: {
          active: boolean
          advisor_name: string
          code: string
          commission_pct: number
          created_at: string
          created_by: string | null
          duration_months: number | null
          id: string
          percent_off: number
          stripe_coupon_id: string
          stripe_promotion_code_id: string
        }
        Insert: {
          active?: boolean
          advisor_name: string
          code: string
          commission_pct?: number
          created_at?: string
          created_by?: string | null
          duration_months?: number | null
          id?: string
          percent_off: number
          stripe_coupon_id: string
          stripe_promotion_code_id: string
        }
        Update: {
          active?: boolean
          advisor_name?: string
          code?: string
          commission_pct?: number
          created_at?: string
          created_by?: string | null
          duration_months?: number | null
          id?: string
          percent_off?: number
          stripe_coupon_id?: string
          stripe_promotion_code_id?: string
        }
        Relationships: []
      }
      advisor_referrals: {
        Row: {
          advisor_coupon_id: string
          created_at: string
          id: string
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          advisor_coupon_id: string
          created_at?: string
          id?: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          advisor_coupon_id?: string
          created_at?: string
          id?: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_referrals_advisor_coupon_id_fkey"
            columns: ["advisor_coupon_id"]
            isOneToOne: false
            referencedRelation: "advisor_commission_report"
            referencedColumns: ["advisor_coupon_id"]
          },
          {
            foreignKeyName: "advisor_referrals_advisor_coupon_id_fkey"
            columns: ["advisor_coupon_id"]
            isOneToOne: false
            referencedRelation: "advisor_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      advisory_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          objetivo: string
          observacoes: string | null
          patrimonio: string
          score: number
          status: string
          telefone: string | null
          tempo_investindo: string
          teve_assessor: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          objetivo?: string
          observacoes?: string | null
          patrimonio?: string
          score?: number
          status?: string
          telefone?: string | null
          tempo_investindo?: string
          teve_assessor?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          objetivo?: string
          observacoes?: string | null
          patrimonio?: string
          score?: number
          status?: string
          telefone?: string | null
          tempo_investindo?: string
          teve_assessor?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_inference_cache: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          result_json: Json
          statement_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          result_json?: Json
          statement_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          result_json?: Json
          statement_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_quota_limits: {
        Row: {
          created_at: string | null
          feature: string
          id: string
          max_usage: number
          period: string
          plan_tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          feature: string
          id?: string
          max_usage: number
          period: string
          plan_tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          feature?: string
          id?: string
          max_usage?: number
          period?: string
          plan_tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          daily_limit: number
          id: string
          questions_used: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          daily_limit?: number
          id?: string
          questions_used?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          daily_limit?: number
          id?: string
          questions_used?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_counter: {
        Row: {
          feature: string
          id: string
          last_incremented_at: string | null
          period_start: string
          usage_count: number
          user_id: string
        }
        Insert: {
          feature: string
          id?: string
          last_incremented_at?: string | null
          period_start: string
          usage_count?: number
          user_id: string
        }
        Update: {
          feature?: string
          id?: string
          last_incremented_at?: string | null
          period_start?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      allocation_rules: {
        Row: {
          active: boolean
          base: string
          category_ids: string[] | null
          company_id: string
          created_at: string
          id: string
          name: string
          percentage: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          base?: string
          category_ids?: string[] | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          percentage?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          base?: string
          category_ids?: string[] | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          percentage?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      aportes_investimentos: {
        Row: {
          created_at: string
          data: string
          id: string
          investimento_id: string
          observacao: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          investimento_id: string
          observacao?: string | null
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          investimento_id?: string
          observacao?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      aportes_objetivos: {
        Row: {
          created_at: string
          data: string
          id: string
          objetivo_id: string
          observacao: string | null
          responsavel: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          objetivo_id: string
          observacao?: string | null
          responsavel?: string
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          objetivo_id?: string
          observacao?: string | null
          responsavel?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "aportes_objetivos_objetivo_id_fkey"
            columns: ["objetivo_id"]
            isOneToOne: false
            referencedRelation: "objetivos"
            referencedColumns: ["id"]
          },
        ]
      }
      aposentadoria: {
        Row: {
          created_at: string
          expectativa_vida: number | null
          id: string
          idade_aposentadoria: number | null
          idade_atual: number | null
          incluir_bens: boolean
          incluir_objetivos: boolean
          inflacao: number | null
          patrimonio_atual: number | null
          pessoa: string
          poupanca_mensal: number | null
          renda_desejada: number | null
          renda_passiva_atual: number | null
          taxa_nominal: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expectativa_vida?: number | null
          id?: string
          idade_aposentadoria?: number | null
          idade_atual?: number | null
          incluir_bens?: boolean
          incluir_objetivos?: boolean
          inflacao?: number | null
          patrimonio_atual?: number | null
          pessoa?: string
          poupanca_mensal?: number | null
          renda_desejada?: number | null
          renda_passiva_atual?: number | null
          taxa_nominal?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expectativa_vida?: number | null
          id?: string
          idade_aposentadoria?: number | null
          idade_atual?: number | null
          incluir_bens?: boolean
          incluir_objetivos?: boolean
          inflacao?: number | null
          patrimonio_atual?: number | null
          pessoa?: string
          poupanca_mensal?: number | null
          renda_desejada?: number | null
          renda_passiva_atual?: number | null
          taxa_nominal?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      atlas_quotes: {
        Row: {
          active: boolean
          author: string
          category: string
          created_at: string
          id: string
          text: string
        }
        Insert: {
          active?: boolean
          author?: string
          category?: string
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          active?: boolean
          author?: string
          category?: string
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      atlas_score_snapshots: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          label: string
          period_end: string
          period_start: string
          score: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          label: string
          period_end: string
          period_start: string
          score: number
          snapshot_date?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          label?: string
          period_end?: string
          period_start?: string
          score?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_type: string
          bank_name: string
          created_at: string
          id: string
          last_four: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          bank_name?: string
          created_at?: string
          id?: string
          last_four?: string | null
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          bank_name?: string
          created_at?: string
          id?: string
          last_four?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          direction: string
          emoji: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          direction?: string
          emoji?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          direction?: string
          emoji?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_client_notes: {
        Row: {
          client_id: string
          company_id: string
          content: string
          created_at: string
          id: string
          pinned: boolean
          tipo: string
          user_id: string
        }
        Insert: {
          client_id: string
          company_id: string
          content: string
          created_at?: string
          id?: string
          pinned?: boolean
          tipo?: string
          user_id: string
        }
        Update: {
          client_id?: string
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      business_client_tasks: {
        Row: {
          client_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          client_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          client_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_client_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      business_clients: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          data_nascimento: string | null
          document: string | null
          document_type: string | null
          email: string | null
          endereco: string | null
          id: string
          info: string | null
          name: string
          notes: string | null
          observacoes: string | null
          origem: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          data_nascimento?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          info?: string | null
          name: string
          notes?: string | null
          observacoes?: string | null
          origem?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          data_nascimento?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          info?: string | null
          name?: string
          notes?: string | null
          observacoes?: string | null
          origem?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_imports: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          filename: string | null
          id: string
          rows_imported: number
          rows_skipped: number
          status: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          filename?: string | null
          id?: string
          rows_imported?: number
          rows_skipped?: number
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          filename?: string | null
          id?: string
          rows_imported?: number
          rows_skipped?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_inventory_items: {
        Row: {
          categoria: string | null
          company_id: string
          created_at: string
          custo_unitario: number
          estoque_minimo: number
          ficha_descricao: string | null
          id: string
          nome: string
          preco_venda: number
          saldo: number
          tipo: string
          unidade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          company_id: string
          created_at?: string
          custo_unitario?: number
          estoque_minimo?: number
          ficha_descricao?: string | null
          id?: string
          nome: string
          preco_venda?: number
          saldo?: number
          tipo?: string
          unidade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          company_id?: string
          created_at?: string
          custo_unitario?: number
          estoque_minimo?: number
          ficha_descricao?: string | null
          id?: string
          nome?: string
          preco_venda?: number
          saldo?: number
          tipo?: string
          unidade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_lead_tasks: {
        Row: {
          company_id: string
          concluida: boolean
          created_at: string
          data_prevista: string | null
          id: string
          lead_id: string
          titulo: string
          user_id: string
        }
        Insert: {
          company_id: string
          concluida?: boolean
          created_at?: string
          data_prevista?: string | null
          id?: string
          lead_id: string
          titulo: string
          user_id: string
        }
        Update: {
          company_id?: string
          concluida?: boolean
          created_at?: string
          data_prevista?: string | null
          id?: string
          lead_id?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "business_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      business_leads: {
        Row: {
          company_id: string
          contato: string | null
          created_at: string
          data_proximo_passo: string | null
          estagio: string
          id: string
          nome: string
          notas: string | null
          origem: string | null
          produto: string | null
          proximo_passo: string | null
          updated_at: string
          user_id: string
          valor_proposta: number
        }
        Insert: {
          company_id: string
          contato?: string | null
          created_at?: string
          data_proximo_passo?: string | null
          estagio?: string
          id?: string
          nome: string
          notas?: string | null
          origem?: string | null
          produto?: string | null
          proximo_passo?: string | null
          updated_at?: string
          user_id: string
          valor_proposta?: number
        }
        Update: {
          company_id?: string
          contato?: string | null
          created_at?: string
          data_proximo_passo?: string | null
          estagio?: string
          id?: string
          nome?: string
          notas?: string | null
          origem?: string | null
          produto?: string | null
          proximo_passo?: string | null
          updated_at?: string
          user_id?: string
          valor_proposta?: number
        }
        Relationships: []
      }
      business_proposal_items: {
        Row: {
          descricao: string | null
          id: string
          label: string
          product_id: string | null
          proposal_id: string
          quantidade: number
          sort_order: number
          user_id: string
          valor: number
        }
        Insert: {
          descricao?: string | null
          id?: string
          label: string
          product_id?: string | null
          proposal_id: string
          quantidade?: number
          sort_order?: number
          user_id: string
          valor?: number
        }
        Update: {
          descricao?: string | null
          id?: string
          label?: string
          product_id?: string | null
          proposal_id?: string
          quantidade?: number
          sort_order?: number
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "business_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_proposals: {
        Row: {
          client_comment: string | null
          client_id: string | null
          company_id: string
          created_at: string
          delivered_at: string | null
          desconto: number
          id: string
          installments: number
          lead_id: string | null
          payment_method: string | null
          responded_at: string | null
          revenue_done: boolean
          sent_at: string | null
          status: string
          stock_done: boolean
          terms: string | null
          titulo: string | null
          token: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          client_comment?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          delivered_at?: string | null
          desconto?: number
          id?: string
          installments?: number
          lead_id?: string | null
          payment_method?: string | null
          responded_at?: string | null
          revenue_done?: boolean
          sent_at?: string | null
          status?: string
          stock_done?: boolean
          terms?: string | null
          titulo?: string | null
          token?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          client_comment?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          desconto?: number
          id?: string
          installments?: number
          lead_id?: string | null
          payment_method?: string | null
          responded_at?: string | null
          revenue_done?: boolean
          sent_at?: string | null
          status?: string
          stock_done?: boolean
          terms?: string | null
          titulo?: string | null
          token?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "business_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      business_recipes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          insumo_id: string
          produto_id: string
          quantidade: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          insumo_id: string
          produto_id: string
          quantidade?: number
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          insumo_id?: string
          produto_id?: string
          quantidade?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_recipes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recipes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      business_recurring_instances: {
        Row: {
          amount: number
          company_id: string
          confirmed_at: string | null
          created_at: string
          due_date: string
          id: string
          month_ref: string
          status: string
          template_id: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          company_id: string
          confirmed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          month_ref: string
          status?: string
          template_id: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          confirmed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          month_ref?: string
          status?: string
          template_id?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_recurring_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recurring_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "business_recurring_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recurring_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_recurring_templates: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          due_day: number
          end_month: string | null
          frequency: string
          id: string
          start_month: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount?: number
          category_id?: string | null
          company_id: string
          created_at?: string
          due_day?: number
          end_month?: string | null
          frequency?: string
          id?: string
          start_month?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          due_day?: number
          end_month?: string | null
          frequency?: string
          id?: string
          start_month?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_recurring_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recurring_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_stock_movements: {
        Row: {
          company_id: string
          created_at: string
          custo: number | null
          id: string
          item_id: string
          motivo: string | null
          quantidade: number
          tipo: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custo?: number | null
          id?: string
          item_id: string
          motivo?: string | null
          quantidade?: number
          tipo: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custo?: number | null
          id?: string
          item_id?: string
          motivo?: string | null
          quantidade?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      business_transactions: {
        Row: {
          amount: number
          category_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          date: string
          description: string
          direction: string
          external_hash: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantidade: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          date?: string
          description?: string
          direction?: string
          external_hash?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantidade?: number | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          date?: string
          description?: string
          direction?: string
          external_hash?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantidade?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_credito: {
        Row: {
          created_at: string
          id: string
          mes_ano: string
          nome: string
          observacao: string | null
          updated_at: string
          user_id: string
          valor_fatura: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ano: string
          nome?: string
          observacao?: string | null
          updated_at?: string
          user_id: string
          valor_fatura?: number
        }
        Update: {
          created_at?: string
          id?: string
          mes_ano?: string
          nome?: string
          observacao?: string | null
          updated_at?: string
          user_id?: string
          valor_fatura?: number
        }
        Relationships: []
      }
      cashflow_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          is_recurring: boolean
          payment_method: string | null
          recurring_rule: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          payment_method?: string | null
          recurring_rule?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          payment_method?: string | null
          recurring_rule?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          mes_ano: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          mes_ano: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          mes_ano?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          archived: boolean
          brand_color: string | null
          business_type: string
          cnpj: string | null
          controla_estoque: boolean | null
          created_at: string
          currency: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          media_kit_url: string | null
          name: string
          nicho: string | null
          paid_seats: number
          pix_key: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          brand_color?: string | null
          business_type?: string
          cnpj?: string | null
          controla_estoque?: boolean | null
          created_at?: string
          currency?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          media_kit_url?: string | null
          name?: string
          nicho?: string | null
          paid_seats?: number
          pix_key?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          brand_color?: string | null
          business_type?: string
          cnpj?: string | null
          controla_estoque?: boolean | null
          created_at?: string
          currency?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          media_kit_url?: string | null
          name?: string
          nicho?: string | null
          paid_seats?: number
          pix_key?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_audit_events: {
        Row: {
          created_at: string
          detail: Json | null
          event_type: string
          id: string
          statement_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event_type: string
          id?: string
          statement_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          statement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_audit_events_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "credit_card_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_installments: {
        Row: {
          amount: number
          created_at: string
          fingerprint: string
          id: string
          last_seen_at: string
          merchant: string
          started_at: string
          status: string
          total_installments: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          fingerprint: string
          id?: string
          last_seen_at: string
          merchant: string
          started_at: string
          status?: string
          total_installments?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fingerprint?: string
          id?: string
          last_seen_at?: string
          merchant?: string
          started_at?: string
          status?: string
          total_installments?: number
          user_id?: string
        }
        Relationships: []
      }
      credit_card_statement_lines: {
        Row: {
          amount: number
          category: string | null
          confidence: number
          created_at: string
          currency: string
          description_raw: string | null
          expense_type: string | null
          explain: string | null
          fingerprint: string | null
          id: string
          idempotency_key: string | null
          installment_current: number | null
          installment_total: number | null
          line_index: number
          merchant_norm: string | null
          merchant_raw: string | null
          origin: string
          purchase_date: string
          raw_text: string | null
          recurring: boolean
          statement_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          confidence?: number
          created_at?: string
          currency?: string
          description_raw?: string | null
          expense_type?: string | null
          explain?: string | null
          fingerprint?: string | null
          id?: string
          idempotency_key?: string | null
          installment_current?: number | null
          installment_total?: number | null
          line_index?: number
          merchant_norm?: string | null
          merchant_raw?: string | null
          origin?: string
          purchase_date?: string
          raw_text?: string | null
          recurring?: boolean
          statement_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          confidence?: number
          created_at?: string
          currency?: string
          description_raw?: string | null
          expense_type?: string | null
          explain?: string | null
          fingerprint?: string | null
          id?: string
          idempotency_key?: string | null
          installment_current?: number | null
          installment_total?: number | null
          line_index?: number
          merchant_norm?: string | null
          merchant_raw?: string | null
          origin?: string
          purchase_date?: string
          raw_text?: string | null
          recurring?: boolean
          statement_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "credit_card_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_statements: {
        Row: {
          ai_calls: number
          ai_items_count: number
          cache_items_count: number
          card_id: string | null
          card_last4: string | null
          created_at: string
          detected_installments: number
          due_date: string | null
          duplicates_skipped: number
          estimated_cost_usd: number
          file_hash: string | null
          file_path: string | null
          id: string
          latency_ms: number
          parsed_items_count: number
          provider: string
          rule_items_count: number
          source_label: string
          source_name: string
          statement_fingerprint_v2: string | null
          statement_month: string
          status: string
          tokens_in: number
          tokens_out: number
          top5_signature: string | null
          total_amount: number
          total_items: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_calls?: number
          ai_items_count?: number
          cache_items_count?: number
          card_id?: string | null
          card_last4?: string | null
          created_at?: string
          detected_installments?: number
          due_date?: string | null
          duplicates_skipped?: number
          estimated_cost_usd?: number
          file_hash?: string | null
          file_path?: string | null
          id?: string
          latency_ms?: number
          parsed_items_count?: number
          provider?: string
          rule_items_count?: number
          source_label?: string
          source_name?: string
          statement_fingerprint_v2?: string | null
          statement_month: string
          status?: string
          tokens_in?: number
          tokens_out?: number
          top5_signature?: string | null
          total_amount?: number
          total_items?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_calls?: number
          ai_items_count?: number
          cache_items_count?: number
          card_id?: string | null
          card_last4?: string | null
          created_at?: string
          detected_installments?: number
          due_date?: string | null
          duplicates_skipped?: number
          estimated_cost_usd?: number
          file_hash?: string | null
          file_path?: string | null
          id?: string
          latency_ms?: number
          parsed_items_count?: number
          provider?: string
          rule_items_count?: number
          source_label?: string
          source_name?: string
          statement_fingerprint_v2?: string | null
          statement_month?: string
          status?: string
          tokens_in?: number
          tokens_out?: number
          top5_signature?: string | null
          total_amount?: number
          total_items?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_statements_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          closing_day: number
          created_at: string
          currency: string
          due_day: number
          id: string
          issuer: string
          last_four_digits: string | null
          limit_amount: number
          name: string
          user_id: string
        }
        Insert: {
          closing_day?: number
          created_at?: string
          currency?: string
          due_day?: number
          id?: string
          issuer?: string
          last_four_digits?: string | null
          limit_amount?: number
          name?: string
          user_id: string
        }
        Update: {
          closing_day?: number
          created_at?: string
          currency?: string
          due_day?: number
          id?: string
          issuer?: string
          last_four_digits?: string | null
          limit_amount?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      cross_ledger_links: {
        Row: {
          company_id: string
          created_at: string
          id: string
          month_ref: string
          pf_amount: number
          pf_category: string
          pf_entry_type: string
          pj_transaction_id: string
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          month_ref: string
          pf_amount?: number
          pf_category?: string
          pf_entry_type?: string
          pj_transaction_id: string
          type?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          month_ref?: string
          pf_amount?: number
          pf_category?: string
          pf_entry_type?: string
          pj_transaction_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_ledger_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_ledger_links_pj_transaction_id_fkey"
            columns: ["pj_transaction_id"]
            isOneToOne: false
            referencedRelation: "business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_despesa_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      dependentes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          observacoes: string | null
          parentesco: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          parentesco?: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          parentesco?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          ajuste_variacao: boolean
          categoria: string
          created_at: string
          data: string
          data_inicio_parcelas: string | null
          descricao: string | null
          dia_vencimento: number | null
          forma_pagamento: string | null
          id: string
          import_id: string | null
          is_parcelada: boolean
          mes_referencia: string | null
          parcela_atual: number | null
          recorrente: boolean
          responsavel: string
          status: string
          subcategoria: string | null
          tipo: string
          tipo_parcelamento: string
          total_parcelas: number | null
          updated_at: string
          user_id: string
          valor: number
          valor_base: number | null
          valor_total: number | null
          vencimento: number | null
        }
        Insert: {
          ajuste_variacao?: boolean
          categoria?: string
          created_at?: string
          data?: string
          data_inicio_parcelas?: string | null
          descricao?: string | null
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          id?: string
          import_id?: string | null
          is_parcelada?: boolean
          mes_referencia?: string | null
          parcela_atual?: number | null
          recorrente?: boolean
          responsavel?: string
          status?: string
          subcategoria?: string | null
          tipo?: string
          tipo_parcelamento?: string
          total_parcelas?: number | null
          updated_at?: string
          user_id: string
          valor?: number
          valor_base?: number | null
          valor_total?: number | null
          vencimento?: number | null
        }
        Update: {
          ajuste_variacao?: boolean
          categoria?: string
          created_at?: string
          data?: string
          data_inicio_parcelas?: string | null
          descricao?: string | null
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          id?: string
          import_id?: string | null
          is_parcelada?: boolean
          mes_referencia?: string | null
          parcela_atual?: number | null
          recorrente?: boolean
          responsavel?: string
          status?: string
          subcategoria?: string | null
          tipo?: string
          tipo_parcelamento?: string
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor?: number
          valor_base?: number | null
          valor_total?: number | null
          vencimento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "ofx_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_skip: {
        Row: {
          created_at: string | null
          id: string
          month_ref: string
          reason: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_ref: string
          reason?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          month_ref?: string
          reason?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: []
      }
      economias: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          destino_id: string | null
          destino_tipo: string
          id: string
          responsavel: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          destino_id?: string | null
          destino_tipo?: string
          id?: string
          responsavel?: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          destino_id?: string | null
          destino_tipo?: string
          id?: string
          responsavel?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      empresas_usuario: {
        Row: {
          created_at: string
          id: string
          nome_empresa: string
          percentual_imposto: number
          percentual_pro_labore: number
          percentual_reinvestimento: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome_empresa?: string
          percentual_imposto?: number
          percentual_pro_labore?: number
          percentual_reinvestimento?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome_empresa?: string
          percentual_imposto?: number
          percentual_pro_labore?: number
          percentual_reinvestimento?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fatura_import_logs: {
        Row: {
          ai_fallback_used: boolean
          created_at: string
          estimated_tokens: number
          file_name: string | null
          id: string
          processing_ms: number
          provider_used: string | null
          resolved_by_cache: number
          resolved_by_rules: number
          sent_to_ai: number
          total_transactions: number
          user_id: string
        }
        Insert: {
          ai_fallback_used?: boolean
          created_at?: string
          estimated_tokens?: number
          file_name?: string | null
          id?: string
          processing_ms?: number
          provider_used?: string | null
          resolved_by_cache?: number
          resolved_by_rules?: number
          sent_to_ai?: number
          total_transactions?: number
          user_id: string
        }
        Update: {
          ai_fallback_used?: boolean
          created_at?: string
          estimated_tokens?: number
          file_name?: string | null
          id?: string
          processing_ms?: number
          provider_used?: string | null
          resolved_by_cache?: number
          resolved_by_rules?: number
          sent_to_ai?: number
          total_transactions?: number
          user_id?: string
        }
        Relationships: []
      }
      fechamentos_mensais: {
        Row: {
          created_at: string
          fechado_em: string
          id: string
          mes_ano: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fechado_em?: string
          id?: string
          mes_ano: string
          user_id: string
        }
        Update: {
          created_at?: string
          fechado_em?: string
          id?: string
          mes_ano?: string
          user_id?: string
        }
        Relationships: []
      }
      fii_informes_cache: {
        Row: {
          informe: Json
          source_reference_date: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          informe: Json
          source_reference_date?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          informe?: Json
          source_reference_date?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string | null
          household_id: string
          id: string
          invited_at: string | null
          invited_email: string | null
          joined_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          household_id: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          household_id?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      indicadores_economicos: {
        Row: {
          data_referencia: string | null
          id: string
          indicador: string
          updated_at: string
          valor: number
        }
        Insert: {
          data_referencia?: string | null
          id?: string
          indicador: string
          updated_at?: string
          valor?: number
        }
        Update: {
          data_referencia?: string | null
          id?: string
          indicador?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      installment_instances: {
        Row: {
          amount: number
          competencia: string
          created_at: string
          due_date: string
          id: string
          installment_id: string
          installment_number: number
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          competencia: string
          created_at?: string
          due_date: string
          id?: string
          installment_id: string
          installment_number: number
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          competencia?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_id?: string
          installment_number?: number
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_instances_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_leads: {
        Row: {
          created_at: string
          dependentes: number
          email: string
          heranca_esperada: string
          id: string
          nome: string
          objetivo: string
          observacoes: string | null
          patrimonio_imobiliario: string
          patrimonio_investido: string
          renda_mensal: string
          score: number
          seguro_atual: string
          status: string
          telefone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dependentes?: number
          email?: string
          heranca_esperada?: string
          id?: string
          nome?: string
          objetivo?: string
          observacoes?: string | null
          patrimonio_imobiliario?: string
          patrimonio_investido?: string
          renda_mensal?: string
          score?: number
          seguro_atual?: string
          status?: string
          telefone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dependentes?: number
          email?: string
          heranca_esperada?: string
          id?: string
          nome?: string
          objetivo?: string
          observacoes?: string | null
          patrimonio_imobiliario?: string
          patrimonio_investido?: string
          renda_mensal?: string
          score?: number
          seguro_atual?: string
          status?: string
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      investimento_imports: {
        Row: {
          filename: string | null
          id: string
          imported_at: string
          inserted_count: number
          notes: string | null
          rows_count: number
          skipped_count: number
          source: string
          status: string
          updated_count: number
          user_id: string
        }
        Insert: {
          filename?: string | null
          id?: string
          imported_at?: string
          inserted_count?: number
          notes?: string | null
          rows_count?: number
          skipped_count?: number
          source?: string
          status?: string
          updated_count?: number
          user_id: string
        }
        Update: {
          filename?: string | null
          id?: string
          imported_at?: string
          inserted_count?: number
          notes?: string | null
          rows_count?: number
          skipped_count?: number
          source?: string
          status?: string
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      investimentos_financeiros: {
        Row: {
          categoria_titulo: string | null
          classe: string
          created_at: string
          data_compra: string | null
          frequencia_proventos: string
          id: string
          import_id: string | null
          indexador: string | null
          instituicao: string
          is_reserva_emergencia: boolean
          liquidez: string | null
          meses_proventos: string | null
          nome: string
          perfil_risco: string | null
          preco_medio: number | null
          quantidade: number | null
          recebe_proventos: boolean
          rentabilidade_estimada: number | null
          taxa_contratada: number | null
          ticker: string | null
          tipo: string
          total_aportado: number
          updated_at: string
          user_id: string
          valor: number
          valor_atual: number
          vencimento_data: string | null
        }
        Insert: {
          categoria_titulo?: string | null
          classe?: string
          created_at?: string
          data_compra?: string | null
          frequencia_proventos?: string
          id?: string
          import_id?: string | null
          indexador?: string | null
          instituicao?: string
          is_reserva_emergencia?: boolean
          liquidez?: string | null
          meses_proventos?: string | null
          nome?: string
          perfil_risco?: string | null
          preco_medio?: number | null
          quantidade?: number | null
          recebe_proventos?: boolean
          rentabilidade_estimada?: number | null
          taxa_contratada?: number | null
          ticker?: string | null
          tipo?: string
          total_aportado?: number
          updated_at?: string
          user_id: string
          valor?: number
          valor_atual?: number
          vencimento_data?: string | null
        }
        Update: {
          categoria_titulo?: string | null
          classe?: string
          created_at?: string
          data_compra?: string | null
          frequencia_proventos?: string
          id?: string
          import_id?: string | null
          indexador?: string | null
          instituicao?: string
          is_reserva_emergencia?: boolean
          liquidez?: string | null
          meses_proventos?: string | null
          nome?: string
          perfil_risco?: string | null
          preco_medio?: number | null
          quantidade?: number | null
          recebe_proventos?: boolean
          rentabilidade_estimada?: number | null
          taxa_contratada?: number | null
          ticker?: string | null
          tipo?: string
          total_aportado?: number
          updated_at?: string
          user_id?: string
          valor?: number
          valor_atual?: number
          vencimento_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investimentos_financeiros_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "investimento_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      investimentos_nao_financeiros: {
        Row: {
          created_at: string
          divida_vinculada: number | null
          gera_renda: boolean
          id: string
          nome: string
          observacao_renda: string | null
          tipo: string
          tipo_renda: string | null
          updated_at: string
          user_id: string
          valor: number
          valor_renda: number | null
        }
        Insert: {
          created_at?: string
          divida_vinculada?: number | null
          gera_renda?: boolean
          id?: string
          nome?: string
          observacao_renda?: string | null
          tipo?: string
          tipo_renda?: string | null
          updated_at?: string
          user_id: string
          valor?: number
          valor_renda?: number | null
        }
        Update: {
          created_at?: string
          divida_vinculada?: number | null
          gera_renda?: boolean
          id?: string
          nome?: string
          observacao_renda?: string | null
          tipo?: string
          tipo_renda?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
          valor_renda?: number | null
        }
        Relationships: []
      }
      investment_expense_links: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          investment_id: string
          tipo_despesa: string
          updated_at: string
          user_id: string
          valor_vinculado: number
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          investment_id: string
          tipo_despesa?: string
          updated_at?: string
          user_id: string
          valor_vinculado?: number
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          investment_id?: string
          tipo_despesa?: string
          updated_at?: string
          user_id?: string
          valor_vinculado?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_expense_links_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_expense_links_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investimentos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_negocio: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          tipo?: string
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      life_reports: {
        Row: {
          content: string
          created_at: string
          generated_at: string
          id: string
          report_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          generated_at?: string
          id?: string
          report_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_at?: string
          id?: string
          report_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_category_learning: {
        Row: {
          categoria: string
          confidence: number
          created_at: string
          id: string
          merchant: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria: string
          confidence?: number
          created_at?: string
          id?: string
          merchant: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          confidence?: number
          created_at?: string
          id?: string
          merchant?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_rules: {
        Row: {
          category: string
          confidence: number
          id: string
          merchant_norm: string
          recurring_default: boolean
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number
          id?: string
          merchant_norm: string
          recurring_default?: boolean
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          id?: string
          merchant_norm?: string
          recurring_default?: boolean
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meses_iniciados: {
        Row: {
          created_at: string
          id: string
          mes_ano: string
          origem: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ano: string
          origem?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mes_ano?: string
          origem?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_financial_summaries: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          month_ref: string
          saldo_mensal: number | null
          taxa_poupanca: number | null
          total_despesas: number
          total_economias: number
          total_receitas: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          id?: string
          month_ref: string
          saldo_mensal?: number | null
          taxa_poupanca?: number | null
          total_despesas?: number
          total_economias?: number
          total_receitas?: number
          user_id: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          month_ref?: string
          saldo_mensal?: number | null
          taxa_poupanca?: number | null
          total_despesas?: number
          total_economias?: number
          total_receitas?: number
          user_id?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          block: string
          created_at: string
          delivery_status: string
          error_message: string | null
          id: string
          message: string
          notification_slug: string
          priority: string
          route: string
          sent_at: string
          source_ref: string | null
          title: string
          user_id: string
        }
        Insert: {
          block?: string
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          message: string
          notification_slug: string
          priority?: string
          route?: string
          sent_at?: string
          source_ref?: string | null
          title: string
          user_id: string
        }
        Update: {
          block?: string
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          message?: string
          notification_slug?: string
          priority?: string
          route?: string
          sent_at?: string
          source_ref?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      objetivos: {
        Row: {
          aporte_mensal: number | null
          created_at: string
          data_objetivo: string | null
          detalhes: string | null
          frequencia: string | null
          id: string
          imagem_url: string | null
          nome: string
          responsavel: string
          updated_at: string
          user_id: string
          valor_acumulado: number | null
          valor_objetivo: number
        }
        Insert: {
          aporte_mensal?: number | null
          created_at?: string
          data_objetivo?: string | null
          detalhes?: string | null
          frequencia?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          responsavel?: string
          updated_at?: string
          user_id: string
          valor_acumulado?: number | null
          valor_objetivo?: number
        }
        Update: {
          aporte_mensal?: number | null
          created_at?: string
          data_objetivo?: string | null
          detalhes?: string | null
          frequencia?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          responsavel?: string
          updated_at?: string
          user_id?: string
          valor_acumulado?: number | null
          valor_objetivo?: number
        }
        Relationships: []
      }
      ofx_imports: {
        Row: {
          account_id: string | null
          filename: string | null
          first_date: string | null
          id: string
          imported_at: string
          inserted_despesas: number
          inserted_receitas: number
          inserted_transactions: number
          last_date: string | null
          skipped_duplicates: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          filename?: string | null
          first_date?: string | null
          id?: string
          imported_at?: string
          inserted_despesas?: number
          inserted_receitas?: number
          inserted_transactions?: number
          last_date?: string | null
          skipped_duplicates?: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          filename?: string | null
          first_date?: string | null
          id?: string
          imported_at?: string
          inserted_despesas?: number
          inserted_receitas?: number
          inserted_transactions?: number
          last_date?: string | null
          skipped_duplicates?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ofx_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos_categorias: {
        Row: {
          categoria: string
          created_at: string
          id: string
          mes_ano: string
          updated_at: string
          user_id: string
          valor_limite: number
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          mes_ano: string
          updated_at?: string
          user_id: string
          valor_limite?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          mes_ano?: string
          updated_at?: string
          user_id?: string
          valor_limite?: number
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          created_at: string
          id: string
          mes: string
          pago_em: string | null
          ref_id: string
          ref_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes: string
          pago_em?: string | null
          ref_id: string
          ref_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          pago_em?: string | null
          ref_id?: string
          ref_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_coupons: {
        Row: {
          client_cost_zero: boolean
          client_discount_type: string | null
          client_discount_value: number | null
          code: string
          created_at: string
          description: string | null
          id: string
          partner_commission_type: string | null
          partner_commission_value: number | null
          partner_id: string
          partner_pays_full: boolean
          plan_slug: string | null
          pricing_model: string
          status: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          client_cost_zero?: boolean
          client_discount_type?: string | null
          client_discount_value?: number | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          partner_commission_type?: string | null
          partner_commission_value?: number | null
          partner_id: string
          partner_pays_full?: boolean
          plan_slug?: string | null
          pricing_model?: string
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          client_cost_zero?: boolean
          client_discount_type?: string | null
          client_discount_value?: number | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          partner_commission_type?: string | null
          partner_commission_value?: number | null
          partner_id?: string
          partner_pays_full?: boolean
          plan_slug?: string | null
          pricing_model?: string
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_coupons_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      password_resets: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          ip: string | null
          token_hash: string
          used_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip?: string | null
          token_hash: string
          used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip?: string | null
          token_hash?: string
          used_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      pattern_rules: {
        Row: {
          category: string
          confidence: number
          id: string
          pattern: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number
          id?: string
          pattern: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          id?: string
          pattern?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_alert_events: {
        Row: {
          alert_id: string
          created_at: string
          dismissed_at: string | null
          id: string
          message: string | null
          offset_days: number
          scheduled_for: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string | null
          offset_days: number
          scheduled_for: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string | null
          offset_days?: number
          scheduled_for?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "payment_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_alerts: {
        Row: {
          created_at: string
          custom_message: string | null
          dismissed_at: string | null
          due_date: string
          id: string
          linked_investment_id: string | null
          reminder_offsets: number[]
          source_id: string
          source_type: string
          status: string
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_message?: string | null
          dismissed_at?: string | null
          due_date: string
          id?: string
          linked_investment_id?: string | null
          reminder_offsets?: number[]
          source_id: string
          source_type?: string
          status?: string
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_message?: string | null
          dismissed_at?: string | null
          due_date?: string
          id?: string
          linked_investment_id?: string | null
          reminder_offsets?: number[]
          source_id?: string
          source_type?: string
          status?: string
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          feature_key: string
          id: string
          plan_id: string
        }
        Insert: {
          feature_key: string
          id?: string
          plan_id: string
        }
        Update: {
          feature_key?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamento_negocio: {
        Row: {
          created_at: string
          despesa_planejada: number
          id: string
          mes_ano: string
          receita_planejada: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          despesa_planejada?: number
          id?: string
          mes_ano: string
          receita_planejada?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          despesa_planejada?: number
          id?: string
          mes_ano?: string
          receita_planejada?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          id: string
          month_ref: string
          total_contributions: number
          total_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_ref: string
          total_contributions?: number
          total_value?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month_ref?: string
          total_contributions?: number
          total_value?: number
          user_id?: string
        }
        Relationships: []
      }
      portfolio_transactions: {
        Row: {
          created_at: string
          data: string
          id: string
          investimento_id: string | null
          nome: string
          observacao: string | null
          preco_unitario: number
          quantidade: number
          ticker: string
          tipo: string
          user_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          investimento_id?: string | null
          nome?: string
          observacao?: string | null
          preco_unitario?: number
          quantidade?: number
          ticker?: string
          tipo: string
          user_id: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          investimento_id?: string | null
          nome?: string
          observacao?: string | null
          preco_unitario?: number
          quantidade?: number
          ticker?: string
          tipo?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transactions_investimento_id_fkey"
            columns: ["investimento_id"]
            isOneToOne: false
            referencedRelation: "investimentos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_scope: string
          age: number | null
          created_at: string
          currency: string
          dependents: number | null
          emoji_casal: string
          emoji_geral: string
          emoji_pessoa1: string
          emoji_pessoa2: string
          foto_casal: string | null
          foto_geral: string | null
          foto_pessoa1: string | null
          foto_pessoa2: string | null
          full_name: string
          greeting_emoji: string
          id: string
          language: string
          last_weekly_email_sent_at: string | null
          marital_status: string | null
          marketing_consent: boolean
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          marketing_opt_in_source: string | null
          must_change_password: boolean
          nome_pessoa1: string
          nome_pessoa2: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          pessoa2_participa_geral: boolean | null
          phone: string | null
          selected_company_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tema_destaque: string
          tema_modo: string
          tema_sidebar: string
          updated_at: string
          user_id: string
          vinculo_pessoa2: string | null
          weekly_email_day: number
          weekly_email_enabled: boolean
          weekly_email_hour: number
          weekly_email_timezone: string
        }
        Insert: {
          access_scope?: string
          age?: number | null
          created_at?: string
          currency?: string
          dependents?: number | null
          emoji_casal?: string
          emoji_geral?: string
          emoji_pessoa1?: string
          emoji_pessoa2?: string
          foto_casal?: string | null
          foto_geral?: string | null
          foto_pessoa1?: string | null
          foto_pessoa2?: string | null
          full_name?: string
          greeting_emoji?: string
          id?: string
          language?: string
          last_weekly_email_sent_at?: string | null
          marital_status?: string | null
          marketing_consent?: boolean
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          marketing_opt_in_source?: string | null
          must_change_password?: boolean
          nome_pessoa1?: string
          nome_pessoa2?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          pessoa2_participa_geral?: boolean | null
          phone?: string | null
          selected_company_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tema_destaque?: string
          tema_modo?: string
          tema_sidebar?: string
          updated_at?: string
          user_id: string
          vinculo_pessoa2?: string | null
          weekly_email_day?: number
          weekly_email_enabled?: boolean
          weekly_email_hour?: number
          weekly_email_timezone?: string
        }
        Update: {
          access_scope?: string
          age?: number | null
          created_at?: string
          currency?: string
          dependents?: number | null
          emoji_casal?: string
          emoji_geral?: string
          emoji_pessoa1?: string
          emoji_pessoa2?: string
          foto_casal?: string | null
          foto_geral?: string | null
          foto_pessoa1?: string | null
          foto_pessoa2?: string | null
          full_name?: string
          greeting_emoji?: string
          id?: string
          language?: string
          last_weekly_email_sent_at?: string | null
          marital_status?: string | null
          marketing_consent?: boolean
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          marketing_opt_in_source?: string | null
          must_change_password?: boolean
          nome_pessoa1?: string
          nome_pessoa2?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          pessoa2_participa_geral?: boolean | null
          phone?: string | null
          selected_company_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tema_destaque?: string
          tema_modo?: string
          tema_sidebar?: string
          updated_at?: string
          user_id?: string
          vinculo_pessoa2?: string | null
          weekly_email_day?: number
          weekly_email_enabled?: boolean
          weekly_email_hour?: number
          weekly_email_timezone?: string
        }
        Relationships: []
      }
      proventos_investimentos: {
        Row: {
          created_at: string
          ex_date: string | null
          id: string
          investimento_id: string
          mes_referencia: string
          observacao: string | null
          tipo_provento: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          ex_date?: string | null
          id?: string
          investimento_id: string
          mes_referencia?: string
          observacao?: string | null
          tipo_provento?: string
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          ex_date?: string | null
          id?: string
          investimento_id?: string
          mes_referencia?: string
          observacao?: string | null
          tipo_provento?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_reason: string | null
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_success_at: string | null
          p256dh: string
          platform: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_register: {
        Row: {
          count: number
          hour_key: string
          ip_key: string
          updated_at: string
        }
        Insert: {
          count?: number
          hour_key?: string
          ip_key: string
          updated_at?: string
        }
        Update: {
          count?: number
          hour_key?: string
          ip_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_v2: {
        Row: {
          count: number
          created_at: string
          id: string
          scope: string
          updated_at: string
          user_id: string
          window_key: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          scope: string
          updated_at?: string
          user_id: string
          window_key: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          scope?: string
          updated_at?: string
          user_id?: string
          window_key?: string
        }
        Relationships: []
      }
      receitas: {
        Row: {
          categoria: string
          corresponde: string | null
          created_at: string
          data: string
          descricao: string | null
          dia_recebimento: number | null
          id: string
          import_id: string | null
          porcentagem_economia: number | null
          recorrente: boolean
          recorrente_ate: string | null
          responsavel: string
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string
          corresponde?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          dia_recebimento?: number | null
          id?: string
          import_id?: string | null
          porcentagem_economia?: number | null
          recorrente?: boolean
          recorrente_ate?: string | null
          responsavel?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          corresponde?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          dia_recebimento?: number | null
          id?: string
          import_id?: string | null
          porcentagem_economia?: number | null
          recorrente?: boolean
          recorrente_ate?: string | null
          responsavel?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "ofx_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      rendimentos_mensais: {
        Row: {
          created_at: string
          id: string
          investimento_id: string
          mes_ano: string
          observacao: string | null
          percentual: number
          updated_at: string
          user_id: string
          valor_antes: number
          valor_apos: number
        }
        Insert: {
          created_at?: string
          id?: string
          investimento_id: string
          mes_ano: string
          observacao?: string | null
          percentual: number
          updated_at?: string
          user_id: string
          valor_antes: number
          valor_apos: number
        }
        Update: {
          created_at?: string
          id?: string
          investimento_id?: string
          mes_ano?: string
          observacao?: string | null
          percentual?: number
          updated_at?: string
          user_id?: string
          valor_antes?: number
          valor_apos?: number
        }
        Relationships: [
          {
            foreignKeyName: "rendimentos_mensais_investimento_id_fkey"
            columns: ["investimento_id"]
            isOneToOne: false
            referencedRelation: "investimentos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_guide: {
        Row: {
          cotistas: number | null
          dy_12m: number | null
          ev_ebitda: number | null
          id: string
          market_cap: number | null
          nome: string | null
          patrimonio_liquido: number | null
          pl: number | null
          preco: number | null
          pvp: number | null
          roe: number | null
          setor: string | null
          subtipo: string | null
          ticker: string
          tipo: string
          updated_at: string | null
          variacao_12m: number | null
          variacao_dia: number | null
          variacao_mes: number | null
          variacao_ytd: number | null
          volume_medio: number | null
        }
        Insert: {
          cotistas?: number | null
          dy_12m?: number | null
          ev_ebitda?: number | null
          id?: string
          market_cap?: number | null
          nome?: string | null
          patrimonio_liquido?: number | null
          pl?: number | null
          preco?: number | null
          pvp?: number | null
          roe?: number | null
          setor?: string | null
          subtipo?: string | null
          ticker: string
          tipo: string
          updated_at?: string | null
          variacao_12m?: number | null
          variacao_dia?: number | null
          variacao_mes?: number | null
          variacao_ytd?: number | null
          volume_medio?: number | null
        }
        Update: {
          cotistas?: number | null
          dy_12m?: number | null
          ev_ebitda?: number | null
          id?: string
          market_cap?: number | null
          nome?: string | null
          patrimonio_liquido?: number | null
          pl?: number | null
          preco?: number | null
          pvp?: number | null
          roe?: number | null
          setor?: string | null
          subtipo?: string | null
          ticker?: string
          tipo?: string
          updated_at?: string | null
          variacao_12m?: number | null
          variacao_dia?: number | null
          variacao_mes?: number | null
          variacao_ytd?: number | null
          volume_medio?: number | null
        }
        Relationships: []
      }
      stripe_events_processed: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
          stripe_object_id: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
          stripe_object_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
          stripe_object_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          end_at: string
          grace_end_at: string
          id: string
          plan: string
          source: string
          start_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at?: string
          grace_end_at?: string
          id?: string
          plan?: string
          source?: string
          start_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          grace_end_at?: string
          id?: string
          plan?: string
          source?: string
          start_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticker_cache: {
        Row: {
          abertura: number | null
          admin_name: string | null
          dividend_yield_12m: number | null
          dividend_yield_1m: number | null
          dy: number | null
          ev_ebitda: number | null
          logo_url: string | null
          manager_name: string | null
          market_cap: number | null
          maximo_dia: number | null
          minimo_dia: number | null
          nav_per_share: number | null
          nome: string | null
          pl: number | null
          preco_atual: number | null
          pvp: number | null
          roe: number | null
          segment_name: string | null
          segment_type: string | null
          ticker: string
          tipo_ativo: string | null
          total_investors: number | null
          updated_at: string
          variacao_dia: number | null
          variacao_pct: number | null
          volume: number | null
        }
        Insert: {
          abertura?: number | null
          admin_name?: string | null
          dividend_yield_12m?: number | null
          dividend_yield_1m?: number | null
          dy?: number | null
          ev_ebitda?: number | null
          logo_url?: string | null
          manager_name?: string | null
          market_cap?: number | null
          maximo_dia?: number | null
          minimo_dia?: number | null
          nav_per_share?: number | null
          nome?: string | null
          pl?: number | null
          preco_atual?: number | null
          pvp?: number | null
          roe?: number | null
          segment_name?: string | null
          segment_type?: string | null
          ticker: string
          tipo_ativo?: string | null
          total_investors?: number | null
          updated_at?: string
          variacao_dia?: number | null
          variacao_pct?: number | null
          volume?: number | null
        }
        Update: {
          abertura?: number | null
          admin_name?: string | null
          dividend_yield_12m?: number | null
          dividend_yield_1m?: number | null
          dy?: number | null
          ev_ebitda?: number | null
          logo_url?: string | null
          manager_name?: string | null
          market_cap?: number | null
          maximo_dia?: number | null
          minimo_dia?: number | null
          nav_per_share?: number | null
          nome?: string | null
          pl?: number | null
          preco_atual?: number | null
          pvp?: number | null
          roe?: number | null
          segment_name?: string | null
          segment_type?: string | null
          ticker?: string
          tipo_ativo?: string | null
          total_investors?: number | null
          updated_at?: string
          variacao_dia?: number | null
          variacao_pct?: number | null
          volume?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          fit_id: string | null
          id: string
          import_id: string | null
          responsavel: string
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          fit_id?: string | null
          id?: string
          import_id?: string | null
          responsavel?: string
          source?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          fit_id?: string | null
          id?: string
          import_id?: string | null
          responsavel?: string
          source?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "ofx_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrade_triggers_log: {
        Row: {
          created_at: string
          id: string
          last_shown_at: string
          shown_count: number
          trigger_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_shown_at?: string
          shown_count?: number
          trigger_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_shown_at?: string
          shown_count?: number
          trigger_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_course_progress: {
        Row: {
          completed: boolean | null
          course_slug: string
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          course_slug: string
          created_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          course_slug?: string
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          admin_notes: string | null
          attachments: string[] | null
          category: string
          created_at: string
          description: string
          id: string
          page_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_plan: string | null
        }
        Insert: {
          admin_notes?: string | null
          attachments?: string[] | null
          category: string
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_plan?: string | null
        }
        Update: {
          admin_notes?: string | null
          attachments?: string[] | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_plan?: string | null
        }
        Relationships: []
      }
      user_partner_attributions: {
        Row: {
          assigned_plan_slug: string | null
          attribution_source: string
          client_cost_zero: boolean
          client_discount_snapshot: Json | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          id: string
          partner_commission_snapshot: Json | null
          partner_id: string
          partner_pays_full: boolean
          pricing_model_snapshot: string | null
          status: string
          user_id: string
        }
        Insert: {
          assigned_plan_slug?: string | null
          attribution_source?: string
          client_cost_zero?: boolean
          client_discount_snapshot?: Json | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          id?: string
          partner_commission_snapshot?: Json | null
          partner_id: string
          partner_pays_full?: boolean
          pricing_model_snapshot?: string | null
          status?: string
          user_id: string
        }
        Update: {
          assigned_plan_slug?: string | null
          attribution_source?: string
          client_cost_zero?: boolean
          client_discount_snapshot?: Json | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          id?: string
          partner_commission_snapshot?: Json | null
          partner_id?: string
          partner_pays_full?: boolean
          pricing_model_snapshot?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_partner_attributions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "partner_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_partner_attributions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          active: boolean
          assigned_at: string
          assigned_by_admin: boolean
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string | null
          started_at: string
          tier: Database["public"]["Enums"]["plan_tier"]
          user_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          assigned_by_admin?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          user_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string
          assigned_by_admin?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rate_limits: {
        Row: {
          ai_day_count: number
          ai_day_key: string
          ai_minute_count: number
          ai_minute_key: string
          day_count: number
          day_key: string
          minute_count: number
          minute_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_day_count?: number
          ai_day_key?: string
          ai_minute_count?: number
          ai_minute_key?: string
          day_count?: number
          day_key?: string
          minute_count?: number
          minute_key?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_day_count?: number
          ai_day_key?: string
          ai_minute_count?: number
          ai_minute_key?: string
          day_count?: number
          day_key?: string
          minute_count?: number
          minute_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_recado_reads: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          read_at: string | null
          recado_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          recado_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          recado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recado_reads_recado_id_fkey"
            columns: ["recado_id"]
            isOneToOne: false
            referencedRelation: "admin_recados"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          access_state: string
          bonus_days_full: number
          bonus_days_grace: number
          cancelled_at: string | null
          created_at: string
          deleted_at: string | null
          full_expire_action: string
          full_expires_at: string | null
          grace_finance_until: string
          id: string
          must_change_password: boolean
          origin: string
          plan_tier: string
          restricted_at: string | null
          retention_extra_days: number
          scheduled_deletion_at: string
          trial_expires_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_state?: string
          bonus_days_full?: number
          bonus_days_grace?: number
          cancelled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          full_expire_action?: string
          full_expires_at?: string | null
          grace_finance_until?: string
          id?: string
          must_change_password?: boolean
          origin?: string
          plan_tier?: string
          restricted_at?: string | null
          retention_extra_days?: number
          scheduled_deletion_at?: string
          trial_expires_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_state?: string
          bonus_days_full?: number
          bonus_days_grace?: number
          cancelled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          full_expire_action?: string
          full_expires_at?: string | null
          grace_finance_until?: string
          id?: string
          must_change_password?: boolean
          origin?: string
          plan_tier?: string
          restricted_at?: string | null
          retention_extra_days?: number
          scheduled_deletion_at?: string
          trial_expires_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_terms_acceptance: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      advisor_commission_report: {
        Row: {
          advisor_coupon_id: string | null
          advisor_name: string | null
          ativas_pagantes: number | null
          code: string | null
          commission_pct: number | null
          total_indicacoes: number | null
        }
        Relationships: []
      }
      v_users_stuck_password_change: {
        Row: {
          account_created_at: string | null
          email: string | null
          full_name: string | null
          hours_stuck: number | null
          last_sign_in_at: string | null
          must_change_password: boolean | null
          profile_last_updated: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_business_proposal: { Args: { _token: string }; Returns: undefined }
      add_company_member:
        | {
            Args: { _company_id: string; _email: string; _role?: string }
            Returns: Json
          }
        | {
            Args: {
              _company_id: string
              _email: string
              _restrict?: boolean
              _role?: string
            }
            Returns: Json
          }
      admin_usage_overview: { Args: never; Returns: Json }
      business_reminders_today: {
        Args: never
        Returns: {
          aniversariantes: string[]
          inativos: string[]
          owner_id: string
        }[]
      }
      check_and_increment_ai_quota: {
        Args: { _feature: string }
        Returns: Json
      }
      check_and_increment_rate_limit: {
        Args: {
          _limit: number
          _scope: string
          _user_id: string
          _window_key: string
        }
        Returns: {
          allowed: boolean
          current_count: number
          limit: number
        }[]
      }
      cleanup_old_ai_counters: { Args: never; Returns: undefined }
      confirm_inherited_budget: {
        Args: { p_mes_ano: string; p_source_mes_ano: string; p_user_id: string }
        Returns: number
      }
      consume_invite_token: {
        Args: { _token: string }
        Returns: {
          email: string
          metadata: Json
          source: string
          user_id: string
        }[]
      }
      delete_company: { Args: { _company_id: string }; Returns: Json }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_ai_quota_status: { Args: { _feature: string }; Returns: Json }
      get_budget_with_fallback: {
        Args: { p_mes_ano: string; p_user_id: string }
        Returns: {
          categoria: string
          id: string
          inherited_from_month: string
          is_inherited: boolean
          valor_limite: number
        }[]
      }
      get_business_proposal: { Args: { _token: string }; Returns: Json }
      get_effective_plan_state: { Args: never; Returns: Json }
      get_effective_plan_state_for_user: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_household_owner_id: { Args: never; Returns: string }
      get_household_owner_profile: { Args: never; Returns: Json }
      get_user_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      has_planejamento_360: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_ofx_batch:
        | { Args: { p_account_id: string; p_items: Json }; Returns: Json }
        | {
            Args: { p_account_id: string; p_filename?: string; p_items: Json }
            Returns: Json
          }
      increment_ai_usage: {
        Args: { _daily_limit: number; _usage_date: string }
        Returns: undefined
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      increment_rate_limit: {
        Args: { _minute_key: string; _user_id: string }
        Returns: number
      }
      invoke_smart_notifications: { Args: never; Returns: number }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      is_company_owner: { Args: { _company_id: string }; Returns: boolean }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_owner: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      list_company_members: { Args: { _company_id: string }; Returns: Json }
      peek_invite_token: {
        Args: { _token: string }
        Returns: {
          email: string
          metadata: Json
          source: string
          user_id: string
        }[]
      }
      purge_old_audit_events: {
        Args: { months_to_keep?: number }
        Returns: number
      }
      purge_old_audit_logs: {
        Args: { months_to_keep?: number }
        Returns: number
      }
      purge_old_import_logs: {
        Args: { months_to_keep?: number }
        Returns: number
      }
      purge_old_portfolio_snapshots: {
        Args: { months_to_keep?: number }
        Returns: number
      }
      purge_old_score_snapshots: {
        Args: { months_to_keep?: number }
        Returns: number
      }
      purge_password_resets: { Args: never; Returns: number }
      purge_rate_limits: { Args: never; Returns: number }
      reject_business_proposal: {
        Args: { _motivo: string; _token: string }
        Returns: undefined
      }
      remove_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: Json
      }
      replace_proposal_items: {
        Args: { _items: Json; _proposal_id: string }
        Returns: undefined
      }
      request_business_proposal_change: {
        Args: { _comment: string; _token: string }
        Returns: undefined
      }
      resolve_effective_plan_user_id: { Args: never; Returns: string }
      rollback_ofx_import: { Args: { p_import_id: string }; Returns: Json }
      run_data_retention: { Args: never; Returns: Json }
      update_own_profile: {
        Args: {
          _age?: number
          _currency?: string
          _dependents?: number
          _emoji_casal?: string
          _emoji_geral?: string
          _emoji_pessoa1?: string
          _emoji_pessoa2?: string
          _foto_casal?: string
          _foto_geral?: string
          _foto_pessoa1?: string
          _foto_pessoa2?: string
          _full_name?: string
          _greeting_emoji?: string
          _language?: string
          _marital_status?: string
          _nome_pessoa1?: string
          _nome_pessoa2?: string
          _onboarding_completed?: boolean
          _pessoa2_participa_geral?: boolean
          _phone?: string
          _selected_company_id?: string
          _tema_destaque?: string
          _tema_modo?: string
          _tema_sidebar?: string
          _vinculo_pessoa2?: string
          _weekly_email_day?: number
          _weekly_email_enabled?: boolean
          _weekly_email_hour?: number
          _weekly_email_timezone?: string
        }
        Returns: undefined
      }
      validate_coupon: {
        Args: { coupon_code: string }
        Returns: {
          client_cost_zero: boolean
          client_discount_type: string
          client_discount_value: number
          code: string
          id: string
          is_valid: boolean
          plan_slug: string
          pricing_model: string
          usage_count: number
          usage_limit: number
          valid_from: string
          valid_until: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      plan_tier: "organiza_2026" | "planejamento_360"
      subscription_status:
        | "active"
        | "expired"
        | "grace"
        | "blocked"
        | "canceled"
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
      app_role: ["admin", "user"],
      plan_tier: ["organiza_2026", "planejamento_360"],
      subscription_status: [
        "active",
        "expired",
        "grace",
        "blocked",
        "canceled",
      ],
    },
  },
} as const

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
      accesos: {
        Row: {
          activo: boolean
          creado_en: string
          etiqueta: string
          id: string
          rol: string
          token: string
          ultimo_uso_en: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          etiqueta?: string
          id?: string
          rol: string
          token: string
          ultimo_uso_en?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          etiqueta?: string
          id?: string
          rol?: string
          token?: string
          ultimo_uso_en?: string | null
        }
        Relationships: []
      }
      acreditados_cda: {
        Row: {
          cedula: string
          creado_en: string
          id: string
          email: string
          nombres: string
          orden: number
          parroquia_codigo: number
          preferencia: string
          recinto_codigo: number
          responsable_lider_id: string | null
          telefono: string
          tipo: string
          verificado: boolean
        }
        Insert: {
          cedula: string
          creado_en?: string
          id?: string
          email?: string
          nombres: string
          orden?: number
          parroquia_codigo: number
          preferencia?: string
          recinto_codigo: number
          responsable_lider_id?: string | null
          telefono?: string
          tipo: string
          verificado?: boolean
        }
        Update: {
          cedula?: string
          creado_en?: string
          id?: string
          email?: string
          nombres?: string
          orden?: number
          parroquia_codigo?: number
          preferencia?: string
          recinto_codigo?: number
          responsable_lider_id?: string | null
          telefono?: string
          tipo?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "acreditados_cda_responsable_lider_id_fkey"
            columns: ["responsable_lider_id"]
            isOneToOne: false
            referencedRelation: "lideres"
            referencedColumns: ["id"]
          },
        ]
      }
      canton_base: {
        Row: {
          canton_codigo: number
          geom: unknown
        }
        Insert: {
          canton_codigo: number
          geom: unknown
        }
        Update: {
          canton_codigo?: number
          geom?: unknown
        }
        Relationships: []
      }
      coordinadores: {
        Row: {
          cedula: string
          creado_en: string
          id: string
          email: string
          nombres: string
          orden: number
          parroquia_codigo: number
          preferencia: string
          recinto_codigo: number
          responsable_lider_id: string | null
          telefono: string
          tipo: string
          verificado: boolean
        }
        Insert: {
          cedula: string
          creado_en?: string
          id?: string
          email?: string
          nombres: string
          orden?: number
          parroquia_codigo: number
          preferencia?: string
          recinto_codigo: number
          responsable_lider_id?: string | null
          telefono?: string
          tipo: string
          verificado?: boolean
        }
        Update: {
          cedula?: string
          creado_en?: string
          id?: string
          email?: string
          nombres?: string
          orden?: number
          parroquia_codigo?: number
          preferencia?: string
          recinto_codigo?: number
          responsable_lider_id?: string | null
          telefono?: string
          tipo?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "coordinadores_responsable_lider_id_fkey"
            columns: ["responsable_lider_id"]
            isOneToOne: false
            referencedRelation: "lideres"
            referencedColumns: ["id"]
          },
        ]
      }
      distributivo_cortes: {
        Row: {
          activo: boolean
          archivo: string | null
          creado_en: string
          fecha_corte: string
          fuente: string | null
          id: number
        }
        Insert: {
          activo?: boolean
          archivo?: string | null
          creado_en?: string
          fecha_corte: string
          fuente?: string | null
          id?: never
        }
        Update: {
          activo?: boolean
          archivo?: string | null
          creado_en?: string
          fecha_corte?: string
          fuente?: string | null
          id?: never
        }
        Relationships: []
      }
      eventos_actividad: {
        Row: {
          cedula: string
          creado_en: string
          fecha: string
          id: string
          parroquia_codigo: number
          recinto_codigo: number
          tipo: string
        }
        Insert: {
          cedula: string
          creado_en?: string
          fecha: string
          id?: string
          parroquia_codigo: number
          recinto_codigo: number
          tipo: string
        }
        Update: {
          cedula?: string
          creado_en?: string
          fecha?: string
          id?: string
          parroquia_codigo?: number
          recinto_codigo?: number
          tipo?: string
        }
        Relationships: []
      }
      lideres: {
        Row: {
          ambito: string | null
          cargo: string | null
          cedula: string | null
          creado_en: string
          foto: string | null
          id: string
          nombres: string
          organizacion: string
          parroquia_codigo: number | null
          parroquia_codigos: number[]
          recinto_codigos: number[]
          telefono: string
        }
        Insert: {
          ambito?: string | null
          cargo?: string | null
          cedula?: string | null
          creado_en?: string
          foto?: string | null
          id?: string
          nombres: string
          organizacion?: string
          parroquia_codigo?: number | null
          parroquia_codigos?: number[]
          recinto_codigos?: number[]
          telefono?: string
        }
        Update: {
          ambito?: string | null
          cargo?: string | null
          cedula?: string | null
          creado_en?: string
          foto?: string | null
          id?: string
          nombres?: string
          organizacion?: string
          parroquia_codigo?: number | null
          parroquia_codigos?: number[]
          recinto_codigos?: number[]
          telefono?: string
        }
        Relationships: []
      }
      lista_negra: {
        Row: {
          cedula: string
          creado_en: string
          id: string
          motivo: string | null
          nombres: string
          origen: string
          telefono: string
        }
        Insert: {
          cedula: string
          creado_en?: string
          id?: string
          motivo?: string | null
          nombres: string
          origen: string
          telefono?: string
        }
        Update: {
          cedula?: string
          creado_en?: string
          id?: string
          motivo?: string | null
          nombres?: string
          origen?: string
          telefono?: string
        }
        Relationships: []
      }
      militantes_historial: {
        Row: {
          cambios: Json
          creado_en: string
          id: string
          militante_id: string
          usuario: string
        }
        Insert: {
          cambios: Json
          creado_en?: string
          id?: string
          militante_id: string
          usuario?: string
        }
        Update: {
          cambios?: Json
          creado_en?: string
          id?: string
          militante_id?: string
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "militantes_historial_militante_id_fkey"
            columns: ["militante_id"]
            isOneToOne: false
            referencedRelation: "militantes"
            referencedColumns: ["id"]
          },
        ]
      }
      militantes: {
        Row: {
          cedula: string
          creado_en: string
          id: string
          email: string
          junta_preasignada: string | null
          nombres: string
          parroquia_codigo: number | null
          preferencia: string
          recinto_codigo: number | null
          responsable_lider_id: string | null
          telefono: string
          tipo_preasignado: string | null
        }
        Insert: {
          cedula: string
          creado_en?: string
          id?: string
          email?: string
          junta_preasignada?: string | null
          nombres: string
          parroquia_codigo?: number | null
          preferencia?: string
          recinto_codigo?: number | null
          responsable_lider_id?: string | null
          telefono?: string
          tipo_preasignado?: string | null
        }
        Update: {
          cedula?: string
          creado_en?: string
          id?: string
          email?: string
          junta_preasignada?: string | null
          nombres?: string
          parroquia_codigo?: number | null
          preferencia?: string
          recinto_codigo?: number | null
          responsable_lider_id?: string | null
          telefono?: string
          tipo_preasignado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "militantes_responsable_lider_id_fkey"
            columns: ["responsable_lider_id"]
            isOneToOne: false
            referencedRelation: "lideres"
            referencedColumns: ["id"]
          },
        ]
      }
      parroquias: {
        Row: {
          canton_codigo: number
          codigo: number
          etiqueta: unknown
          geom: unknown
          nombre: string
          nombre_corto: string | null
          urbana: boolean
        }
        Insert: {
          canton_codigo: number
          codigo: number
          etiqueta: unknown
          geom: unknown
          nombre: string
          nombre_corto?: string | null
          urbana?: boolean
        }
        Update: {
          canton_codigo?: number
          codigo?: number
          etiqueta?: unknown
          geom?: unknown
          nombre?: string
          nombre_corto?: string | null
          urbana?: boolean
        }
        Relationships: []
      }
      recintos: {
        Row: {
          actualizado_en: string
          cda: boolean
          codigo_cne: number
          corte_id: number
          dificil_acceso: boolean
          direccion: string | null
          electores: number
          fem_fin: number | null
          fem_ini: number | null
          geom: unknown
          jun_fem: number
          jun_mas: number
          mas_fin: number | null
          mas_ini: number | null
          nombre: string
          nota: string | null
          parroquia_codigo: number
          sin_conectividad: boolean
          telefono: string | null
          total_juntas: number
          visible: boolean
          zona: string | null
        }
        Insert: {
          actualizado_en?: string
          cda?: boolean
          codigo_cne: number
          corte_id: number
          dificil_acceso?: boolean
          direccion?: string | null
          electores?: number
          fem_fin?: number | null
          fem_ini?: number | null
          geom: unknown
          jun_fem?: number
          jun_mas?: number
          mas_fin?: number | null
          mas_ini?: number | null
          nombre: string
          nota?: string | null
          parroquia_codigo: number
          sin_conectividad?: boolean
          telefono?: string | null
          total_juntas?: number
          visible?: boolean
          zona?: string | null
        }
        Update: {
          actualizado_en?: string
          cda?: boolean
          codigo_cne?: number
          corte_id?: number
          dificil_acceso?: boolean
          direccion?: string | null
          electores?: number
          fem_fin?: number | null
          fem_ini?: number | null
          geom?: unknown
          jun_fem?: number
          jun_mas?: number
          mas_fin?: number | null
          mas_ini?: number | null
          nombre?: string
          nota?: string | null
          parroquia_codigo?: number
          sin_conectividad?: boolean
          telefono?: string | null
          total_juntas?: number
          visible?: boolean
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recintos_corte_id_fkey"
            columns: ["corte_id"]
            isOneToOne: false
            referencedRelation: "distributivo_cortes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recintos_parroquia_codigo_fkey"
            columns: ["parroquia_codigo"]
            isOneToOne: false
            referencedRelation: "parroquias"
            referencedColumns: ["codigo"]
          },
        ]
      }
      veedores: {
        Row: {
          cedula: string
          creado_en: string
          id: string
          junta_id: string
          email: string
          nombres: string
          orden: number
          parroquia_codigo: number
          preferencia: string
          recinto_codigo: number
          responsable_lider_id: string | null
          telefono: string
          tipo: string
          verificado: boolean
        }
        Insert: {
          cedula: string
          creado_en?: string
          id?: string
          junta_id: string
          email?: string
          nombres: string
          orden?: number
          parroquia_codigo: number
          preferencia?: string
          recinto_codigo: number
          responsable_lider_id?: string | null
          telefono?: string
          tipo: string
          verificado?: boolean
        }
        Update: {
          cedula?: string
          creado_en?: string
          id?: string
          junta_id?: string
          email?: string
          nombres?: string
          orden?: number
          parroquia_codigo?: number
          preferencia?: string
          recinto_codigo?: number
          responsable_lider_id?: string | null
          telefono?: string
          tipo?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "veedores_responsable_lider_id_fkey"
            columns: ["responsable_lider_id"]
            isOneToOne: false
            referencedRelation: "lideres"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activar_corte: {
        Args: { p_archivo: string; p_fecha_corte: string; p_fuente: string }
        Returns: number
      }
      agregar_acreditado_cda: {
        Args: {
          p_cedula: string
          p_email?: string
          p_nombres: string
          p_parroquia_codigo: number
          p_preferencia?: string
          p_recinto_codigo: number
          p_responsable_lider_id?: string
          p_telefono: string
          p_tipo: string
        }
        Returns: {
          cedula: string
          creado_en: string
          email: string
          preferencia: string
          id: string
          nombres: string
          orden: number
          parroquia_codigo: number
          recinto_codigo: number
          responsable_lider_id: string | null
          telefono: string
          tipo: string
          verificado: boolean
        }
        SetofOptions: {
          from: "*"
          to: "acreditados_cda"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agregar_coordinador: {
        Args: {
          p_cedula: string
          p_email?: string
          p_nombres: string
          p_parroquia_codigo: number
          p_preferencia?: string
          p_recinto_codigo: number
          p_responsable_lider_id?: string
          p_telefono: string
          p_tipo: string
        }
        Returns: {
          cedula: string
          creado_en: string
          email: string
          preferencia: string
          id: string
          nombres: string
          orden: number
          parroquia_codigo: number
          recinto_codigo: number
          responsable_lider_id: string | null
          telefono: string
          tipo: string
          verificado: boolean
        }
        SetofOptions: {
          from: "*"
          to: "coordinadores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agregar_veedor: {
        Args: {
          p_cedula: string
          p_email?: string
          p_junta_id: string
          p_nombres: string
          p_parroquia_codigo: number
          p_preferencia?: string
          p_recinto_codigo: number
          p_responsable_lider_id?: string
          p_telefono: string
          p_tipo: string
        }
        Returns: {
          cedula: string
          creado_en: string
          email: string
          preferencia: string
          id: string
          junta_id: string
          nombres: string
          orden: number
          parroquia_codigo: number
          recinto_codigo: number
          responsable_lider_id: string | null
          telefono: string
          tipo: string
          verificado: boolean
        }
        SetofOptions: {
          from: "*"
          to: "veedores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cargar_canton_base: {
        Args: { p_canton_codigo: number; p_geojson: string }
        Returns: undefined
      }
      cargar_parroquia: {
        Args: {
          p_canton_codigo: number
          p_codigo: number
          p_geojson: string
          p_lx: number
          p_ly: number
          p_nombre: string
          p_urbana: boolean
        }
        Returns: undefined
      }
      cargar_recinto: {
        Args: {
          p_cda: boolean
          p_codigo_cne: number
          p_corte_id: number
          p_dificil_acceso: boolean
          p_direccion: string
          p_electores: number
          p_fem_fin: number
          p_fem_ini: number
          p_jun_fem: number
          p_jun_mas: number
          p_lat: number
          p_lon: number
          p_mas_fin: number
          p_mas_ini: number
          p_nombre: string
          p_parroquia_codigo: number
          p_sin_conectividad: boolean
          p_telefono: string
          p_total_juntas: number
          p_zona: string
        }
        Returns: undefined
      }
      desvincular_acreditado_cda: {
        Args: { p_id: string; p_lista_negra?: boolean; p_motivo: string }
        Returns: undefined
      }
      desvincular_coordinador: {
        Args: { p_id: string; p_lista_negra?: boolean; p_motivo: string }
        Returns: undefined
      }
      desvincular_veedor: {
        Args: { p_id: string; p_lista_negra?: boolean; p_motivo: string }
        Returns: undefined
      }
      get_mapa: { Args: { canton: number }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

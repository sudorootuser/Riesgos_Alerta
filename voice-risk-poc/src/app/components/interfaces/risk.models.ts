// Para la lógica interna de la app (GPS, Navegación, Servicios)
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RiskEvidence {
  id: string;
  risk_report_id: string;
  evidence_type_id: string; // 'PHOTO' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  file_name: string;
  file_url: string; // Base64
  mime_type: string;
  file_size: number; // en bytes
  captured_date: string;
  latitude: number;
  longitude: number;
}

export const EVIDENCE_TYPE_CATALOG = {
  PHOTO: { id: 'ev-001', code: 'PHOTO', name: 'Fotografía', accept: 'image/*', icon: '📷' },
  VIDEO: { id: 'ev-002', code: 'VIDEO', name: 'Video', accept: 'video/*', icon: '🎥' },
  AUDIO: { id: 'ev-003', code: 'AUDIO', name: 'Audio', accept: 'audio/*', icon: '🎵' },
  DOCUMENT: {
    id: 'ev-004',
    code: 'DOCUMENT',
    name: 'Documento',
    accept: '.pdf,.doc,.docx,.txt',
    icon: '📄',
  },
};

// Actualiza RiskReport para incluir los nuevos campos
export interface RiskReport {
  id: string;
  risk_type_id: string;
  risk_status_id: string;
  risk_level_id: string;
  risk_type_reporter_id: string;
  risk_type_coordinate_id: string;

  title: string;
  description: string;
  latitude: number;
  longitude: number;
  jsonCoordinate: CoordinatePoint[];
  direccion: string;
  audio_url?: string;

  user_name: string;
  report_date: string;
  evidences: RiskEvidence[];

  created_at: string;
  updated_at?: string;
  sync_status: 'pending' | 'synced' | 'error' | 'retry_ia';
  backend_response?: any;

  ia_process?: {
    original_audio?: string;
    transcript: string;
    ia_response?: any;
    retry_count: number;
  };
}

// Para la estructura de la base de datos (jsonCoordinate)
export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export interface RiskReport {
  id: string;
  risk_type_id: string;
  risk_status_id: string;
  risk_level_id: string;
  risk_type_reporter_id: string;
  risk_type_coordinate_id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  jsonCoordinate: CoordinatePoint[];
  direccion: string;
  audio_url?: string;

  user_name: string;
  report_date: string;
  evidences: RiskEvidence[];

  created_at: string;
  updated_at?: string;
  sync_status: 'pending' | 'synced' | 'error' | 'retry_ia';
  backend_response?: any;
  ia_process?: {
    original_audio?: string;
    transcript: string;
    ia_response?: any;
    retry_count: number;
  };
}

export interface DrawingState {
  mode: 'point' | 'polygon' | null;
  tempPoints: CoordinatePoint[];
}

// =====================================================
// CATÁLOGOS MAESTROS (Opción A: Hardcoded para Demo)
// =====================================================
export const RISK_TYPE_CATALOG: Record<string, { id: string; code: string; name: string }> = {
  INVASION_TERRITORIAL: {
    id: 'type-001',
    code: 'INVASION_TERRITORIAL',
    name: 'Invasión Territorial',
  },
  INVASION_ZONA_PROTEGIDA: {
    id: 'type-002',
    code: 'INVASION_ZONA_PROTEGIDA',
    name: 'Invasión Zona Protegida',
  },
  OCUPACION_ESPACIO_PUBLICO: {
    id: 'type-003',
    code: 'OCUPACION_ESPACIO_PUBLICO',
    name: 'Ocupación del Espacio Público',
  },
  RIESGO_AMBIENTAL: { id: 'type-004', code: 'RIESGO_AMBIENTAL', name: 'Riesgo Ambiental' },
  RIESGO_INFRAESTRUCTURA: {
    id: 'type-005',
    code: 'RIESGO_INFRAESTRUCTURA',
    name: 'Riesgo de Infraestructura',
  },
  RIESGO_SEGURIDAD: { id: 'type-006', code: 'RIESGO_SEGURIDAD', name: 'Riesgo de Seguridad' },
  RIESGO_SANITARIO: { id: 'type-007', code: 'RIESGO_SANITARIO', name: 'Riesgo Sanitario' },
};

export const RISK_LEVEL_CATALOG: Record<
  string,
  { id: string; code: string; name: string; priority: number }
> = {
  BAJO: { id: 'level-001', code: 'BAJO', name: 'Bajo', priority: 1 },
  MEDIO: { id: 'level-002', code: 'MEDIO', name: 'Medio', priority: 2 },
  ALTO: { id: 'level-003', code: 'ALTO', name: 'Alto', priority: 3 },
  CRITICO: { id: 'level-004', code: 'CRITICO', name: 'Crítico', priority: 4 },
};

export const RISK_STATUS_CATALOG = {
  REPORTED: { id: 'status-001', code: 'REPORTED', name: 'Reportado', color: '#3498DB' },
  ASSIGNED: { id: 'status-002', code: 'ASSIGNED', name: 'Asignado', color: '#9B59B6' },
  IN_PROGRESS: { id: 'status-003', code: 'IN_PROGRESS', name: 'En Progreso', color: '#F39C12' },
  CLOSED: { id: 'status-004', code: 'CLOSED', name: 'Cerrado', color: '#2ECC71' },
};

export const RISK_REPORTER_CATALOG = {
  FORM: { id: 'reporter-001', code: 'FORM', name: 'Formulario Manual' },
  ASSISTANT: { id: 'reporter-002', code: 'ASSISTANT', name: 'Asistente IA' },
};

export const RISK_COORDINATE_CATALOG = {
  POINT: { id: 'coord-001', code: 'POINT', name: 'Punto' },
  POLYGON: { id: 'coord-002', code: 'POLYGON', name: 'Polígono' },
};

export interface DrawingState {
  mode: 'point' | 'polygon' | null;
  tempPoints: CoordinatePoint[];
}

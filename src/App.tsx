// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Hammer, 
  Monitor, 
  MapPin, 
  Building, 
  ChevronRight, 
  Send, 
  History, 
  PlusCircle, 
  Trash2,
  Clock,
  Tag,
  Lock,
  Unlock,
  Filter,
  X,
  Camera,
  Search,
  BarChart3,
  FileText,
  Image as ImageIcon,
  Download,
  User,
  Tv,
  Eye,
  RefreshCcw,
  Check,
  RotateCcw,
  Video,
  Link as LinkIcon,
  QrCode,
  Sparkles,
  Wrench,
  Wifi,
  ShieldCheck,
  ArrowLeft,
  ChevronDown,
  Copy,
  Layers
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  Timestamp
} from "firebase/firestore";

// --- Tipos e Interfaces ---
type CategoryType = 'maintenance' | 'it' | '';
type PriorityType = 'normal' | 'urgente';
type IncidentStatus = 'pending' | 'resolved';
type TabType = 'new' | 'list' | 'stats';

interface IncidentFormData {
  category: CategoryType;
  building: string;
  floor: string;
  room: string;
  description: string;
  priority: PriorityType;
  imageData: string | null;
  reporterName: string;
}

interface Incident extends IncidentFormData {
  id: string;
  status: IncidentStatus;
  createdAt?: Timestamp | { seconds: number; nanoseconds?: number } | null;
  resolvedAt?: Timestamp | { seconds: number; nanoseconds?: number } | null;
  resolutionNote?: string | null;
  authorId?: string;
}

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyCVmrdGbTN6q5o_-DMTS679_X66iDiQW8c",
  authDomain: "incidencias-colegio.firebaseapp.com",
  projectId: "incidencias-colegio",
  storageBucket: "incidencias-colegio.firebasestorage.app",
  messagingSenderId: "1097693863914",
  appId: "1:1097693863914:web:186fea8c5bd11c9cad5c93"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'datos_colegio';

// --- Versión de la App ---
const APP_VERSION = 'v5.0';

// --- UTILIDAD: Compresor de Imágenes ---
const compressImage = (base64Str: string, maxWidth = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- Datos Estáticos ---
const BUILDINGS = [
  "Pabellón Principal (Portería, Dirección, Bach.)",
  "Pabellón 1 (3º y 4º ESO)",
  "Pabellón 2 (1º y 2º ESO)",
  "Pabellón 3 (5 años, 1º y 2º EP)",
  "Pirámide (3º-6º EP)",
  "Pabellón 3 y 4 años",
  "Otros Espacios Comunes"
];

const BUILDING_METADATA: Record<string, { shortTitle: string; subtitle: string; badge: string }> = {
  "Pabellón Principal (Portería, Dirección, Bach.)": {
    shortTitle: "Pabellón Principal",
    subtitle: "Portería, Dirección, Orientación y Bachillerato",
    badge: "Bach. / Admin"
  },
  "Pabellón 1 (3º y 4º ESO)": {
    shortTitle: "Pabellón 1",
    subtitle: "3º y 4º ESO, Sala Chromebook y Diversificación",
    badge: "3º - 4º ESO"
  },
  "Pabellón 2 (1º y 2º ESO)": {
    shortTitle: "Pabellón 2",
    subtitle: "1º y 2º ESO, Desdobles y Diversificación",
    badge: "1º - 2º ESO"
  },
  "Pabellón 3 (5 años, 1º y 2º EP)": {
    shortTitle: "Pabellón 3",
    subtitle: "Infantil 5 años, 1º y 2º de Educación Primaria",
    badge: "5 años / 1º-2º EP"
  },
  "Pirámide (3º-6º EP)": {
    shortTitle: "Edificio Pirámide",
    subtitle: "1ª Pl: 3º EP, 4ºA/C y Esp. • 2ª Pl: 4ºB, PT, 5º y 6º EP",
    badge: "3º - 6º EP"
  },
  "Pabellón 3 y 4 años": {
    shortTitle: "Pabellón Infantil",
    subtitle: "Educación Infantil de 3 y 4 años",
    badge: "3 y 4 años"
  },
  "Otros Espacios Comunes": {
    shortTitle: "Espacios Comunes",
    subtitle: "Salón de Actos, Comedor, Patios, Gimnasios, Sala Prof...",
    badge: "Zonas Comunes"
  }
};

const COMMON_SPACES_LIST = [
  "Salón de Actos",
  "Iglesia",
  "Patio Delantero",
  "Patios Cubiertos",
  "Comedor",
  "Tatami",
  "Sala de Psicomotricidad",
  "Enfermería",
  "Sala de Profesores",
  "Gimnasio",
  "Gimnasio bajo la piscina",
  "Parque infantil",
  "Campo de pádel",
  "Otro"
];

const FLOORS = ["Planta Baja", "1ª Planta", "2ª Planta"];

const COMMON_ISSUES: Record<'maintenance' | 'it', string[]> = {
  maintenance: [
    "Luz fundida",
    "Interruptor roto",
    "Persiana rota",
    "Puerta no cierra bien",
    "Azulejo roto",
    "Radiador gotea",
    "Pizarra en mal estado",
    "Mobiliario roto (silla/mesa)",
    "Cristal roto",
    "Moho en la pared",
    "Grifo goteando/roto",
    "Cisterna averiada",
    "Desagüe/WC atascado"
  ],
  it: [
    "Proyector no enciende",
    "Televisor no enciende",
    "Televisor sin audio",
    "Televisor sin señal / HDMI falla",
    "No hay internet / Wifi",
    "Ordenador no arranca",
    "No hay sonido (PC)",
    "Adaptador pantalla falla",
    "Ratón/Teclado no funciona",
    "Pantalla negra",
    "Impresora sin tóner/papel",
    "No puedo iniciar sesión"
  ]
};

// Función auxiliar para formatear fechas
const formatDate = (timestamp?: { seconds: number } | null): string => {
  if (!timestamp?.seconds) return '';
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Función auxiliar para tiempo relativo
const getRelativeTime = (timestamp?: { seconds: number } | null): string => {
  if (!timestamp?.seconds) return 'Reciente';
  const now = new Date();
  const date = new Date(timestamp.seconds * 1000);
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return 'Hace un momento';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Ayer';
  if (diffInDays < 7) return `Hace ${diffInDays} días`;
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Función auxiliar para obtener las aulas según edificio y planta
const getRoomsForBuildingAndFloor = (building: string, floor: string): string[] => {
  if (building === "Otros Espacios Comunes") return COMMON_SPACES_LIST;

  // 2. Pabellón Principal (Portería, Dirección, Bach.)
  if (building === "Pabellón Principal (Portería, Dirección, Bach.)") {
    if (floor === "Planta Baja") {
      return [
        "1º BTO A", "1º BTO B",
        "Orientación",
        "Portería", "Dirección", "Pastoral",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "1ª Planta") {
      return [
        "2º BTO A", "2º BTO B",
        "Aula Auxiliar", "Tutoría",
        "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "2ª Planta") {
      return [
        "Laboratorio", "Pasillo / Baños", "Otro"
      ];
    }
  }

  // 3. Pabellón 1 (3º y 4º ESO)
  if (building === "Pabellón 1 (3º y 4º ESO)") {
    if (floor === "Planta Baja") {
      return [
        "Sala Chromebook", "Clase de Diversificación",
        "Sala Múltiple", "Tutoría",
        "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "1ª Planta") {
      return [
        "4º ESO A", "4º ESO B", "4º ESO C",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "2ª Planta") {
      return [
        "3º ESO A", "3º ESO B", "3º ESO C",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
  }

  // 4. Pabellón 2 (1º y 2º ESO)
  if (building === "Pabellón 2 (1º y 2º ESO)") {
    if (floor === "Planta Baja") {
      return [
        "Aula Diversificación", "Aula Desdoble 1", "Aula Desdoble 2",
        "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "1ª Planta") {
      return [
        "2º ESO A", "2º ESO B", "2º ESO C",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "2ª Planta") {
      return [
        "1º ESO A", "1º ESO B", "1º ESO C",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
  }

  // 5. Pabellón 3 (5 años, 1º y 2º EP)
  if (building === "Pabellón 3 (5 años, 1º y 2º EP)") {
    if (floor === "Planta Baja") {
      return [
        "5 años A", "5 años B", "5 años C",
        "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "1ª Planta") {
      return [
        "1º EP A", "1º EP B", "1º EP C",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "2ª Planta") {
      return [
        "2º EP A", "2º EP B", "2º EP C",
        "Tutoría", "Pasillo / Baños", "Otro"
      ];
    }
  }

  // 6. Pirámide (3º-6º EP) -> Actualizado:
  // 1ª Planta: todo 3º, 4ºA y 4ºC (+ aulas específicas)
  // 2ª Planta: 4ºB, Sala PT y todo 5º y 6º
  if (building === "Pirámide (3º-6º EP)") {
    if (floor === "1ª Planta") {
      return [
        "3º EP A", "3º EP B", "3º EP C",
        "4º EP A", "4º EP C", 
        "Sala de Robótica", "Laboratorio", "Sala de Música",
        "Pasillo / Baños", "Otro"
      ];
    }
    if (floor === "2ª Planta") {
      return [
        "4º EP B", "Sala PT",
        "5º EP A", "5º EP B", "5º EP C",
        "6º EP A", "6º EP B", "6º EP C",
        "Pasillo / Baños", "Otro"
      ];
    }
  }

  // 7. Pabellón 3 y 4 años
  if (building === "Pabellón 3 y 4 años") {
    if (floor === "Planta Baja") {
      return [
        "3 años A", "3 años B", "3 años C", 
        "Otro"
      ];
    }
    if (floor === "1ª Planta") {
      return [
        "4 años A", "4 años B", "4 años C",
        "Pasillo / Baños", "Otro"
      ];
    }
  }

  return ["Aula A", "Aula B", "Aula C", "Tutoría", "Pasillo / Baños", "Otro"];
};

// --- Componente de Cámara Integrada ---
interface CameraModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (showIntro || capturedImage) {
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false
        });
        if (!isMounted) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err) {
        console.error("Error cámara:", err);
        if (isMounted) {
          setError("No se pudo acceder a la cámara. Asegúrate de permitir el acceso en tu navegador.");
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCurrentStream();
    };
  }, [showIntro, capturedImage, stopCurrentStream]);

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    
    const MAX_WIDTH = 800;
    let width = videoRef.current.videoWidth || 800;
    let height = videoRef.current.videoHeight || 600;

    if (width > MAX_WIDTH) {
      height = (height * MAX_WIDTH) / width;
      width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    
    stopCurrentStream();
    setCapturedImage(dataUrl);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleClose = () => {
    stopCurrentStream();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col items-center justify-center animate-in fade-in duration-200">
      {showIntro && !error && !capturedImage && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className="bg-slate-900 p-7 rounded-3xl border border-slate-800 max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-950/60">
              <Video size={30} className="text-white" />
            </div>
            <h3 className="text-white font-extrabold text-xl mb-2.5">Modo Cámara en Vivo</h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              Enfoca la avería o incidencia en pantalla y pulsa el disparador central para <strong>congelar y adjuntar la imagen</strong> comprimida automáticamente.
            </p>
            <div className="space-y-2.5">
              <button 
                type="button"
                onClick={() => setShowIntro(false)}
                className="w-full py-3.5 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all shadow-lg active:scale-95"
              >
                Activar cámara
              </button>
              <button 
                type="button"
                onClick={handleClose}
                className="w-full py-3 text-slate-400 font-semibold hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="text-white p-6 text-center max-w-sm">
          <AlertCircle size={44} className="text-rose-400 mx-auto mb-3" />
          <p className="mb-5 text-rose-200 text-sm leading-relaxed">{error}</p>
          <button type="button" onClick={handleClose} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-semibold">Cerrar</button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col">
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {capturedImage ? (
              <img src={capturedImage} alt="Captura previa" className="w-full h-full object-contain" />
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover" 
              />
            )}
          </div>
          
          {!showIntro && (
            <div className="p-6 bg-slate-950/90 backdrop-blur-md flex justify-center items-center gap-10 pb-10 border-t border-white/10">
              {capturedImage ? (
                <>
                  <button 
                    type="button"
                    onClick={retakePhoto}
                    className="flex flex-col items-center gap-1.5 text-white opacity-85 hover:opacity-100"
                  >
                    <div className="p-3.5 rounded-full bg-slate-800 border border-slate-700">
                      <RotateCcw size={22} />
                    </div>
                    <span className="text-xs font-medium">Repetir</span>
                  </button>

                  <button 
                    type="button"
                    onClick={confirmPhoto}
                    className="flex flex-col items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transform hover:scale-105 transition-all"
                  >
                    <div className="p-4 rounded-full bg-white shadow-lg">
                      <Check size={30} className="text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold">Usar foto</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={handleClose} 
                    className="absolute left-6 text-white/80 hover:text-white px-3 py-2 rounded-xl bg-white/5"
                  >
                    <span className="text-sm font-semibold">Cancelar</span>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={takePhoto} 
                    className="p-1.5 rounded-full border-4 border-white transition-transform active:scale-90 shadow-xl"
                    aria-label="Capturar foto"
                  >
                    <div className="w-16 h-16 bg-white rounded-full"></div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Indicador de Pasos (Stepper) ---
interface StepperProps {
  currentStep: number;
  formData: IncidentFormData;
  onGoToStep: (step: number) => void;
}

const Stepper: React.FC<StepperProps> = ({ currentStep, formData, onGoToStep }) => {
  if (currentStep === 4) return null;

  const steps = [
    { num: 1, label: "Categoría", done: Boolean(formData.category) },
    { num: 2, label: "Ubicación", done: Boolean(formData.building && formData.room) },
    { num: 3, label: "Detalles", done: Boolean(formData.description && formData.reporterName) }
  ];

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between relative">
        {/* Línea de fondo */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0 mx-8" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-600 -z-0 mx-8 transition-all duration-500"
          style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '42%' : '84%' }}
        />

        {steps.map((s) => {
          const isActive = currentStep === s.num;
          const isCompleted = currentStep > s.num;
          const canClick = s.num < currentStep || (s.num === 2 && Boolean(formData.category));

          return (
            <button
              key={s.num}
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onGoToStep(s.num)}
              className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-4 ring-indigo-50'
                  : isCompleted
                  ? 'bg-emerald-600 text-white shadow-sm cursor-pointer hover:bg-emerald-700'
                  : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                isActive ? 'bg-white/20 text-white' : isCompleted ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {isCompleted ? <Check size={12} /> : s.num}
              </span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Paso 1: Categoría ---
interface StepCategoryProps {
  formData: IncidentFormData;
  incidents: Incident[];
  onSelectCategory: (category: 'maintenance' | 'it') => void;
  onEditPreselectedLocation: () => void;
}

const StepCategory: React.FC<StepCategoryProps> = ({
  formData,
  incidents,
  onSelectCategory,
  onEditPreselectedLocation
}) => {
  const hasPreselectedLocation = Boolean(formData.building && formData.room);
  const pendingCount = incidents.filter(i => i.status === 'pending').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-1.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
          <Sparkles size={12} /> Parte Rápido de Incidencias
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">¿Qué tipo de avería quieres reportar?</h2>
        <p className="text-sm text-slate-500">Selecciona el departamento para dirigir el aviso directamente</p>
      </div>

      {hasPreselectedLocation && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <QrCode size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Aula detectada por código QR</div>
              <div className="text-sm font-bold text-slate-900 truncate">
                {BUILDING_METADATA[formData.building]?.shortTitle || formData.building}
                {formData.floor && formData.floor !== 'N/A' ? ` • ${formData.floor}` : ''} • <span className="text-indigo-700">{formData.room}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onEditPreselectedLocation}
            className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition-colors shrink-0 shadow-2xs"
          >
            Cambiar aula
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tarjeta Mantenimiento */}
        <button
          type="button"
          onClick={() => onSelectCategory('maintenance')}
          className="group relative overflow-hidden p-6 bg-gradient-to-br from-amber-50/90 via-orange-50/60 to-white border-2 border-orange-200/80 hover:border-orange-400 rounded-3xl flex flex-col justify-between text-left transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-orange-400/10 rounded-full blur-2xl group-hover:bg-orange-400/20 transition-all" />
          
          <div className="flex items-start justify-between w-full mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Hammer size={28} />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100/80 px-2.5 py-1 rounded-full">
              Instalaciones <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-1 group-hover:text-orange-950">Mantenimiento</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Desperfectos físicos en aulas, mobiliario, electricidad, fontanería, puertas, persianas o climatización.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Luces", "Persianas", "Mobiliario", "Puertas", "Baños/Agua"].map(tag => (
                <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-white/90 text-orange-800 border border-orange-200/60">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>

        {/* Tarjeta Informática */}
        <button
          type="button"
          onClick={() => onSelectCategory('it')}
          className="group relative overflow-hidden p-6 bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-white border-2 border-blue-200/80 hover:border-blue-400 rounded-3xl flex flex-col justify-between text-left transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-blue-400/10 rounded-full blur-2xl group-hover:bg-blue-400/20 transition-all" />

          <div className="flex items-start justify-between w-full mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Monitor size={28} />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-full">
              TIC / Equipos <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-1 group-hover:text-blue-950">Informática y TIC</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Averías en ordenadores, pantallas interactivas, proyectores, sonido, conectividad WiFi o impresoras.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Televisores", "Ordenadores", "WiFi / Red", "Audio / HDMI", "Proyectores"].map(tag => (
                <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-white/90 text-blue-800 border border-blue-200/60">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Resumen de estado en vivo */}
      <div className="pt-2">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Estado del servicio en tiempo real</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
              {pendingCount} pendientes
            </span>
            <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
              {resolvedCount} resueltas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Paso 2: Ubicación ---
interface StepLocationProps {
  formData: IncidentFormData;
  updateForm: <K extends keyof IncidentFormData>(field: K, value: IncidentFormData[K]) => void;
  handleNext: () => void;
  handleBack: () => void;
}

const StepLocation: React.FC<StepLocationProps> = ({ formData, updateForm, handleNext, handleBack }) => {
  const isCommonSpace = formData.building === "Otros Espacios Comunes";

  const selectBuilding = (val: string) => {
    if (val === "Otros Espacios Comunes") {
      updateForm('building', val);
      updateForm('floor', 'N/A');
      updateForm('room', '');
    } else if (val === "Pirámide (3º-6º EP)") {
      updateForm('building', val);
      updateForm('floor', '1ª Planta');
      updateForm('room', '');
    } else {
      updateForm('building', val);
      updateForm('floor', 'Planta Baja');
      updateForm('room', '');
    }
  };

  const availableFloors = useMemo(() => {
    if (formData.building === "Pabellón 3 y 4 años") {
      return ["Planta Baja", "1ª Planta"];
    }
    if (formData.building === "Pirámide (3º-6º EP)") {
      return ["1ª Planta", "2ª Planta"];
    }
    return FLOORS;
  }, [formData.building]);

  const availableRooms = useMemo(() => {
    return getRoomsForBuildingAndFloor(formData.building, formData.floor);
  }, [formData.building, formData.floor]);

  const canContinue = isCommonSpace
    ? Boolean(formData.building && formData.room)
    : Boolean(formData.building && formData.floor && formData.room);

  const handleSelectRoom = (r: string) => {
    updateForm('room', r);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">¿Dónde está la incidencia?</h2>
          <p className="text-xs text-slate-500 mt-0.5">Selecciona el edificio, planta y aula o espacio</p>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-3 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft size={14} /> Categoría
        </button>
      </div>

      {/* 1. Selector visual de Edificio */}
      <div className="space-y-2.5">
        <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
          <Building size={13} className="text-indigo-600" /> 1. Edificio o Pabellón
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {BUILDINGS.map((b) => {
            const meta = BUILDING_METADATA[b] || { shortTitle: b, subtitle: '', badge: '' };
            const isSelected = formData.building === b;
            return (
              <button
                type="button"
                key={b}
                onClick={() => selectBuilding(b)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-200'
                    : 'bg-slate-50/70 hover:bg-white text-slate-800 border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
                } ${b === "Otros Espacios Comunes" ? 'sm:col-span-2' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-bold text-sm leading-snug">{meta.shortTitle}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {meta.badge}
                  </span>
                </div>
                <span className={`text-[11px] leading-tight ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {meta.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selector de Planta */}
      {formData.building && !isCommonSpace && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            <Layers size={13} className="text-indigo-600" /> 2. Planta
          </label>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60">
            {availableFloors.map(f => {
              const active = formData.floor === f;
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => {
                    updateForm('floor', f);
                    updateForm('room', '');
                  }}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all ${
                    active
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Selector de Aula / Espacio */}
      {(isCommonSpace || formData.floor) && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            <MapPin size={13} className="text-indigo-600" /> {isCommonSpace ? '2. Espacio Común' : '3. Aula o Espacio'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableRooms.map(r => {
              const active = formData.room === r;
              return (
                <button
                  type="button"
                  key={r}
                  onClick={() => handleSelectRoom(r)}
                  className={`p-3 text-xs font-bold border rounded-xl transition-all flex items-center justify-between gap-1.5 text-left ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                      : 'bg-white hover:bg-indigo-50/40 text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <span className="truncate">{r}</span>
                  {active && <Check size={14} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={handleBack}
          className="px-5 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl disabled:opacity-40 font-bold text-sm shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 transition-all"
        >
          Continuar a Detalles <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// --- Paso 3: Detalles ---
interface StepDetailsProps {
  formData: IncidentFormData;
  updateForm: <K extends keyof IncidentFormData>(field: K, value: IncidentFormData[K]) => void;
  handleBack: () => void;
  goToStep: (step: number) => void;
  handleSubmit: () => void;
  isSubmitting: boolean;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  submitError: string | null;
}

const StepDetails: React.FC<StepDetailsProps> = ({
  formData,
  updateForm,
  handleBack,
  goToStep,
  handleSubmit,
  isSubmitting,
  handleImageUpload,
  submitError
}) => {
  const issues = formData.category ? (COMMON_ISSUES[formData.category] || []) : [];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleQuickTag = (text: string) => updateForm('description', text);

  const onCameraCapture = (imgBase64: string) => {
    updateForm('imageData', imgBase64);
    setShowCamera(false);
  };

  const isIT = formData.category === 'it';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {showCamera && <CameraModal onCapture={onCameraCapture} onClose={() => setShowCamera(false)} />}

      {/* Resumen superior de Categoría y Ubicación */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => goToStep(1)}
            className={`text-xs px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 border shadow-2xs transition-transform active:scale-95 ${
              isIT
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-orange-500 text-white border-orange-500'
            }`}
            title="Pulsa para cambiar categoría"
          >
            {isIT ? <Monitor size={13} /> : <Hammer size={13} />}
            {isIT ? 'Informática' : 'Mantenimiento'}
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-3 py-1 rounded-xl border border-slate-200">
            <MapPin size={13} className="text-indigo-600 shrink-0" />
            <span className="truncate">
              {BUILDING_METADATA[formData.building]?.shortTitle || formData.building}
              {formData.floor && formData.floor !== 'N/A' && ` • ${formData.floor}`} • <strong className="text-indigo-700">{formData.room}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => goToStep(2)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors shrink-0"
        >
          Cambiar aula
        </button>
      </div>

      {/* Selección rápida de problemas frecuentes */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-500">
            <span>Averías frecuentes (pulsa para rellenar)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {issues.map(i => {
              const selected = formData.description === i;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => handleQuickTag(i)}
                  className={`text-xs px-3 py-1.5 border rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                    selected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30'
                  }`}
                >
                  {selected && <Check size={12} />}
                  {i}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Descripción detallada */}
      <div className="space-y-1.5">
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Descripción de la avería <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateForm('description', e.target.value)}
          placeholder="Describe brevemente qué ocurre (ej: el proyector parpadea en rojo, la persiana derecha se ha atascado...)"
          className="w-full h-24 p-3.5 bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl resize-none text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
        />
      </div>

      {/* Evidencia y Nombre del profesor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Foto / Evidencia (Opcional)
          </label>
          {!formData.imageData ? (
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center justify-center gap-2 px-3 py-3 bg-indigo-50/80 border border-indigo-200 text-indigo-700 rounded-2xl text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                <Camera size={16} />
                Hacer Foto
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <ImageIcon size={16} />
                Subir Galería
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <img src={formData.imageData} alt="Vista previa" className="h-12 w-12 object-cover rounded-xl border border-emerald-300 shadow-2xs" />
                <div>
                  <div className="text-xs font-bold text-emerald-900">Imagen adjuntada</div>
                  <div className="text-[11px] text-emerald-700">Comprimida y lista para enviar</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateForm('imageData', null)}
                className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors"
                title="Quitar imagen"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
        
        <div className="space-y-2">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Reportado por <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tu nombre (se recordará)" 
              value={formData.reporterName} 
              onChange={(e) => updateForm('reporterName', e.target.value)} 
              className={`w-full pl-10 pr-3 py-3 border rounded-2xl text-sm font-medium bg-slate-50/70 focus:bg-white outline-none focus:ring-4 transition-all ${
                !formData.reporterName.trim()
                  ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/10'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Selector de Prioridad */}
      <div className="space-y-2">
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Nivel de Urgencia
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateForm('priority', 'normal')}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              formData.priority === 'normal'
                ? 'bg-emerald-50/90 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/15'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              formData.priority === 'normal' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
            }`}>
              {formData.priority === 'normal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <div className="text-xs font-extrabold">Prioridad Normal</div>
              <div className="text-[11px] opacity-75">Para revisión en el parte habitual</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateForm('priority', 'urgente')}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              formData.priority === 'urgente'
                ? 'bg-rose-50/90 border-rose-500 text-rose-900 ring-2 ring-rose-500/15'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              formData.priority === 'urgente' ? 'border-rose-600 bg-rose-600' : 'border-slate-300'
            }`}>
              {formData.priority === 'urgente' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <div className="text-xs font-extrabold flex items-center gap-1">
                Urgente <AlertCircle size={12} className="text-rose-600" />
              </div>
              <div className="text-[11px] opacity-75">Impide dar clase o supone un riesgo</div>
            </div>
          </button>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col gap-2 pt-2">
        {submitError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            {submitError}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-3.5 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Atrás
          </button>
          <button 
            type="button"
            onClick={handleSubmit} 
            disabled={!formData.description.trim() || !formData.reporterName.trim() || isSubmitting} 
            className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 font-extrabold text-sm disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.99]"
          >
            {isSubmitting ? 'Registrando incidencia...' : 'Registrar Incidencia'} <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Panel de Estadísticas (Dashboard) ---
interface DashboardProps {
  incidents: Incident[];
}

const Dashboard: React.FC<DashboardProps> = ({ incidents }) => {
  const total = incidents.length;
  const pending = incidents.filter(i => i.status === 'pending').length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;
  const urgentPending = incidents.filter(i => i.status === 'pending' && i.priority === 'urgente').length;
  const itCount = incidents.filter(i => i.category === 'it').length;
  const maintCount = incidents.filter(i => i.category !== 'it').length;

  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  
  const buildingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((curr) => {
      if (curr.building) {
        counts[curr.building] = (counts[curr.building] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  const topBuilding = buildingCounts[0]?.[0] || '-';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Analítica del Centro</h2>
          <p className="text-xs text-slate-500">Resumen global de incidencias registradas y rendimiento</p>
        </div>
        <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
          {total} registros totales
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider">Pendientes</span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600">{pending}</div>
          <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${pct(pending)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider">Resueltas</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-600">{resolved}</div>
          <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pct(resolved)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider">Urgentes Activas</span>
            <AlertCircle size={18} className="text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold text-rose-600">{urgentPending}</div>
          <p className="text-xs font-semibold text-slate-400 mt-3">Tasa de resolución: <span className="text-slate-700 font-bold">{pct(resolved)}%</span></p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm">
          <BarChart3 size={18} className="text-indigo-600" /> Distribución por Departamento
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-blue-800 font-extrabold flex items-center gap-1.5">
                <Monitor size={14} /> Informática y TIC
              </span>
              <span className="font-extrabold text-blue-900">{itCount} ({pct(itCount)}%)</span>
            </div>
            <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-blue-100">
              <div className="bg-blue-600 h-full transition-all" style={{ width: `${pct(itCount)}%` }}></div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-orange-800 font-extrabold flex items-center gap-1.5">
                <Hammer size={14} /> Mantenimiento
              </span>
              <span className="font-extrabold text-orange-900">{maintCount} ({pct(maintCount)}%)</span>
            </div>
            <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-orange-100">
              <div className="bg-orange-500 h-full transition-all" style={{ width: `${pct(maintCount)}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[11px] uppercase font-extrabold tracking-wider">Desglose por Pabellón</span>
            <div className="text-base font-extrabold text-slate-900 mt-0.5 truncate">
              Mayor actividad: <span className="text-indigo-600">{BUILDING_METADATA[topBuilding]?.shortTitle || topBuilding}</span>
            </div>
          </div>
        </div>
        {buildingCounts.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            {buildingCounts.map(([bName, count]) => (
              <div key={bName} className="text-xs space-y-1.5">
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span className="truncate pr-2">{bName}</span>
                  <span className="font-extrabold text-slate-900 shrink-0">{count} ({pct(count)}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full" style={{ width: `${pct(count)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Listado de Incidencias ---
interface IncidentsListProps {
  loading: boolean;
  incidents: Incident[];
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  filterText: string;
  setFilterText: (val: string) => void;
  filterBuilding: string;
  setFilterBuilding: (val: string) => void;
  onlyMyIncidents: boolean;
  setOnlyMyIncidents: (val: boolean) => void;
  isAdmin: boolean;
  exportToCSV: () => void;
  setActiveTab: (tab: TabType) => void;
  initiateResolve: (id: string) => void;
  reopenIncident: (id: string) => void;
  initiateDelete: (id: string) => void;
  onPreviewImage: (imageUrl: string, description: string) => void;
  onOpenQrModal: (building: string, floor: string, room: string) => void;
}

const IncidentsList: React.FC<IncidentsListProps> = ({ 
  loading, 
  incidents, 
  filterStatus, setFilterStatus,
  filterCategory, setFilterCategory,
  filterText, setFilterText, 
  filterBuilding, setFilterBuilding,
  onlyMyIncidents, setOnlyMyIncidents,
  isAdmin,
  exportToCSV, setActiveTab,
  initiateResolve, reopenIncident, initiateDelete,
  onPreviewImage,
  onOpenQrModal
}) => {
  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500">Cargando historial de incidencias...</p>
      </div>
    );
  }

  const savedName = localStorage.getItem('school_reporter_name');

  const pendingTotal = incidents.filter(i => i.status === 'pending').length;
  const urgentTotal = incidents.filter(i => i.status === 'pending' && i.priority === 'urgente').length;
  const resolvedTotal = incidents.filter(i => i.status === 'resolved').length;

  const filtered = incidents.filter(i => {
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    const matchCategory = filterCategory === 'all' || i.category === filterCategory;
    const query = filterText.toLowerCase().trim();
    const matchText = query === '' || 
      (i.description || '').toLowerCase().includes(query) || 
      (i.room || '').toLowerCase().includes(query) ||
      (i.building || '').toLowerCase().includes(query) ||
      (i.reporterName || '').toLowerCase().includes(query);
    const matchBuilding = filterBuilding === 'all' || i.building === filterBuilding;
    const matchMine = !onlyMyIncidents || Boolean(savedName && i.reporterName?.toLowerCase().trim() === savedName.toLowerCase().trim());
    
    return matchStatus && matchCategory && matchText && matchBuilding && matchMine;
  });

  return (
    <div className="pb-24 space-y-5 animate-in fade-in duration-300">
      {/* Mini KPIs Rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterStatus === 'pending'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">Pendientes</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{pendingTotal}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('pending')}
          className="p-3.5 rounded-2xl border bg-white border-slate-200/80 hover:border-rose-300 text-left transition-all"
        >
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 flex items-center gap-1">
            Urgentes {urgentTotal > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-0.5">{urgentTotal}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'resolved' ? 'all' : 'resolved')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterStatus === 'resolved'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
              : 'bg-white border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Resueltas</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{resolvedTotal}</div>
        </button>
      </div>

      {/* Panel de Filtros y Búsqueda */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
            <Filter size={15} className="text-indigo-600" /> Búsqueda y Filtros
          </h3>
          {savedName && (
            <button
              type="button"
              onClick={() => setOnlyMyIncidents(!onlyMyIncidents)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
                onlyMyIncidents
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <User size={13} /> Mis reportes ({savedName})
            </button>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por avería, aula, profesor..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select 
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-2xl bg-slate-50 px-3.5 py-2.5 sm:w-56 truncate outline-none focus:border-indigo-500"
          >
            <option value="all">🏢 Todos los edificios</option>
            {BUILDINGS.map(b => <option key={b} value={b}>{BUILDING_METADATA[b]?.shortTitle || b}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
          <div className="flex gap-1.5 overflow-x-auto py-0.5">
            <button type="button" onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${filterStatus === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Todas</button>
            <button type="button" onClick={() => setFilterStatus('pending')} className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${filterStatus === 'pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Pendientes</button>
            <button type="button" onClick={() => setFilterStatus('resolved')} className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${filterStatus === 'resolved' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Resueltas</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto py-0.5">
            <button type="button" onClick={() => setFilterCategory('all')} className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${filterCategory === 'all' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}>Ambas áreas</button>
            <button type="button" onClick={() => setFilterCategory('maintenance')} className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1 transition-all ${filterCategory === 'maintenance' ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white text-slate-600 border-slate-200'}`}><Hammer size={12} /> Mant.</button>
            <button type="button" onClick={() => setFilterCategory('it')} className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1 transition-all ${filterCategory === 'it' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white text-slate-600 border-slate-200'}`}><Monitor size={12} /> Info.</button>
          </div>
        </div>
      </div>
      
      {/* Herramientas de Admin (Exportar y Stats) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
          <button 
            type="button"
            onClick={exportToCSV}
            className="py-3 px-4 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <Download size={15} /> Exportar Excel (CSV)
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('stats')}
            className="py-3 px-4 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <BarChart3 size={15} /> Panel de Estadísticas
          </button>
        </div>
      )}

      {/* Listado de Tarjetas */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 text-center py-14 px-4 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search size={22} />
          </div>
          <div className="text-sm font-bold text-slate-700">No se encontraron incidencias con estos filtros</div>
          <p className="text-xs text-slate-400">Prueba a limpiar la búsqueda o cambiar el estado seleccionado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((incident) => {
            const isIT = incident.category === 'it';
            const isResolved = incident.status === 'resolved';
            const isUrgent = incident.priority === 'urgente' && !isResolved;
            const shortBuilding = BUILDING_METADATA[incident.building]?.shortTitle || incident.building;
            
            return (
              <div 
                key={incident.id} 
                className={`p-5 rounded-3xl border transition-all relative overflow-hidden bg-white ${
                  isResolved
                    ? 'border-slate-200/80 opacity-80 bg-slate-50/60'
                    : isUrgent
                    ? 'border-rose-300 shadow-md shadow-rose-500/5 ring-1 ring-rose-100'
                    : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Barra lateral de acento */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  isResolved ? 'bg-emerald-500' : isUrgent ? 'bg-rose-500' : isIT ? 'bg-blue-500' : 'bg-orange-500'
                }`} />

                <div className="flex justify-between items-start gap-3 mb-2.5 pl-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                      isIT ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 'bg-orange-50 text-orange-700 border border-orange-200/60'
                    }`}>
                      {isIT ? <Monitor size={13} /> : <Hammer size={13} />}
                      {isIT ? 'Informática' : 'Mantenimiento'}
                    </span>

                    {isUrgent && (
                      <span className="bg-rose-100 text-rose-700 border border-rose-200 text-xs px-2.5 py-1 rounded-xl font-extrabold flex items-center gap-1">
                        <AlertCircle size={12} /> Urgente
                      </span>
                    )}
                  </div>
                   
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdmin && (
                      <button 
                        type="button"
                        onClick={() => onOpenQrModal(incident.building, incident.floor, incident.room)}
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-200 transition-colors"
                        title="Generar código QR o enlace directo de este aula"
                      >
                        <QrCode size={15} />
                      </button>
                    )}
                    {isAdmin ? (
                      <>
                        {incident.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => initiateResolve(incident.id)}
                            className="text-xs font-extrabold px-3.5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-1 transition-colors"
                          >
                            <Check size={14} /> Resolver
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reopenIncident(incident.id)}
                            className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50"
                          >
                            Reabrir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => initiateDelete(incident.id)}
                          className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-100 transition-colors"
                          title="Eliminar incidencia"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs px-3 py-1 rounded-full font-extrabold flex items-center gap-1.5 border ${
                        isResolved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isResolved ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {isResolved ? 'Resuelta' : 'Pendiente'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Descripción principal */}
                <div className="pl-1 mb-3">
                  <h3 className={`text-base font-extrabold leading-snug ${
                    isResolved ? 'line-through text-slate-400' : 'text-slate-900'
                  }`}>
                    {incident.description}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5">
                    <span className="font-semibold text-slate-500" title={formatDate(incident.createdAt)}>
                      {getRelativeTime(incident.createdAt)}
                      {incident.createdAt?.seconds ? ` (${formatDate(incident.createdAt)})` : ''}
                    </span>
                    {incident.reporterName && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-slate-600 font-bold">
                          <User size={11} className="text-slate-400" /> {incident.reporterName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Etiquetas de ubicación y foto */}
                <div className="pl-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-xl border border-slate-200/80">
                    <Building size={11} className="text-slate-500" /> {shortBuilding}
                  </span>
                  {incident.floor && incident.floor !== 'N/A' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-xl border border-slate-200/80">
                      <Layers size={11} className="text-slate-500" /> {incident.floor}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 font-extrabold px-2.5 py-1 rounded-xl border border-indigo-200/70">
                    <MapPin size={11} className="text-indigo-600" /> {incident.room}
                  </span>
                  {incident.imageData && (
                    <button
                      type="button"
                      onClick={() => onPreviewImage(incident.imageData!, incident.description)}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-xl shadow-2xs cursor-pointer transition-colors"
                    >
                      <Eye size={12} /> Ver foto
                    </button>
                  )}
                </div>

                {/* Nota de resolución */}
                {isResolved && incident.resolutionNote && (
                  <div className="mt-3.5 ml-1 bg-emerald-50/90 p-3 rounded-2xl border border-emerald-200/80 text-xs text-emerald-900 flex gap-2.5 items-start">
                    <CheckCircle2 size={15} className="mt-0.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-extrabold">Solución aplicada:</span> {incident.resolutionNote}
                      <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                        {getRelativeTime(incident.resolvedAt)} {incident.resolvedAt?.seconds ? `• ${formatDate(incident.resolvedAt)}` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Componente Principal ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('new'); 
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<IncidentFormData>({
    category: '',
    building: '',
    floor: '',
    room: '',
    description: '',
    priority: 'normal',
    imageData: null,
    reporterName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null); 

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [loginError, setLoginError] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterText, setFilterText] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [onlyMyIncidents, setOnlyMyIncidents] = useState(false);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Estados Modal Borrado
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal de vista previa de imagen en grande
  const [previewModalData, setPreviewModalData] = useState<{ url: string; title: string } | null>(null);

  // Modal de Código QR de aula
  const [qrModalData, setQrModalData] = useState<{ building: string; floor: string; room: string; url: string } | null>(null);

  // Notificación ligera (Toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado para Easter Egg
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // --- Check URL Params for Magic Link / QR ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pBuilding = params.get('b');
    const pFloor = params.get('f');
    const pRoom = params.get('r');

    if (pBuilding) {
      setFormData(prev => ({
        ...prev,
        building: pBuilding,
        floor: pFloor || (pBuilding === "Otros Espacios Comunes" ? 'N/A' : ''),
        room: pRoom || ''
      }));
      setStep(1);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
            return;
          } catch (tokenError) {
            console.log("Token de entorno no válido, probando anónimo...");
          }
        }
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error crítico en autenticación:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    
    const savedName = localStorage.getItem('school_reporter_name');
    if (savedName) {
      setFormData(prev => ({ ...prev, reporterName: savedName }));
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares');
    const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Incident, 'id'>) }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setIncidents(docs);
      setLoading(false);
    }, (error) => console.error(error));
    return () => unsubscribe();
  }, [user]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => Math.max(1, prev - 1));
  const updateForm = <K extends keyof IncidentFormData>(field: K, value: IncidentFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectCategory = (category: 'maintenance' | 'it') => {
    updateForm('category', category);
    const isCommon = formData.building === "Otros Espacios Comunes";
    const hasCompleteLocation = isCommon
      ? Boolean(formData.building && formData.room)
      : Boolean(formData.building && formData.floor && formData.room);

    if (hasCompleteLocation) {
      setStep(3);
    } else {
      setStep(2);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImage(reader.result);
          updateForm('imageData', compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveIncidentToFirestore = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const trimmedName = formData.reporterName.trim();
    if (trimmedName) {
      localStorage.setItem('school_reporter_name', trimmedName);
    }

    try {
      const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares');
      await addDoc(collectionRef, {
        ...formData,
        description: formData.description.trim(),
        reporterName: trimmedName,
        status: 'pending',
        createdAt: serverTimestamp(),
        authorId: user.uid
      });
      setStep(4); 
      setTimeout(() => {
        setStep(1);
        setFormData(prev => ({
          category: '',
          building: '',
          floor: '',
          room: '',
          description: '',
          priority: 'normal',
          imageData: null,
          reporterName: prev.reporterName
        }));
        window.history.replaceState({}, document.title, window.location.pathname);
        setActiveTab('list');
        setIsSubmitting(false);
      }, 1800);
    } catch (error) {
      console.error(error);
      setSubmitError("Error al enviar. ¿Es la foto muy grande o hay problemas de conexión?");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.description.trim() || !formData.reporterName.trim()) return;
    setSubmitError(null);

    // --- DETECCIÓN DEL HUEVO DE PASCUA ---
    if (
      formData.category === 'maintenance' &&
      formData.floor === 'Planta Baja' &&
      (formData.room === 'Pasillo / Baños' || formData.room === 'Otro') && 
      formData.description === 'Cisterna averiada' &&
      formData.priority === 'urgente'
    ) {
      setShowEasterEgg(true);
      return; 
    }

    await saveIncidentToFirestore();
  };

  const handleAdminAccess = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setActiveTab('list');
      showToast("Sesión de administración cerrada");
    } else {
      setShowAuthModal(true);
      setAdminPin('');
      setLoginError(false);
    }
  };

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "1274") {
      setIsAdmin(true);
      setShowAuthModal(false);
      showToast("Modo administración activado");
    } else {
      setLoginError(true);
    }
  };

  const initiateResolve = (id: string) => {
    setResolvingId(id);
    setResolveNote('');
    setShowResolveModal(true);
  };

  const confirmResolve = async () => {
    if (!resolvingId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares', resolvingId);
      await updateDoc(docRef, {
        status: 'resolved',
        resolutionNote: resolveNote.trim(),
        resolvedAt: serverTimestamp()
      });
      setShowResolveModal(false);
      setResolvingId(null);
      showToast("Incidencia marcada como resuelta");
    } catch (e) { console.error(e); }
  };

  const reopenIncident = async (id: string) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares', id);
      await updateDoc(docRef, { status: 'pending', resolutionNote: null });
      showToast("Incidencia reabierta");
    } catch (e) { console.error(e); }
  };

  const initiateDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares', deletingId);
      await deleteDoc(docRef);
      setShowDeleteModal(false);
      setDeletingId(null);
      showToast("Incidencia eliminada");
    } catch (e) { console.error(e); }
  };

  const handleOpenQrModal = (building: string, floor: string, room: string) => {
    const params = new URLSearchParams();
    params.set('b', building);
    if (floor && floor !== 'N/A') params.set('f', floor);
    if (room) params.set('r', room);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    setQrModalData({ building, floor, room, url });
  };

  const exportToCSV = () => {
    const headers = ["Fecha", "Solicitante", "Estado", "Categoría", "Prioridad", "Edificio", "Planta", "Aula", "Descripción", "Nota Resolución"];
    const rows = incidents.map(i => [
      i.createdAt?.seconds ? new Date(i.createdAt.seconds * 1000).toLocaleDateString('es-ES') : '',
      `"${(i.reporterName || 'Anónimo').replace(/"/g, '""')}"`,
      i.status === 'resolved' ? 'Resuelto' : 'Pendiente',
      i.category === 'it' ? 'Informática' : 'Mantenimiento',
      i.priority,
      `"${(i.building || '').replace(/"/g, '""')}"`,
      `"${(i.floor || '').replace(/"/g, '""')}"`,
      `"${(i.room || '').replace(/"/g, '""')}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      i.resolutionNote ? `"${i.resolutionNote.replace(/"/g, '""')}"` : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `incidencias_escolares_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendingBadgeCount = incidents.filter(i => i.status === 'pending').length;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-sm font-semibold">Conectando con el sistema del centro...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12 relative">
      {/* Decoración ambiental superior */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-blue-500 to-amber-500 sticky top-0 z-30" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-6 right-4 left-4 md:left-auto z-50 max-w-sm bg-slate-900 text-white text-xs font-bold px-4 py-3.5 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 border border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-3 text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-1.5 z-20 px-4 py-3 shadow-2xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src="/san_buenaventura_user_logo.jpeg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "https://i.ibb.co/FLS9ybLj/cropped-Colegio-1.png";
              }}
              alt="Logo Colegio San Buenaventura" 
              className="h-11 w-11 rounded-2xl object-contain bg-white p-1 border border-slate-200 shadow-2xs shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight truncate">
                  Gestión de Incidencias
                </h1>
                {isAdmin && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 truncate">
                Colegio San Buenaventura • Mantenimiento y TIC
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  activeTab === 'new' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PlusCircle size={14} /> Reportar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  activeTab === 'list' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History size={14} /> Historial
                {pendingBadgeCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-extrabold">
                    {pendingBadgeCount}
                  </span>
                )}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === 'stats' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 size={14} /> Analítica
                </button>
              )}
            </nav>
             
            {/* Botón Admin en Cabecera */}
            <button 
              type="button"
              onClick={handleAdminAccess}
              className={`p-2.5 rounded-2xl border transition-all ${
                isAdmin
                  ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
              title={isAdmin ? "Salir de Administración" : "Acceso Administración"}
            >
              {isAdmin ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        {activeTab === 'new' && (
          <div className="bg-white shadow-xl shadow-slate-900/5 rounded-3xl p-5 sm:p-8 border border-slate-200/80 mb-20 md:mb-8">
            <Stepper currentStep={step} formData={formData} onGoToStep={setStep} />

            {step === 1 && (
              <StepCategory 
                formData={formData}
                incidents={incidents}
                onSelectCategory={handleSelectCategory}
                onEditPreselectedLocation={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <StepLocation 
                formData={formData} 
                updateForm={updateForm} 
                handleNext={handleNext} 
                handleBack={handleBack} 
              />
            )}
            {step === 3 && (
              <StepDetails 
                formData={formData} 
                updateForm={updateForm} 
                handleBack={handleBack}
                goToStep={setStep}
                handleSubmit={handleSubmit} 
                isSubmitting={isSubmitting} 
                handleImageUpload={handleImageUpload}
                submitError={submitError}
              />
            )}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center py-14 text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/15">
                  <CheckCircle2 size={42} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900">¡Incidencia registrada!</h2>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                  El equipo de {formData.category === 'it' ? 'Informática' : 'Mantenimiento'} ya tiene disponible el aviso.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <IncidentsList 
            loading={loading}
            incidents={incidents}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterText={filterText}
            setFilterText={setFilterText}
            filterBuilding={filterBuilding}
            setFilterBuilding={setFilterBuilding}
            onlyMyIncidents={onlyMyIncidents}
            setOnlyMyIncidents={setOnlyMyIncidents}
            isAdmin={isAdmin}
            exportToCSV={exportToCSV}
            setActiveTab={setActiveTab}
            initiateResolve={initiateResolve}
            reopenIncident={reopenIncident}
            initiateDelete={initiateDelete}
            onPreviewImage={(url, title) => setPreviewModalData({ url, title })}
            onOpenQrModal={handleOpenQrModal}
          />
        )}

        {activeTab === 'stats' && isAdmin && (
          <Dashboard incidents={incidents} />
        )}
      </main>

      {/* Tab Bar Móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-2.5 flex justify-around z-20 shadow-lg pb-5">
        <button
          type="button"
          onClick={() => setActiveTab('new')}
          className={`flex flex-col items-center gap-1 px-4 py-1 rounded-2xl transition-colors ${
            activeTab === 'new' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'
          }`}
        >
          <PlusCircle size={22} />
          <span className="text-[11px]">Reportar</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`relative flex flex-col items-center gap-1 px-4 py-1 rounded-2xl transition-colors ${
            activeTab === 'list' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'
          }`}
        >
          <History size={22} />
          <span className="text-[11px]">Historial</span>
          {pendingBadgeCount > 0 && (
            <span className="absolute top-0.5 right-2 bg-amber-500 text-white text-[10px] font-extrabold px-1.5 rounded-full">
              {pendingBadgeCount}
            </span>
          )}
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-2xl transition-colors ${
              activeTab === 'stats' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'
            }`}
          >
            <BarChart3 size={22} />
            <span className="text-[11px]">Analítica</span>
          </button>
        )}
      </div>

      {/* Modal de Vista Previa de Foto */}
      {previewModalData && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalData(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <span className="font-extrabold text-sm text-slate-800 truncate pr-4">{previewModalData.title}</span>
              <button
                type="button"
                onClick={() => setPreviewModalData(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img src={previewModalData.url} alt={previewModalData.title} className="max-h-[75vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Código QR del Aula */}
      {qrModalData && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setQrModalData(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                Acceso Directo QR
              </span>
              <button type="button" onClick={() => setQrModalData(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">{qrModalData.room}</h3>
              <p className="text-xs font-semibold text-slate-500">
                {BUILDING_METADATA[qrModalData.building]?.shortTitle || qrModalData.building}
                {qrModalData.floor && qrModalData.floor !== 'N/A' ? ` • ${qrModalData.floor}` : ''}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(qrModalData.url)}`}
                alt={`QR ${qrModalData.room}`}
                className="w-48 h-48 mx-auto rounded-xl"
              />
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Al escanear este QR en el aula, el profesor entrará con la ubicación ya seleccionada.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrModalData.url).then(() => {
                    showToast("¡Enlace del aula copiado al portapapeles!");
                  });
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-colors"
              >
                <Copy size={14} /> Copiar enlace
              </button>
              <button
                type="button"
                onClick={() => setQrModalData(null)}
                className="px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Login Admin */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={26} />
            </div>
            <h3 className="text-lg font-extrabold text-center text-slate-900 mb-1">Acceso Administración</h3>
            <p className="text-xs text-center text-slate-500 mb-5">Introduce el PIN de coordinación / mantenimiento</p>
            <form onSubmit={submitPin}>
              <input
                type="password"
                placeholder="••••"
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl mb-4 text-center text-2xl font-extrabold tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/10"
                autoFocus
              />
              {loginError && <p className="text-rose-600 text-xs font-bold mb-4 text-center">PIN incorrecto. Inténtalo de nuevo.</p>}
              <div className="flex gap-2.5">
                <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-indigo-500/20">Acceder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resolver Incidencia */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900 mb-1">Resolver Incidencia</h3>
            <p className="text-xs text-slate-500 mb-4">Indica brevemente la actuación realizada (opcional):</p>
            <textarea
              value={resolveNote}
              onChange={e => setResolveNote(e.target.value)}
              placeholder="Ej: Sustituido cable HDMI, cambiada luminaria, reparada cerradura..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl mb-4 h-24 text-sm outline-none"
              autoFocus
            />
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowResolveModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600">Cancelar</button>
              <button type="button" onClick={confirmResolve} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-500/20">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Borrado */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 shadow-2xl border border-slate-200">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mb-3">
                <AlertCircle className="text-rose-600" size={24} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">¿Eliminar incidencia?</h3>
              <p className="text-xs text-slate-500 mt-1">Esta acción borrará el registro permanentemente.</p>
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={confirmDelete} className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-rose-500/20">Sí, borrar</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Easter Egg */}
      {showEasterEgg && (
        <div className="fixed inset-0 bg-black z-[70] flex items-center justify-center p-4 animate-in fade-in duration-1000">
          <div className="text-center space-y-6">
            <div className="text-6xl animate-bounce">🥚</div>
            <h2 className="text-white text-2xl font-mono font-bold tracking-widest leading-relaxed px-4">
              Хэрэв та үүнийг олвол та бас монголоор ярьдаг гэсэн үг
            </h2>
            <div className="flex items-center justify-center gap-3 pt-4">
              <button 
                type="button"
                onClick={async () => {
                  setShowEasterEgg(false);
                  await saveIncidentToFirestore();
                }}
                className="px-6 py-2.5 bg-white text-black font-bold rounded-full transition-all text-sm hover:bg-gray-200"
              >
                Enviar incidencia igualmente
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowEasterEgg(false);
                  setStep(1);
                  setFormData(prev => ({
                    category: '', building: '', floor: '', room: '', description: '', priority: 'normal', imageData: null, reporterName: prev.reporterName
                  }));
                }}
                className="px-6 py-2.5 border border-white/30 text-white/70 hover:text-white hover:border-white rounded-full transition-all text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-[11px] font-semibold text-slate-400 text-center pb-20 md:pb-4">
        Colegio San Buenaventura • Sistema de Incidencias {APP_VERSION}
      </footer>
      <div className="text-[1px] text-slate-100 select-none text-center">Хэрэв та үүнийг олвол та бас монголоор ярьдаг гэсэн үг</div>
    </div>
  );
}
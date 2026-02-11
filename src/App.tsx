// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  QrCode
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

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
const APP_VERSION = 'v4.6';

// --- UTILIDAD: Compresor de Imágenes ---
const compressImage = (base64Str, maxWidth = 800, quality = 0.6) => {
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
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str); // Si falla, devuelve original
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

const COMMON_ISSUES = {
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
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Función auxiliar para tiempo relativo
const getRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp.seconds * 1000);
  const diffInSeconds = Math.floor((now - date) / 1000);

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

// --- Componente de Cámara Integrada ---
const CameraModal = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false
        });
        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err) {
        console.error("Error cámara:", err);
        setError("No se pudo acceder a la cámara. Asegúrate de permitir el acceso.");
      }
    };
    
    if (!capturedImage) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [capturedImage]);

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    
    // Configurar tamaño máximo para comprimir la imagen
    const MAX_WIDTH = 800;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;

    if (width > MAX_WIDTH) {
      height = (height * MAX_WIDTH) / width;
      width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, width, height);
    // Comprimir a JPEG calidad 0.6
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setCapturedImage(dataUrl);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    onCapture(capturedImage);
  };

  const handleClose = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center animate-in fade-in duration-200">
      
      {showIntro && !error && !capturedImage && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-900/50">
              <Video size={28} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-xl mb-3">Modo Vídeo en Vivo</h3>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
              Se activará la cámara para que puedas <strong>enfocar la escena en vídeo</strong>. 
              <br/><br/>
              Cuando tengas el encuadre, pulsa el botón para <strong>congelar el momento</strong> y guardarlo como foto.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => setShowIntro(false)}
                className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg active:scale-95 transform duration-100"
              >
                Entendido, abrir cámara
              </button>
              <button 
                onClick={handleClose}
                className="w-full py-3 text-gray-400 font-medium hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="text-white p-4 text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <button onClick={handleClose} className="px-4 py-2 bg-gray-800 rounded-lg">Cerrar</button>
        </div>
      ) : (
        <>
          <div className="relative w-full h-full flex flex-col">
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {capturedImage ? (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
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
              <div className="p-6 bg-black/90 flex justify-center items-center gap-8 pb-10">
                  {capturedImage ? (
                      <>
                          <button 
                              onClick={retakePhoto}
                              className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100"
                          >
                              <div className="p-3 rounded-full bg-gray-700">
                                  <RotateCcw size={24} />
                              </div>
                              <span className="text-xs">Repetir</span>
                          </button>

                          <button 
                              onClick={confirmPhoto}
                              className="flex flex-col items-center gap-1 text-green-400 hover:text-green-300 transform hover:scale-105 transition-all"
                          >
                              <div className="p-4 rounded-full bg-white">
                                  <Check size={32} className="text-green-600" />
                              </div>
                              <span className="text-xs font-bold">Guardar</span>
                          </button>
                      </>
                  ) : (
                      <>
                          <button 
                              onClick={handleClose} 
                              className="absolute left-6 text-white p-2"
                          >
                              <span className="text-sm font-medium">Cancelar</span>
                          </button>
                          
                          <button 
                              onClick={takePhoto} 
                              className="p-1 rounded-full border-4 border-white transition-transform active:scale-95"
                          >
                              <div className="w-16 h-16 bg-white rounded-full"></div>
                          </button>
                      </>
                  )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// --- Sub-Componentes ---

const StepCategory = ({ updateForm, handleNext }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h2 className="text-xl font-bold text-gray-800 text-center">Tipo de incidencia</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button
        onClick={() => { updateForm('category', 'maintenance'); handleNext(); }}
        className="p-6 bg-orange-50 border-2 border-orange-200 rounded-2xl flex flex-col items-center gap-3 hover:bg-orange-100 transition-all"
      >
        <Hammer size={40} className="text-orange-600" />
        <div className="text-center">
          <span className="block text-lg font-bold text-orange-800">Mantenimiento</span>
          <span className="text-sm text-orange-600">Luces, muebles, puertas...</span>
        </div>
      </button>
      <button
        onClick={() => { updateForm('category', 'it'); handleNext(); }}
        className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col items-center gap-3 hover:bg-blue-100 transition-all"
      >
        <Monitor size={40} className="text-blue-600" />
        <div className="text-center">
          <span className="block text-lg font-bold text-blue-800">Informática</span>
          <span className="text-sm text-blue-600">PCs, redes, proyectores...</span>
        </div>
      </button>
    </div>
  </div>
);

const StepLocation = ({ formData, updateForm, handleNext, handleBack }) => {
  const isCommonSpace = formData.building === "Otros Espacios Comunes";
  const handleBuildingChange = (e) => {
    const val = e.target.value;
    if (val === "Otros Espacios Comunes") {
      updateForm('building', val);
      updateForm('floor', 'N/A');
      updateForm('room', '');
    } else {
      updateForm('building', val);
      updateForm('floor', '');
      updateForm('room', '');
    }
  };

  const availableFloors = useMemo(() => {
    if (formData.building === "Pabellón 3 y 4 años") {
      return ["Planta Baja", "1ª Planta"];
    }
    return FLOORS;
  }, [formData.building]);

  const availableRooms = useMemo(() => {
    // 1. Espacios Comunes
    if (isCommonSpace) return COMMON_SPACES_LIST;

    const building = formData.building;
    const floor = formData.floor;

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

    // 6. Pirámide (3º-6º EP)
    if (building === "Pirámide (3º-6º EP)") {
      if (floor === "1ª Planta") {
        return [
          "4º EP A", "4º EP C", 
          "5º EP A", "5º EP B", "5º EP C", 
          "Sala de Robótica", "Laboratorio", "Sala de Música",
          "Pasillo / Baños", "Otro"
        ];
      }
      if (floor === "2ª Planta") {
        return [
          "Sala PT", "4º EP B",
          "3º EP A", "3º EP B", "3º EP C",
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
          "Otro" // Baño incluido en aula
        ];
      }
      if (floor === "1ª Planta") {
        return [
          "4 años A", "4 años B", "4 años C",
          "Pasillo / Baños", "Otro"
        ];
      }
    }

    // Default genérico
    return ["Aula A", "Aula B", "Aula C", "Tutoría", "Pasillo / Baños", "Otro"];
  }, [formData.building, formData.floor, isCommonSpace]);

  const canContinue = isCommonSpace ? (formData.building && formData.room) : (formData.building && formData.floor && formData.room);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300">
      <h2 className="text-xl font-bold text-gray-800">Ubicación</h2>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Edificio / Zona</label>
        <select 
          value={formData.building} onChange={handleBuildingChange}
          className="w-full p-3 bg-white border border-gray-300 rounded-xl"
        >
          <option value="">Selecciona...</option>
          {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {formData.building && !isCommonSpace && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planta</label>
            <div className="flex gap-2">
              {availableFloors.map(f => (
                <button key={f} onClick={() => updateForm('floor', f)} className={`flex-1 p-2 text-sm border rounded-lg ${formData.floor === f ? 'bg-blue-600 text-white' : 'bg-white'}`}>{f}</button>
              ))}
            </div>
          </div>
        )}
        {(isCommonSpace || formData.floor) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Espacio / Aula</label>
            <div className="grid grid-cols-2 gap-2">
              {availableRooms.map(r => (
                <button key={r} onClick={() => updateForm('room', r)} className={`p-2 text-sm border rounded-lg ${formData.room === r ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{r}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={handleBack} className="px-4 py-2 border rounded-lg">Atrás</button>
        <button onClick={handleNext} disabled={!canContinue} className="flex-1 bg-gray-900 text-white rounded-lg disabled:opacity-50">Siguiente</button>
      </div>
    </div>
  );
};

const StepDetails = ({ formData, updateForm, handleBack, handleSubmit, isSubmitting, handleImageUpload, submitError }) => {
  const issues = COMMON_ISSUES[formData.category] || [];
  const fileInputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleQuickTag = (text) => updateForm('description', text);

  const onCameraCapture = (imgBase64) => {
    updateForm('imageData', imgBase64);
    setShowCamera(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300">
      {showCamera && <CameraModal onCapture={onCameraCapture} onClose={() => setShowCamera(false)} />}

      <h2 className="text-xl font-bold text-gray-800">Detalles</h2>
      
      <div className="bg-gray-50 p-3 rounded-lg border text-sm flex gap-2 text-gray-600">
        <MapPin size={16} /> 
        <span>{formData.building} {formData.floor !== 'N/A' && `• ${formData.floor}`} • <b>{formData.room}</b></span>
      </div>

      <div>
        <span className="text-xs font-bold text-gray-500 uppercase">Frecuentes</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {issues.map(i => (
            <button key={i} onClick={() => handleQuickTag(i)} className={`text-xs px-2 py-1 border rounded-full ${formData.description === i ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white'}`}>{i}</button>
          ))}
        </div>
      </div>

      <textarea
        value={formData.description}
        onChange={(e) => updateForm('description', e.target.value)}
        placeholder="Describe el problema..."
        className="w-full h-20 p-3 border rounded-xl resize-none"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evidencia (Opcional)</label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
              >
                <ImageIcon size={16} />
                Galería
              </button>
              <button 
                onClick={() => setShowCamera(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
              >
                <Camera size={16} />
                Cámara
              </button>
            </div>

            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
            
            {formData.imageData && (
              <div className="relative mt-1 inline-block">
                <img src={formData.imageData} alt="Preview" className="h-16 w-16 object-cover rounded-lg border shadow-sm" />
                <button onClick={() => updateForm('imageData', null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><X size={12} /></button>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tu Nombre <span className="text-red-500">*</span></label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Ej: Juan Pérez" 
              value={formData.reporterName} 
              onChange={(e) => updateForm('reporterName', e.target.value)} 
              className={`w-full pl-9 p-2 border rounded-lg text-sm bg-gray-50 ${!formData.reporterName ? 'border-red-300 focus:ring-red-200' : 'border-gray-300'}`}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
        <div className="flex gap-2">
          {['normal', 'urgente'].map(p => (
            <button key={p} onClick={() => updateForm('priority', p)} className={`flex-1 py-1.5 text-sm border rounded capitalize ${formData.priority === p ? (p === 'urgente' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-green-100 border-green-500 text-green-700') : 'bg-white'}`}>{p}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {submitError && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle size={16} />
            {submitError}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={handleBack} className="px-4 py-2 border rounded-lg">Atrás</button>
          <button 
            onClick={handleSubmit} 
            disabled={!formData.description || !formData.reporterName || isSubmitting} 
            className="flex-1 bg-blue-600 text-white rounded-lg shadow-lg flex items-center justify-center gap-2 font-bold disabled:bg-gray-400"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Incidencia'} <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ incidents }) => {
  const total = incidents.length;
  const pending = incidents.filter(i => i.status === 'pending').length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;
  const itCount = incidents.filter(i => i.category === 'it').length;
  const maintCount = incidents.filter(i => i.category === 'maintenance').length;
  
  const buildingCounts = incidents.reduce((acc, curr) => {
    acc[curr.building] = (acc[curr.building] || 0) + 1;
    return acc;
  }, {});
  const topBuilding = Object.keys(buildingCounts).sort((a,b) => buildingCounts[b] - buildingCounts[a])[0] || '-';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      <h2 className="text-xl font-bold text-gray-800 px-1">Estadísticas del Centro</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <span className="text-gray-500 text-xs uppercase font-bold">Pendientes</span>
          <div className="text-3xl font-bold text-yellow-600">{pending}</div>
          <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-yellow-500 h-full" style={{ width: `${(pending/total)*100}%` }}></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <span className="text-gray-500 text-xs uppercase font-bold">Resueltas</span>
          <div className="text-3xl font-bold text-green-600">{resolved}</div>
          <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full" style={{ width: `${(resolved/total)*100}%` }}></div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <h3 className="font-bold text-gray-700 flex items-center gap-2"><BarChart3 size={18}/> Por Categoría</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blue-700 font-bold">Informática</span>
              <span>{itCount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${(itCount/total)*100}%` }}></div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-orange-700 font-bold">Mantenimiento</span>
              <span>{maintCount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full" style={{ width: `${(maintCount/total)*100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <span className="text-gray-500 text-xs uppercase font-bold">Zona más conflictiva</span>
        <div className="text-lg font-bold text-gray-800 mt-1 truncate">{topBuilding}</div>
      </div>
    </div>
  );
};

const IncidentsList = ({ 
  loading, 
  incidents, 
  filterStatus, setFilterStatus, 
  filterText, setFilterText, 
  filterBuilding, setFilterBuilding,
  onlyMyIncidents, setOnlyMyIncidents,
  currentUser,
  isAdmin, handleAdminAccess, 
  exportToCSV, setActiveTab,
  initiateResolve, reopenIncident, initiateDelete
}) => {
  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

  const savedName = localStorage.getItem('school_reporter_name');

  const filtered = incidents.filter(i => {
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    const matchText = filterText === '' || 
      i.description.toLowerCase().includes(filterText.toLowerCase()) || 
      i.room.toLowerCase().includes(filterText.toLowerCase()) ||
      (i.reporterName && i.reporterName.toLowerCase().includes(filterText.toLowerCase()));
    const matchBuilding = filterBuilding === 'all' || i.building === filterBuilding;
    const matchMine = !onlyMyIncidents || (savedName && i.reporterName === savedName);
    
    return matchStatus && matchText && matchBuilding && matchMine;
  });

  const copyLink = (building, floor, room) => {
    const params = new URLSearchParams();
    params.set('b', building);
    if(floor && floor !== 'N/A') params.set('f', floor);
    if(room) params.set('r', room);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    navigator.clipboard.writeText(url).then(() => {
        alert("¡Enlace copiado! Puedes crear un QR con él.");
    });
  };

  return (
    <div className="pb-20 space-y-4">
      {/* Panel de Admin y Filtros */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Filtros y Gestión</h3>
          {savedName && (
            <button
              onClick={() => setOnlyMyIncidents(!onlyMyIncidents)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${onlyMyIncidents ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
            >
              <User size={14} /> Mis Incidencias
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
           <div className="relative flex-1">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
               type="text" 
               placeholder="Buscar por texto o nombre..." 
               value={filterText}
               onChange={(e) => setFilterText(e.target.value)}
               className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none"
             />
           </div>
           <select 
             value={filterBuilding}
             onChange={(e) => setFilterBuilding(e.target.value)}
             className="text-sm border rounded-lg bg-gray-50 px-2 w-1/3 truncate"
           >
             <option value="all">Todos los edificios</option>
             {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
           </select>
        </div>

        <div className="flex gap-2 text-xs overflow-x-auto pb-1">
          <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded-full border ${filterStatus === 'all' ? 'bg-gray-800 text-white' : 'bg-white'}`}>Todas</button>
          <button onClick={() => setFilterStatus('pending')} className={`px-3 py-1 rounded-full border ${filterStatus === 'pending' ? 'bg-yellow-100 border-yellow-300' : 'bg-white'}`}>Pendientes</button>
          <button onClick={() => setFilterStatus('resolved')} className={`px-3 py-1 rounded-full border ${filterStatus === 'resolved' ? 'bg-green-100 border-green-300' : 'bg-white'}`}>Resueltas</button>
        </div>
      </div>
      
      {/* Herramientas de Admin (Exportar y Stats) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-2">
           <button 
              onClick={exportToCSV}
              className="py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
            >
              <Download size={14} /> Exportar Excel
            </button>
           <button 
              onClick={() => setActiveTab('stats')}
              className="py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
            >
              <BarChart3 size={14} /> Ver Estadísticas
            </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No se encontraron incidencias</div>
      ) : (
        filtered.map((incident) => {
          const isIT = incident.category === 'it';
          const cardStyle = isIT ? 'bg-blue-50/50 border-blue-100' : 'bg-orange-50/50 border-orange-100';
          
          return (
            <div 
              key={incident.id} 
              className={`p-4 rounded-xl border shadow-sm transition-all relative overflow-hidden ${
                incident.status === 'resolved' ? 'bg-gray-50 border-gray-200 opacity-80' : cardStyle
              } ${incident.priority === 'urgente' && incident.status === 'pending' ? 'border-l-4 border-l-red-500 ring-1 ring-red-100' : ''}`}
            >
              
              <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${isIT ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {isIT ? <Monitor size={14} /> : <Hammer size={14} />}
                    </span>
                    {incident.priority === 'urgente' && incident.status === 'pending' && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertCircle size={10} /> Urgente</span>
                    )}
                 </div>
                 
                 <div className="flex gap-2">
                    {isAdmin && (
                        <button 
                            onClick={() => copyLink(incident.building, incident.floor, incident.room)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 bg-white/50 rounded-lg border border-gray-200"
                            title="Copiar enlace para QR"
                        >
                            <QrCode size={16} />
                        </button>
                    )}
                    {isAdmin ? (
                       <>
                         {incident.status === 'pending' ? (
                            <button onClick={() => initiateResolve(incident.id)} className="text-xs font-bold px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm">✓ Resolver</button>
                         ) : (
                            <button onClick={() => reopenIncident(incident.id)} className="text-xs font-bold px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">Reabrir</button>
                         )}
                         <button onClick={() => initiateDelete(incident.id)} className="p-1.5 text-red-500 bg-red-50 rounded-lg border border-red-100"><Trash2 size={16} /></button>
                       </>
                    ) : (
                       <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${incident.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {incident.status === 'resolved' ? <CheckCircle2 size={12} /> : <Clock size={12} />} {incident.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                       </span>
                    )}
                 </div>
              </div>

              <div className="mb-1">
                 <h3 className={`font-semibold text-gray-800 ${incident.status === 'resolved' ? 'line-through text-gray-500' : ''}`}>{incident.description}</h3>
                 <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span className="font-medium text-gray-500">{getRelativeTime(incident.createdAt)}</span>
                    {incident.reporterName && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-gray-500 font-medium"><User size={10} /> {incident.reporterName}</span>
                      </>
                    )}
                 </div>
              </div>
              
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><Building size={10} /> {incident.building}</span>
                {incident.floor && incident.floor !== 'N/A' && (
                  <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><MapPin size={10} /> {incident.floor}</span>
                )}
                <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><span className="font-bold">{incident.room}</span></span>
                {incident.imageData && (
                   <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 cursor-pointer group relative">
                     <ImageIcon size={10} /> Foto adjunta
                     <div className="hidden group-hover:block absolute bottom-full mb-2 left-0 z-50 p-1 bg-white border shadow-lg rounded-lg">
                       <img src={incident.imageData} className="w-32 h-32 object-cover rounded" />
                     </div>
                   </span>
                )}
              </div>

              {incident.status === 'resolved' && incident.resolutionNote && (
                <div className="mt-3 bg-green-50 p-2 rounded-lg border border-green-100 text-xs text-green-800 flex gap-2 items-start">
                  <FileText size={14} className="mt-0.5" />
                  <div>
                    <span className="font-bold">Resolución:</span> {incident.resolutionNote}
                    <div className="text-[10px] text-green-600 mt-1">{getRelativeTime(incident.resolvedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// --- Componente Principal ---

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('new'); 
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
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
  const [submitError, setSubmitError] = useState(null); 

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [loginError, setLoginError] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [filterText, setFilterText] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [onlyMyIncidents, setOnlyMyIncidents] = useState(false);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  // Estados Modal Borrado
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Estado para Easter Egg
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  // --- Check URL Params for Magic Link ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pBuilding = params.get('b');
    const pFloor = params.get('f');
    const pRoom = params.get('r');

    if (pBuilding) {
      setFormData(prev => ({
        ...prev,
        building: pBuilding,
        floor: pFloor || 'N/A',
        room: pRoom || ''
      }));
      // Si hay ubicación completa, saltamos directamente al paso 3 (Detalles)
      if (pRoom) {
         setStep(3);
      } else {
         setStep(2);
      }
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
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setIncidents(docs);
      setLoading(false);
    }, (error) => console.error(error));
    return () => unsubscribe();
  }, [user]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);
  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result);
        updateForm('imageData', compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.reporterName) return;
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
    // -------------------------------------

    setIsSubmitting(true);
    
    if (formData.reporterName) {
      localStorage.setItem('school_reporter_name', formData.reporterName);
    }

    try {
      const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares');
      await addDoc(collectionRef, {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp(),
        authorId: user.uid
      });
      setStep(4); 
      setTimeout(() => {
        setStep(1);
        setFormData(prev => ({
          category: '', building: '', floor: '', room: '', description: '', priority: 'normal', imageData: null, reporterName: prev.reporterName
        }));
        // Limpiamos la URL por si venía de un QR
        window.history.replaceState({}, document.title, window.location.pathname);
        setActiveTab('list');
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error(error);
      setSubmitError("Error al enviar. ¿Es la foto muy grande o hay problemas de conexión?");
      setIsSubmitting(false);
    }
  };

  const handleAdminAccess = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setActiveTab('list');
    } else {
      setShowAuthModal(true);
      setAdminPin('');
      setLoginError(false);
    }
  };

  const submitPin = (e) => {
    e.preventDefault();
    if (adminPin === "1274") {
      setIsAdmin(true);
      setShowAuthModal(false);
    } else {
      setLoginError(true);
    }
  };

  const initiateResolve = (id) => {
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
        resolutionNote: resolveNote,
        resolvedAt: serverTimestamp()
      });
      setShowResolveModal(false);
      setResolvingId(null);
    } catch (e) { console.error(e); }
  };

  const reopenIncident = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'incidencias_escolares', id);
      await updateDoc(docRef, { status: 'pending', resolutionNote: null });
    } catch (e) { console.error(e); }
  };

  const initiateDelete = (id) => {
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
    } catch (e) { console.error(e); }
  };

  const exportToCSV = () => {
    const headers = ["Fecha", "Solicitante", "Estado", "Categoría", "Prioridad", "Edificio", "Planta", "Aula", "Descripción", "Nota Resolución"];
    const rows = incidents.map(i => [
      i.createdAt ? new Date(i.createdAt.seconds * 1000).toLocaleDateString() : '',
      `"${i.reporterName || 'Anónimo'}"`,
      i.status === 'resolved' ? 'Resuelto' : 'Pendiente',
      i.category === 'it' ? 'Informática' : 'Mantenimiento',
      i.priority,
      `"${i.building}"`,
      i.floor,
      i.room,
      `"${i.description.replace(/"/g, '""')}"`,
      i.resolutionNote ? `"${i.resolutionNote.replace(/"/g, '""')}"` : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `incidencias_escolares_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">Cargando aplicación...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-10">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.ibb.co/FLS9ybLj/cropped-Colegio-1.png" 
              alt="Logo Colegio" 
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="font-bold text-lg leading-tight">Gestión de Incidencias</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden md:flex bg-gray-100 p-1 rounded-lg">
               <button onClick={() => setActiveTab('new')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'new' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Reportar</button>
               <button onClick={() => setActiveTab('list')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Historial</button>
               {isAdmin && <button onClick={() => setActiveTab('stats')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'stats' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Stats</button>}
             </div>
             
             {/* Botón Admin en Cabecera */}
             <button 
                onClick={handleAdminAccess}
                className={`p-2 rounded-lg transition-colors ${isAdmin ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                title={isAdmin ? "Salir de Administración" : "Acceso Administración"}
             >
                {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
             </button>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 md:p-6">
        {activeTab === 'new' && (
          <div className="max-w-lg mx-auto bg-white md:shadow-lg md:rounded-2xl md:p-8 md:border min-h-[50vh] pb-24 md:pb-8">
             {step === 1 && (
               <StepCategory 
                 updateForm={updateForm} 
                 handleNext={handleNext} 
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
                 handleSubmit={handleSubmit} 
                 isSubmitting={isSubmitting} 
                 handleImageUpload={handleImageUpload}
                 submitError={submitError}
               />
             )}
             {step === 4 && (
                <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={40} className="text-green-600" /></div>
                  <h2 className="text-2xl font-bold text-gray-800">¡Enviado!</h2>
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
            filterText={filterText}
            setFilterText={setFilterText}
            filterBuilding={filterBuilding}
            setFilterBuilding={setFilterBuilding}
            onlyMyIncidents={onlyMyIncidents}
            setOnlyMyIncidents={setOnlyMyIncidents}
            currentUser={user}
            isAdmin={isAdmin}
            handleAdminAccess={handleAdminAccess}
            exportToCSV={exportToCSV}
            setActiveTab={setActiveTab}
            initiateResolve={initiateResolve}
            reopenIncident={reopenIncident}
            initiateDelete={initiateDelete} 
          />
        )}
        {activeTab === 'stats' && isAdmin && (
          <Dashboard incidents={incidents} />
        )}
      </main>

      {/* Tab Bar Móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex justify-around z-20 shadow-lg pb-6">
        <button onClick={() => setActiveTab('new')} className={`flex flex-col items-center gap-1 ${activeTab === 'new' ? 'text-blue-600' : 'text-gray-400'}`}><PlusCircle size={24} /><span className="text-xs">Reportar</span></button>
        <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-blue-600' : 'text-gray-400'}`}><History size={24} /><span className="text-xs">Historial</span></button>
        {isAdmin && <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 ${activeTab === 'stats' ? 'text-blue-600' : 'text-gray-400'}`}><BarChart3 size={24} /><span className="text-xs">Stats</span></button>}
      </div>

      {/* Modales */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4">Acceso Mantenimiento</h3>
            <form onSubmit={submitPin}>
              <input type="password" placeholder="PIN" value={adminPin} onChange={e=>setAdminPin(e.target.value)} className="w-full p-3 border rounded-lg mb-4 text-center text-2xl tracking-widest" autoFocus />
              {loginError && <p className="text-red-500 text-sm mb-4 text-center">PIN Incorrecto</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-3 border rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold">Entrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-2">Resolver Incidencia</h3>
            <p className="text-sm text-gray-500 mb-4">Añade una nota sobre la solución (opcional):</p>
            <textarea value={resolveNote} onChange={e=>setResolveNote(e.target.value)} placeholder="Ej: Pieza cambiada, tornillo apretado..." className="w-full p-3 border rounded-lg mb-4 h-24" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowResolveModal(false)} className="flex-1 py-2 border rounded-lg">Cancelar</button>
              <button onClick={confirmResolve} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Borrado */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">¿Borrar incidencia?</h3>
              <p className="text-sm text-gray-500 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">Sí, borrar</button>
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
             <button 
               onClick={() => {
                 setShowEasterEgg(false);
                 setStep(1);
                 setFormData(prev => ({
                   category: '', building: '', floor: '', room: '', description: '', priority: 'normal', imageData: null, reporterName: prev.reporterName
                 }));
               }}
               className="px-6 py-2 border border-white/30 text-white/50 hover:text-white hover:border-white rounded-full transition-all text-sm mt-8"
             >
               Cerrar
             </button>
          </div>
        </div>
      )}
      <div className="text-xs text-gray-300 text-center pb-20 md:pb-4 opacity-50">
        {APP_VERSION}
      </div>
      <div className="text-[1px] text-gray-100 select-none text-center">Хэрэв та үүнийг олвол та бас монголоор ярьдаг гэсэн үг</div>
    </div>
  );
}

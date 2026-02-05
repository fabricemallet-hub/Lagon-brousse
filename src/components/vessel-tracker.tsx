
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, updateDoc, deleteDoc, writeBatch, getDocs, addDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Navigation, 
  Anchor, 
  Copy, 
  LocateFixed, 
  ShieldAlert,
  Save,
  Zap,
  Bell,
  Play,
  Trash2,
  Plus,
  Minus,
  Info,
  Clock,
  WifiOff,
  Move,
  BatteryMedium,
  BatteryLow,
  BatteryFull,
  BatteryCharging,
  AlertOctagon,
  History,
  ExternalLink,
  User as UserIcon,
  MessageSquare,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// CONFIGURATION DES SEUILS
const IMMOBILITY_THRESHOLD_METERS = 20; 
const IMMOBILITY_START_SECONDS = 30;    
const THROTTLE_UPDATE_MS = 10000;       
const HISTORY_DEBOUNCE_MS = 60000; // 1 minute de temporisation pour l'historique

interface StatusEvent {
  id?: string;
  status: 'moving' | 'stationary' | 'offline';
  timestamp: any; // Firestore timestamp
  location: { lat: number, lng: number } | null;
}

const defaultVesselSounds = [
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'sonar', label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3' },
];

const PREDEFINED_MESSAGES = [
  {
    category: "1. DÉTRESSE VITALE (URGENCE ABSOLUE)",
    urgency: "critical",
    color: "text-red-600",
    btnBorder: "border-red-200",
    btnHover: "hover:bg-red-50",
    messages: [
      { id: 'voie_eau', label: "VOIE D'EAU", text: "MAYDAY - Voie d'eau importante à bord. Le navire coule. Besoin d'assistance immédiate. Ma position ci-jointe." },
      { id: 'homme_mer', label: "HOMME À LA MER", text: "MAYDAY - Homme à la mer. Position du signal au moment de la chute. Début des recherches en cours." },
      { id: 'incendie', label: "INCENDIE", text: "MAYDAY - Feu à bord non maîtrisé. Risque d'explosion. Nous évacuons le navire. Ma position ci-jointe." },
    ]
  },
  {
    category: "2. URGENCE MÉDICALE",
    urgency: "high",
    color: "text-orange-600",
    btnBorder: "border-orange-200",
    btnHover: "hover:bg-orange-50",
    messages: [
      { id: 'blessure', label: "BLESSURE GRAVE", text: "PAN PAN - Urgence médicale à bord. Un blessé grave (conscient/inconscient). Besoin d'une évacuation médicale." },
      { id: 'malaise', label: "MALAISE", text: "PAN PAN - Suspicion de malaise cardiaque ou AVC. Besoin d'une assistance médicale urgente." },
    ]
  },
  {
    category: "3. PANNE ET ASSISTANCE (SÉCURITÉ)",
    urgency: "medium",
    color: "text-amber-600",
    btnBorder: "border-orange-200",
    btnHover: "hover:bg-amber-50",
    messages: [
      { id: 'panne', label: "PANNE MOTEUR", text: "PAN PAN - Panne moteur totale. Navire à la dérive vers la côte/les rochers. Demande de remorquage." },
      { id: 'gouvernail', label: "GOUVERNAIL / HÉLICE", text: "PAN PAN - Gouvernail cassé / Bout dans l'hélice. Navire non manœuvrant. Ma position ci-jointe." },
      { id: 'echouement', label: "ÉCHOUEMENT", text: "PAN PAN - Navire échoué. Pas de voie d'eau apparente mais incapable de se dégager seul. Marée montante/descendante." },
    ]
  },
  {
    category: "4. MESSAGES DE \"CONFORT\" / PRÉVENTION",
    urgency: "low",
    color: "text-blue-600",
    btnBorder: "border-blue-200",
    btnHover: "hover:bg-blue-50",
    messages: [
      { id: 'retard', label: "RETARD", text: "Info Tablo : Nous avons du retard sur l'horaire d'arrivée prévu. Tout va bien à bord. Nouvelle position jointe." },
      { id: 'mouillage_prev', label: "MOUILLAGE", text: "Info Tablo : Nous sommes au mouillage pour la nuit à cette position. Fin de navigation." },
    ]
  }
];

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; 
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function VesselTracker() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [vesselHistory, setVesselHistory] = useState<string[]>([]);
  const [customSmsMessage, setCustomSmsMessage] = useState('');
  const [isQuickMsgOpen, setIsQuickMsgOpen] = useState(false);
  const [isSmsConfirmOpen, setIsSmsConfirmOpen] = useState(false);

  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [vesselVolume, setVesselVolume] = useState(0.8);
  const [notifySettings, setNotifySettings] = useState({ moving: true, stationary: true, offline: true });
  const [notifySounds, setNotifySounds] = useState({ moving: 'cloche', stationary: 'sonar', offline: 'alerte' });
  const prevVesselStatusRef = useRef<string | null>(null);

  const [isWatchEnabled, setIsWatchEnabled] = useState(false);
  const [watchType, setWatchType] = useState<'moving' | 'stationary' | 'offline'>('stationary');
  const [watchDuration, setWatchDuration] = useState(15);
  const [watchSound, setWatchSound] = useState('alerte');
  const [isWatchAlerting, setIsWatchAlerting] = useState(false);
  const [statusStartTime, setStatusStartTime] = useState<number | null>(null);
  const [elapsedString, setElapsedString] = useState<string>('0s');

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<number>(Date.now());
  const [vesselStatus, setVesselStatus] = useState<'moving' | 'stationary'>('moving');
  const [lastValidLocation, setLastValidLocation] = useState<{lat: number, lng: number} | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(1);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  
  const watchIdRef = useRef<number | null>(null);
  const lastFirestoreUpdateRef = useRef<number>(0);
  const statusCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const historyDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const activeVesselId = useMemo(() => mode === 'sender' ? sharingId : vesselIdToFollow.trim().toUpperCase(), [mode, sharingId, vesselIdToFollow]);

  // Sound Library from Firestore
  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    const list = [...defaultVesselSounds];
    if (dbSounds) {
        dbSounds.forEach(s => {
            const hasRightCategory = !s.categories || s.categories.includes('Vessel') || s.categories.includes('General');
            if (hasRightCategory && !list.find(l => l.url === s.url)) {
                list.push({ id: s.id, label: s.label, url: s.url });
            }
        });
    }
    return list;
  }, [dbSounds]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const vesselRef = useMemoFirebase(() => {
    if (!firestore || !activeVesselId) return null;
    return doc(firestore, 'vessels', activeVesselId);
  }, [firestore, activeVesselId]);
  const { data: remoteVessel } = useDoc<VesselStatus>(vesselRef);

  // History Collection (Shared between Emitter and Receiver)
  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !activeVesselId) return null;
    return query(collection(firestore, 'vessels', activeVesselId, 'history'), orderBy('timestamp', 'desc'));
  }, [firestore, activeVesselId]);
  const { data: remoteHistory } = useCollection<StatusEvent>(historyQuery);

  const currentEffectiveStatus = useMemo(() => {
    if (mode === 'sender') {
      return isSharing ? vesselStatus : 'offline';
    } else {
      return (remoteVessel && remoteVessel.isSharing) ? remoteVessel.status : 'offline';
    }
  }, [mode, isSharing, vesselStatus, remoteVessel]);

  const defaultSmsText = useMemo(() => {
    if (mode === 'receiver') {
      const name = remoteVessel?.displayName || vesselIdToFollow || 'Capitaine';
      const statusWord = currentEffectiveStatus === 'moving' ? 'en navigation' : 'immobile';
      return `Alerte : ${name} est ${statusWord} en mer depuis ${elapsedString}. Je n'arrive pas à joindre l'équipage. Voici mes coordonnées GPS.`;
    }
    
    return `SOS j'ai un souci avec le bateau contact immédiatement les secours en mer pour me porter secours. voici mes coordonnées GPS`;
  }, [mode, remoteVessel, vesselIdToFollow, currentEffectiveStatus, elapsedString]);

  const finalSmsBody = useMemo(() => {
    const mainText = customSmsMessage.trim() || defaultSmsText;
    const posUrl = lastValidLocation ? `https://www.google.com/maps?q=${lastValidLocation.lat.toFixed(6)},${lastValidLocation.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    return `${mainText}\n\nPosition : ${posUrl}`;
  }, [customSmsMessage, defaultSmsText, lastValidLocation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('vessel_follow_history');
      if (savedHistory) {
        try { setVesselHistory(JSON.parse(savedHistory)); } catch (e) {}
      }
      const savedCustomId = localStorage.getItem('vessel_custom_id');
      if (savedCustomId) setCustomSharingId(savedCustomId);
      
      const savedNickname = localStorage.getItem('vessel_nickname');
      if (savedNickname) setVesselNickname(savedNickname);
    }
  }, []);

  useEffect(() => {
    if (userProfile?.vesselPrefs) {
      const prefs = userProfile.vesselPrefs;
      setIsNotifyEnabled(prefs.isNotifyEnabled ?? false);
      setVesselVolume(prefs.vesselVolume ?? 0.8);
      if (prefs.notifySettings) setNotifySettings(prefs.notifySettings);
      if (prefs.notifySounds) setNotifySounds(prefs.notifySounds);
      setIsWatchEnabled(prefs.isWatchEnabled ?? false);
      setWatchType(prefs.watchType ?? 'stationary');
      setWatchDuration(prefs.watchDuration ?? 15);
      setWatchSound(prefs.watchSound ?? 'alerte');
    }
    if (userProfile?.emergencyContact) {
      setEmergencyContact(userProfile.emergencyContact);
    }
    if (userProfile?.displayName && !vesselNickname) {
      setVesselNickname(userProfile.displayName);
    }
    if (userProfile?.vesselSmsMessage !== undefined) {
      setCustomSmsMessage(userProfile.vesselSmsMessage);
    }
  }, [userProfile, vesselNickname]);

  useEffect(() => {
    if (!user || !firestore || isProfileLoading) return;
    const timeout = setTimeout(() => {
      const prefs = { isNotifyEnabled, vesselVolume, notifySettings, notifySounds, isWatchEnabled, watchType, watchDuration, watchSound };
      updateDoc(doc(firestore, 'users', user.uid), { 
        vesselPrefs: prefs,
        vesselSmsMessage: customSmsMessage 
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timeout);
  }, [user, firestore, isProfileLoading, isNotifyEnabled, vesselVolume, notifySettings, notifySounds, isWatchEnabled, watchType, watchDuration, watchSound, customSmsMessage]);

  const addToHistory = useCallback((id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;
    setVesselHistory(prev => {
      if (prev.includes(cleanId)) return prev;
      const next = [cleanId, ...prev].slice(0, 5);
      localStorage.setItem('vessel_follow_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromHistory = (id: string) => {
    setVesselHistory(prev => {
      const next = prev.filter(x => x !== id);
      localStorage.setItem('vessel_follow_history', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveNickname = useCallback((name: string) => {
    setVesselNickname(name);
    localStorage.setItem('vessel_nickname', name);
  }, []);

  const handleSaveCustomId = useCallback(() => {
    const id = customSharingId.trim().toUpperCase();
    localStorage.setItem('vessel_custom_id', id);
    setCustomSharingId(id);
    addToHistory(id);
    toast({ title: "ID enregistré", description: `Partage actif sur ID: ${id || 'Défaut'}` });
  }, [customSharingId, addToHistory, toast]);

  const handleSaveEmergencyContact = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), { emergencyContact });
        toast({ title: "Contact enregistré" });
    } catch (e) {}
  };

  const handleResetSms = () => {
    setCustomSmsMessage('');
    toast({ title: "Message réinitialisé" });
  };

  const playAlertSound = useCallback((soundId: string) => {
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselVolume, availableSounds]);

  // --- LOGIQUE DE TEMPORISATION DE L'HISTORIQUE ---
  useEffect(() => {
    if (currentEffectiveStatus !== prevVesselStatusRef.current) {
      const now = Date.now();
      const loc = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : lastValidLocation);
      
      setStatusStartTime(now);
      
      // On lance le chrono de temporisation (1 min) pour l'écriture en DB
      if (historyDebounceTimerRef.current) clearTimeout(historyDebounceTimerRef.current);
      
      if (prevVesselStatusRef.current !== null) {
        const targetStatus = currentEffectiveStatus as any;
        
        historyDebounceTimerRef.current = setTimeout(async () => {
          if (!firestore || !activeVesselId) return;
          
          // On n'écrit que si l'état est stable depuis 1 min
          try {
            const historyRef = collection(firestore, 'vessels', activeVesselId, 'history');
            await addDoc(historyRef, {
              status: targetStatus,
              timestamp: serverTimestamp(),
              location: loc
            });
          } catch (e) {
            console.error("Error writing to history:", e);
          }
        }, HISTORY_DEBOUNCE_MS);

        // Alertes immédiates dans l'UI (Toasts & Sons)
        const statusLabels = { moving: 'En route', stationary: 'Immobile', offline: 'Perte réseau' };
        toast({
          title: "Changement d'état",
          description: `Navire ${statusLabels[currentEffectiveStatus as keyof typeof statusLabels]} à ${format(now, 'HH:mm', { locale: fr })}`,
        });

        if (isNotifyEnabled && mode === 'receiver') {
            let s = '';
            if (currentEffectiveStatus === 'moving' && notifySettings.moving) s = notifySounds.moving;
            if (currentEffectiveStatus === 'stationary' && notifySettings.stationary) s = notifySounds.stationary;
            if (currentEffectiveStatus === 'offline' && notifySettings.offline) s = notifySounds.offline;
            if (s) playAlertSound(s);
        }
      }
      
      prevVesselStatusRef.current = currentEffectiveStatus;
    }
  }, [currentEffectiveStatus, mode, currentPos, remoteVessel, lastValidLocation, isNotifyEnabled, notifySettings, notifySounds, playAlertSound, toast, firestore, activeVesselId]);

  useEffect(() => {
    if (!statusStartTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - statusStartTime) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) setElapsedString(`${h}h ${m}m`);
      else if (m > 0) setElapsedString(`${m}m ${s}s`);
      else setElapsedString(`${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [statusStartTime]);

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) {
      try { await wakeLock.release(); setWakeLock(null); toast({ title: "Écran libéré" }); } catch (e) { setWakeLock(null); }
    } else {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (lock) {
          setWakeLock(lock);
          toast({ title: "Mode éveil actif" });
          lock.addEventListener('release', () => setWakeLock(null));
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Permission bloquée", description: "Le mode éveil est limité par ce navigateur." });
      }
    }
  };

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    const docRef = doc(firestore, 'vessels', sharingId);
    setDoc(docRef, { 
      userId: user.uid, 
      displayName: vesselNickname || user.displayName || 'Capitaine', 
      isSharing: isSharing, 
      lastActive: serverTimestamp(), 
      ...data 
    }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender') {
      if (statusCheckTimerRef.current) clearInterval(statusCheckTimerRef.current);
      return;
    }

    statusCheckTimerRef.current = setInterval(() => {
      const now = Date.now();
      const idleSeconds = (now - lastMovementTime) / 1000;
      
      if (vesselStatus === 'moving' && idleSeconds >= IMMOBILITY_START_SECONDS) {
        setVesselStatus('stationary');
        updateVesselInFirestore({ 
          status: 'stationary', 
          isSharing: true, 
          batteryLevel, 
          isCharging 
        });
      }
    }, 5000); 

    return () => { if (statusCheckTimerRef.current) clearInterval(statusCheckTimerRef.current); };
  }, [isSharing, mode, vesselStatus, lastMovementTime, batteryLevel, isCharging, updateVesselInFirestore]);

  useEffect(() => {
    if (!isSharing || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    const syncBattery = async () => {
      if ('getBattery' in navigator) {
        const battery: any = await (navigator as any).getBattery();
        setBatteryLevel(battery.level);
        setIsCharging(battery.charging);
        battery.onlevelchange = () => setBatteryLevel(battery.level);
        battery.onchargingchange = () => setIsCharging(battery.charging);
      }
    };
    syncBattery();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const newPos = { lat: newLat, lng: newLng };
        const now = Date.now();
        setCurrentPos(newPos);
        setLastValidLocation(newPos);
        
        if (!anchorPos) {
          setAnchorPos(newPos);
          setLastMovementTime(now);
          updateVesselInFirestore({ 
            location: { latitude: newLat, longitude: newLng }, 
            status: 'moving', 
            isSharing: true,
            batteryLevel: batteryLevel,
            isCharging: isCharging
          });
          lastFirestoreUpdateRef.current = now;
          return;
        }
        
        const dist = getDistance(newLat, newLng, anchorPos.lat, anchorPos.lng);
        
        if (dist > IMMOBILITY_THRESHOLD_METERS) {
          if (vesselStatus !== 'moving') setVesselStatus('moving');
          setAnchorPos(newPos);
          setLastMovementTime(now);
          if (now - lastFirestoreUpdateRef.current > THROTTLE_UPDATE_MS) {
            updateVesselInFirestore({ 
              location: { latitude: newLat, longitude: newLng }, 
              status: 'moving', 
              isSharing: true,
              batteryLevel: batteryLevel,
              isCharging: isCharging
            });
            lastFirestoreUpdateRef.current = now;
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, anchorPos, vesselStatus, batteryLevel, isCharging, updateVesselInFirestore]);

  useEffect(() => {
    if (mode === 'receiver' && remoteVessel?.location) {
      setLastValidLocation({ lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude });
    }
  }, [mode, remoteVessel]);

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : lastValidLocation);
    if (pos && map) { map.panTo(pos); map.setZoom(15); }
  };

  const handleResetHistory = async () => {
    if (!firestore || !activeVesselId) return;
    try {
      const historyRef = collection(firestore, 'vessels', activeVesselId, 'history');
      const snap = await getDocs(historyRef);
      const batch = writeBatch(firestore);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Historique réinitialisé" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const copyCoordinates = (lat: number, lng: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)},${lng.toFixed(6)}`);
    toast({ title: "Copié" });
  };

  const sendEmergencySms = () => {
    if (!emergencyContact.trim()) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(finalSmsBody)}`;
  };

  const displayVessel = mode === 'sender' 
    ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: vesselNickname || 'Moi', isSharing: true, batteryLevel, isCharging } : null) 
    : remoteVessel;

  const isBatteryDischarged = mode === 'receiver' && remoteVessel && !remoteVessel.isSharing && (remoteVessel.batteryLevel ?? 1) <= 0.05;

  const BatteryIconComp = ({ level, isCharging, className }: { level?: number, isCharging?: boolean, className?: string }) => {
    if (level === undefined) return null;
    const colorClass = isCharging ? "text-blue-500" : level > 0.6 ? "text-green-500" : level > 0.2 ? "text-orange-500" : "text-red-500";
    if (isCharging) return <BatteryCharging className={cn("size-4", colorClass, className)} />;
    if (level > 0.6) return <BatteryFull className={cn("size-4", colorClass, className)} />;
    if (level > 0.2) return <BatteryMedium className={cn("size-4", colorClass, className)} />;
    return <BatteryLow className={cn("size-4 animate-pulse", colorClass, className)} />;
  };

  const lastActiveTime = remoteVessel?.lastActive ? format(remoteVessel.lastActive.toDate(), 'HH:mm', { locale: fr }) : '--:--';

  const statusLabel = useMemo(() => {
    if (currentEffectiveStatus === 'moving') return 'EN MOUVEMENT';
    if (currentEffectiveStatus === 'stationary') return 'MOUILLAGE';
    return 'HORS LIGNE';
  }, [currentEffectiveStatus]);

  const historyToShow = useMemo(() => remoteHistory?.slice(0, 5) || [], [remoteHistory]);

  const handleSelectPredefinedMessage = (text: string) => {
    setCustomSmsMessage(text);
    setIsQuickMsgOpen(false);
    setTimeout(() => {
      setIsSmsConfirmOpen(true);
    }, 150);
  };

  return (
    <div className="space-y-6 pb-12">
      {isWatchAlerting && (
        <div className="fixed top-0 inset-x-0 z-[200] p-4 bg-red-600 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="max-w-md mx-auto flex flex-col items-center gap-4 text-white">
            <ShieldAlert className="size-10 animate-pulse" />
            <p className="font-black uppercase text-lg">ALERTE SURVEILLANCE</p>
            <Button className="w-full bg-white text-red-600 font-black h-16 rounded-xl" onClick={() => setIsWatchAlerting(false)}>ARRÊTER</Button>
          </div>
        </div>
      )}

      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase tracking-tighter"><Navigation className="text-primary size-5" /> Vessel Tracker</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex bg-muted/50 p-1 rounded-xl border">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-bold h-10 rounded-lg" onClick={() => setMode('sender')}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-bold h-10 rounded-lg" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          </div>

          <div className="space-y-6">
            {mode === 'sender' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card shadow-sm">
                  <div className="space-y-0.5"><Label className="text-base font-black uppercase leading-none">Partager ma position</Label><p className="text-[9px] text-muted-foreground uppercase font-bold">Flux GPS live</p></div>
                  <Switch checked={isSharing} onCheckedChange={setIsSharing} className="scale-110" />
                </div>
                
                <div className="space-y-4 rounded-2xl border-2 border-dashed p-4 bg-muted/10">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-2">
                      <UserIcon className="size-3" /> Surnom / Nom du navire
                    </Label>
                    <Input 
                      placeholder="Ex: Mon Bateau..." 
                      value={vesselNickname} 
                      onChange={e => handleSaveNickname(e.target.value)} 
                      className="font-black h-12 border-2 rounded-xl" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-2">
                      <Zap className="size-3" /> ID de partage personnalisé
                    </Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="ID (ex: BATEAU-NC)..." 
                        value={customSharingId} 
                        onChange={e => setCustomSharingId(e.target.value)} 
                        disabled={isSharing} 
                        className="font-black text-center uppercase h-12 border-2 rounded-xl" 
                      />
                      <Button variant="outline" size="icon" className="h-12 w-12 border-2 rounded-xl" onClick={handleSaveCustomId} disabled={isSharing}><Save className="size-5" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Navire à suivre (ID)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center uppercase h-12 border-2 rounded-xl" />
                    <Button variant="secondary" size="icon" className="h-12 w-12 border-2 rounded-xl" onClick={() => { if(vesselIdToFollow) addToHistory(vesselIdToFollow); }}><Plus className="size-5" /></Button>
                  </div>
                </div>
              </div>
            )}

            {vesselHistory.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Historique des IDs</Label>
                <div className="flex flex-wrap gap-2 px-1">
                  {vesselHistory.map(id => (
                    <Badge key={id} variant="secondary" className="pl-3 pr-1 h-8 font-black text-[10px] cursor-pointer rounded-full bg-muted/50 hover:bg-muted" onClick={() => mode === 'sender' ? setCustomSharingId(id) : setVesselIdToFollow(id)}>
                      {id} 
                      <button onClick={(e) => { e.stopPropagation(); removeFromHistory(id); }} className="ml-2 p-1 hover:bg-black/10 rounded-full">
                        <Trash2 className="size-3 text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button variant={wakeLock ? "secondary" : "outline"} className={cn("w-full gap-2 font-black h-12 border-2 text-xs uppercase tracking-widest rounded-xl", wakeLock && "bg-primary/10 text-primary border-primary")} onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-current")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>

            {mode === 'receiver' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card shadow-sm">
                    <div className="flex items-center gap-3"><Bell className={cn("size-5", isNotifyEnabled && "text-primary fill-current")} /><Label className="font-black uppercase text-sm">Alertes Sonores</Label></div>
                    <Switch checked={isNotifyEnabled} onCheckedChange={setIsNotifyEnabled} className="scale-110" />
                </div>
                {isNotifyEnabled && (
                  <div className="p-4 border-2 rounded-2xl bg-muted/20 space-y-6 shadow-inner animate-in fade-in">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1"><span className="text-[10px] font-black uppercase text-muted-foreground">Volume</span><span className="font-black text-primary text-xs">{Math.round(vesselVolume * 100)}%</span></div>
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="size-8 shrink-0 rounded-full border-2" 
                                onClick={() => setVesselVolume(prev => Math.max(0, parseFloat((prev - 0.1).toFixed(1))))}
                            >
                                <Minus className="size-3" />
                            </Button>
                            <Slider value={[vesselVolume]} min={0} max={1} step={0.1} onValueChange={v => setVesselVolume(v[0])} className="flex-grow" />
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="size-8 shrink-0 rounded-full border-2" 
                                onClick={() => setVesselVolume(prev => Math.min(1, parseFloat((prev + 0.1).toFixed(1))))}
                            >
                                <Plus className="size-3" />
                            </Button>
                        </div>
                    </div>
                    <Accordion type="single" collapsible className="space-y-2">
                        <AccordionItem value="sounds" className="border-none rounded-xl bg-card overflow-hidden shadow-sm">
                            <AccordionTrigger className="text-[10px] font-black uppercase px-4 h-10 hover:no-underline bg-muted/10">Configuration des sons</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-t border-dashed">
                                {['moving', 'stationary', 'offline'].map(st => (
                                    <div key={st} className="space-y-2">
                                        <div className="flex items-center justify-between"><Label className="text-[10px] font-black uppercase opacity-60">{st === 'moving' ? 'En route' : st === 'stationary' ? 'Immobile' : 'Perte réseau'}</Label><Switch checked={(notifySettings as any)[st]} onCheckedChange={val => setNotifySettings({...notifySettings, [st]: val})} /></div>
                                        <div className="flex gap-2">
                                          <Select value={(notifySounds as any)[st]} onValueChange={v => setNotifySounds({...notifySounds, [st]: v})}>
                                            <SelectTrigger className="h-10 text-xs border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                                          </Select>
                                          <Button variant="outline" size="icon" className="h-10 w-10 border-2 rounded-xl" onClick={() => playAlertSound((notifySounds as any)[st])}><Play className="size-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="watch" className="border-none rounded-xl bg-card overflow-hidden shadow-sm">
                            <AccordionTrigger className="text-[10px] font-black uppercase px-4 h-10 hover:no-underline bg-muted/10">Veille critique</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4 border-t border-dashed">
                                <div className="flex items-center justify-between"><Label className="text-xs font-black uppercase">Activer</Label><Switch checked={isWatchEnabled} onCheckedChange={setIsWatchEnabled} /></div>
                                {isWatchEnabled && (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Statut</Label><Select value={watchType} onValueChange={v => setWatchType(v as any)}><SelectTrigger className="h-10 text-xs border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stationary">Immobile</SelectItem><SelectItem value="moving">En mouvement</SelectItem><SelectItem value="offline">Perte réseau</SelectItem></SelectContent></Select></div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-bold uppercase opacity-60">Durée</Label>
                                                <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                    {watchDuration >= 60 ? `${Math.floor(watchDuration / 60)}h${watchDuration % 60 > 0 ? ` ${watchDuration % 60}min` : ''}` : `${watchDuration} min`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className="size-8 shrink-0 rounded-full border-2" 
                                                    onClick={() => setWatchDuration(prev => Math.max(1, prev - 1))}
                                                >
                                                    <Minus className="size-3" />
                                                </Button>
                                                <Slider value={[watchDuration]} min={1} max={1440} step={1} onValueChange={v => setWatchDuration(v[0])} className="flex-grow" />
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className="size-8 shrink-0 rounded-full border-2" 
                                                    onClick={() => setWatchDuration(prev => Math.min(1440, prev + 1))}
                                                >
                                                    <Plus className="size-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-1"><Label className="text-[10px] font-bold uppercase opacity-60">Son</Label><Select value={watchSound} onValueChange={v => setWatchSound(v)}><SelectTrigger className="h-10 text-xs border-2"><SelectValue /></SelectTrigger><SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-2 shadow-xl rounded-2xl flex flex-col">
        <div className="h-[350px] relative bg-muted/20 shrink-0">
          {!isLoaded ? <Skeleton className="h-full w-full" /> : (
            <GoogleMap mapContainerClassName="w-full h-full" center={displayVessel?.location ? { lat: displayVessel.location.latitude, lng: displayVessel.location.longitude } : (lastValidLocation || { lat: -22.27, lng: 166.45 })} zoom={15} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}>
                {currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><div style={{ transform: 'translate(-50%, -50%)' }}><div className="size-4 bg-blue-500 rounded-full border-2 border-white shadow-2xl animate-pulse"></div></div></OverlayView>}
                {displayVessel?.location && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded shadow-2xl text-[10px] font-black whitespace-nowrap border border-white/20 flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", displayVessel.status === 'moving' ? "bg-green-400 animate-pulse" : "bg-amber-400")}></span>
                        {displayVessel.displayName}
                        {displayVessel.batteryLevel !== undefined && (
                          <span className="flex items-center gap-1 ml-1 border-l border-white/20 pl-1">
                            <BatteryIconComp level={displayVessel.batteryLevel} isCharging={displayVessel.isCharging} className="size-3" />
                            {Math.round(displayVessel.batteryLevel * 100)}%
                          </span>
                        )}
                        </div>
                        <div className={cn("p-2 rounded-full shadow-2xl border-2 border-white transition-all", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                        {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
            </GoogleMap>
          )}
          <Button size="icon" className="absolute top-3 right-3 shadow-lg h-10 w-10 bg-background/90 border-2 rounded-xl" onClick={handleRecenter}><LocateFixed className="size-5" /></Button>
        </div>

        {isBatteryDischarged && (
          <div className="bg-red-600 text-white p-6 flex flex-col items-center text-center gap-3 animate-pulse border-y-4 border-red-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <AlertOctagon className="size-12" />
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Batterie Déchargée</h3>
              <p className="text-xs font-bold opacity-90 mt-1 uppercase">Signal perdu à {lastActiveTime}</p>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-lg border border-white/30 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase">Le téléphone émetteur s'est probablement éteint.</p>
            </div>
          </div>
        )}

        <div className="bg-card border-t-2 p-4 flex flex-col gap-3">
            <div className={cn(
                "flex items-center justify-between p-4 rounded-2xl border-2 shadow-sm transition-all duration-500",
                currentEffectiveStatus === 'moving' ? "bg-green-50 border-green-200" : currentEffectiveStatus === 'stationary' ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "size-12 rounded-2xl flex items-center justify-center text-white shadow-md",
                        currentEffectiveStatus === 'moving' ? "bg-green-600" : currentEffectiveStatus === 'stationary' ? "bg-amber-600" : "bg-red-600"
                    )}>
                        {currentEffectiveStatus === 'moving' ? <Move className="size-6" /> : currentEffectiveStatus === 'stationary' ? <Anchor className="size-6" /> : <WifiOff className="size-6" />}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                              "font-black text-lg uppercase tracking-tighter leading-none",
                              currentEffectiveStatus === 'moving' ? "text-green-700" : currentEffectiveStatus === 'stationary' ? "text-amber-700" : "text-red-700"
                          )}>
                              {statusLabel}
                          </p>
                          {displayVessel?.batteryLevel !== undefined && (
                            <div className="flex items-center gap-1.5 ml-1 border-l border-border/50 pl-2">
                              <BatteryIconComp level={displayVessel.batteryLevel} isCharging={displayVessel.isCharging} className="size-6" />
                              <span className={cn(
                                "font-black text-sm",
                                displayVessel.isCharging ? "text-blue-600" : displayVessel.batteryLevel > 0.6 ? "text-green-600" : displayVessel.batteryLevel > 0.2 ? "text-orange-600" : "text-red-600"
                              )}>
                                {Math.round(displayVessel.batteryLevel * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-muted-foreground/60">
                            <Clock className="size-3.5" /> depuis {elapsedString}
                        </div>
                    </div>
                </div>
                {displayVessel?.isSharing && (
                    <Badge className={cn(
                        "font-black uppercase text-[10px] border-none px-3 h-6 flex items-center justify-center rounded-lg shadow-sm",
                        currentEffectiveStatus === 'moving' ? "bg-green-600" : "bg-amber-600"
                    )}>LIVE</Badge>
                )}
            </div>

            <div className="p-3 bg-muted/20 border rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Dernière position connue</p>
                    <p className="font-mono text-xs font-bold">
                        {lastValidLocation ? `${lastValidLocation.lat.toFixed(6)}, ${lastValidLocation.lng.toFixed(6)}` : "Recherche GPS..."}
                    </p>
                </div>
                {lastValidLocation && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => copyCoordinates(lastValidLocation.lat, lastValidLocation.lng)}>
                        <Copy className="size-4" />
                    </Button>
                )}
            </div>

            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <History className="size-3" /> Historique des changements d'état
                </h4>
                <Button variant="ghost" size="sm" onClick={handleResetHistory} className="h-6 px-2 text-[9px] font-black uppercase text-destructive hover:bg-destructive/10">
                  Effacer
                </Button>
              </div>
              <div className="space-y-2">
                {historyToShow.length > 0 ? historyToShow.map((event, idx) => {
                  const label = event.status === 'moving' ? 'MOUVEMENT' : event.status === 'stationary' ? 'MOUILLAGE' : 'SIGNAL PERDU';
                  const color = event.status === 'moving' ? 'text-green-600 border-green-100' : event.status === 'stationary' ? 'text-amber-600 border-amber-100' : 'text-red-600 border-red-100';
                  const eventTime = event.timestamp ? format(event.timestamp.toDate(), 'HH:mm:ss', { locale: fr }) : '--:--:--';
                  
                  return (
                    <div key={idx} className={cn("flex items-center justify-between p-3 border-2 rounded-xl bg-white shadow-sm text-[11px] animate-in fade-in slide-in-from-left-2", color)}>
                      <div className="flex items-center gap-4">
                        <span className="font-black tabular-nums opacity-40">{eventTime}</span>
                        <span className="font-black uppercase tracking-tight">{label}</span>
                      </div>
                      {event.location && (
                        <button 
                          className="flex items-center gap-1.5 text-primary/80 hover:text-primary font-black uppercase text-[9px]"
                          onClick={() => {
                            const url = `https://www.google.com/maps?q=${event.location!.lat},${event.location!.lng}`;
                            window.open(url, '_blank');
                          }}
                        >
                          GPS <ExternalLink className="size-3" />
                        </button>
                      )}
                    </div>
                  );
                }) : (
                  <div className="text-center py-6 border-2 border-dashed rounded-xl opacity-30 italic text-[10px] uppercase font-bold">
                    Aucun événement récent validé
                  </div>
                )}
                <p className="text-[8px] italic text-muted-foreground text-center uppercase tracking-tighter opacity-60">
                  Note : L'historique attend 1 min de stabilité avant d'enregistrer un état.
                </p>
              </div>
            </div>
        </div>
        
        <CardFooter className="bg-muted/10 p-4 flex flex-col gap-4 border-t-2">
          <div className="w-full space-y-6">
            <div className="space-y-4 rounded-2xl border-2 border-dashed p-4 bg-white/50 shadow-inner">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-2">
                  <MessageSquare className="size-3" /> Message SMS personnalisé
                </Label>
                <Button variant="ghost" size="sm" onClick={handleResetSms} className="h-6 px-2 text-[9px] font-black uppercase text-muted-foreground hover:text-primary">
                  <RotateCcw className="size-3 mr-1" /> Réinitialiser
                </Button>
              </div>
              <Textarea 
                placeholder="Tapez votre message d'alerte ici..." 
                value={customSmsMessage} 
                onChange={e => setCustomSmsMessage(e.target.value)}
                className="text-xs font-bold border-2 rounded-xl min-h-[80px] bg-white"
              />
              
              <div className="space-y-1.5 p-3 bg-muted/30 border-2 rounded-xl">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider mb-1">Aperçu du SMS final :</p>
                <div className="text-[11px] leading-relaxed font-medium">
                  <p>{customSmsMessage.trim() || defaultSmsText}</p>
                  <p className="mt-2 text-primary font-bold">Position : https://www.google.com/maps?q=...</p>
                </div>
              </div>
            </div>

            <AlertDialog open={isSmsConfirmOpen} onOpenChange={setIsSmsConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full h-14 bg-red-600 text-sm font-black shadow-lg flex items-center justify-center gap-2 uppercase rounded-xl border-b-4 border-red-800 transition-all active:scale-95" disabled={!lastValidLocation}>
                  <ShieldAlert className="size-6" /> ALERTE SMS
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-2">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black uppercase tracking-tighter text-left">Confirmer l'alerte ?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-medium leading-relaxed text-left space-y-3">
                    <p>Cela enverra immédiatement un SMS de détresse à <span className="font-bold text-foreground">{emergencyContact || "votre contact d'urgence"}</span>.</p>
                    <div className="p-3 bg-muted/50 rounded-lg border text-[11px] font-bold">
                      <p className="text-[9px] uppercase text-muted-foreground mb-1">Message envoyé :</p>
                      <p className="whitespace-pre-wrap">{finalSmsBody}</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-row gap-3 pt-2">
                  <AlertDialogCancel className="flex-1 h-12 font-black uppercase text-xs rounded-xl border-2">Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs rounded-xl"
                    onClick={sendEmergencySms}
                  >
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isQuickMsgOpen} onOpenChange={setIsQuickMsgOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl border-dashed hover:bg-muted/50 transition-colors">
                  <MessageSquare className="size-4 mr-2" /> Sélectionner un message type
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-2xl h-[95vh] flex flex-col p-0 overflow-hidden sm:h-[85vh]">
                <DialogHeader className="p-6 pb-2 shrink-0 border-b">
                  <DialogTitle className="font-black uppercase tracking-tighter text-xl">MESSAGES PRÉDÉFINIS</DialogTitle>
                  <DialogDescription className="text-xs font-medium mt-1">Choisissez un message pour gagner du temps. Le lien GPS sera ajouté automatiquement.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow p-6 pt-2 bg-slate-50/30">
                  <div className="space-y-8 pb-10">
                    {PREDEFINED_MESSAGES.map((cat) => (
                      <div key={cat.category} className="space-y-4">
                        <h4 className={cn("text-[11px] font-black uppercase tracking-wider flex items-center gap-2", cat.color)}>
                          {cat.urgency === 'critical' && <AlertOctagon className="size-3.5" />}
                          {cat.urgency === 'high' && <AlertCircle className="size-3.5" />}
                          {cat.category}
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          {cat.messages.map((m) => (
                            <Button 
                              key={m.id} 
                              variant="outline" 
                              className={cn(
                                "h-auto py-4 px-5 justify-start text-left flex flex-col items-start gap-1 border-2 bg-white shadow-sm transition-all active:scale-[0.98]",
                                cat.btnBorder,
                                cat.btnHover
                              )}
                              onClick={() => handleSelectPredefinedMessage(m.text)}
                            >
                              <span className="font-black text-xs uppercase tracking-tight">{m.label}</span>
                              <span className="text-[10px] opacity-70 leading-relaxed font-medium line-clamp-2">{m.text}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-4 bg-white border-t shrink-0">
                   <Button 
                     variant="secondary" 
                     className="w-full h-14 font-black uppercase text-xs tracking-widest shadow-sm border-2"
                     onClick={() => {
                       setCustomSmsMessage(userProfile?.vesselSmsMessage || '');
                       setIsQuickMsgOpen(false);
                       setTimeout(() => setIsSmsConfirmOpen(true), 150);
                     }}
                   >
                     UTILISER MON MESSAGE PERSONNALISÉ
                   </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-3 pt-2 border-t border-dashed">
              <div className="bg-white/80 p-4 rounded-xl border-2 border-dashed text-[10px] space-y-2">
                <div className="flex justify-between font-black uppercase text-red-600"><span>MRCC Secours en Mer</span><span>196 / VHF 16</span></div>
                <div className="flex justify-between opacity-70"><span>SAMU - SOS Médecins</span><span className="font-bold">15</span></div>
                <div className="flex justify-between opacity-70"><span>SNSM Nouméa</span><span className="font-bold">25.23.12</span></div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Contact d'urgence :</Label>
                <div className="flex gap-2">
                  <input type="tel" placeholder="Numéro..." value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="flex h-12 w-full rounded-xl border-2 bg-white px-4 text-sm font-black" />
                  <Button variant="secondary" size="icon" className="h-12 w-12 border-2 rounded-xl" onClick={handleSaveEmergencyContact}><Save className="size-5" /></Button>
                </div>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

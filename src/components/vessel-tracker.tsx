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
const HISTORY_DEBOUNCE_MS = 60000; 

interface StatusEvent {
  id?: string;
  status: 'moving' | 'stationary' | 'offline';
  timestamp: any;
  location: { lat: number, lng: number } | null;
}

const defaultVesselSounds = [
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'sonar', label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3' },
];

const PREDEFINED_MESSAGES = [
  {
    category: "1. DÉTRESSE VITALE",
    urgency: "critical",
    color: "text-red-600",
    btnBorder: "border-red-200",
    btnHover: "hover:bg-red-50",
    messages: [
      { id: 'voie_eau', label: "VOIE D'EAU", text: "MAYDAY - Voie d'eau importante à bord." },
      { id: 'homme_mer', label: "HOMME À LA MER", text: "MAYDAY - Homme à la mer." },
    ]
  },
  {
    category: "3. PANNE ET ASSISTANCE",
    urgency: "medium",
    color: "text-amber-600",
    btnBorder: "border-orange-200",
    btnHover: "hover:bg-amber-50",
    messages: [
      { id: 'panne', label: "PANNE MOTEUR", text: "PAN PAN - Panne moteur totale. Navire à la dérive." },
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
  const [isGpsActiveForReceiver, setIsGpsActiveForReceiver] = useState(false);
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
  const [initialCenterDone, setInitialCenterDone] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const lastFirestoreUpdateRef = useRef<number>(0);
  const statusCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const historyDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const activeVesselId = useMemo(() => mode === 'sender' ? sharingId : vesselIdToFollow.trim().toUpperCase(), [mode, sharingId, vesselIdToFollow]);

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
      return `Alerte : ${name} est ${statusWord} en mer depuis ${elapsedString}. Voici mes coordonnées GPS.`;
    }
    return `SOS j'ai un souci avec le bateau. Voici mes coordonnées GPS.`;
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
    if (userProfile?.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
    if (userProfile?.displayName && !vesselNickname) setVesselNickname(userProfile.displayName);
    if (userProfile?.vesselSmsMessage !== undefined) setCustomSmsMessage(userProfile.vesselSmsMessage);
  }, [userProfile, vesselNickname]);

  useEffect(() => {
    if (!user || !firestore || isProfileLoading) return;
    const timeout = setTimeout(() => {
      const prefs = { isNotifyEnabled, vesselVolume, notifySettings, notifySounds, isWatchEnabled, watchType, watchDuration, watchSound };
      updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: prefs, vesselSmsMessage: customSmsMessage }).catch(() => {});
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

  const handleSaveNickname = useCallback((name: string) => {
    setVesselNickname(name);
    localStorage.setItem('vessel_nickname', name);
  }, []);

  const handleSaveCustomId = useCallback(() => {
    const id = customSharingId.trim().toUpperCase();
    localStorage.setItem('vessel_custom_id', id);
    setCustomSharingId(id);
    addToHistory(id);
    toast({ title: "ID enregistré" });
  }, [customSharingId, addToHistory, toast]);

  const playAlertSound = useCallback((soundId: string) => {
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselVolume, availableSounds]);

  useEffect(() => {
    if (currentEffectiveStatus !== prevVesselStatusRef.current) {
      const now = Date.now();
      setStatusStartTime(now);
      if (prevVesselStatusRef.current !== null) {
        toast({ title: "Changement d'état", description: `Navire à ${format(now, 'HH:mm', { locale: fr })}` });
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
  }, [currentEffectiveStatus, mode, isNotifyEnabled, notifySettings, notifySounds, playAlertSound, toast]);

  useEffect(() => {
    if (!statusStartTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - statusStartTime) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsedString(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [statusStartTime]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    const docRef = doc(firestore, 'vessels', sharingId);
    setDoc(docRef, { userId: user.uid, displayName: vesselNickname || user.displayName || 'Capitaine', isSharing: isSharing, lastActive: serverTimestamp(), ...data }, { merge: true }).catch(() => {});
  }, [user, firestore, isSharing, sharingId, vesselNickname]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        setLastValidLocation(newPos);
        if (!anchorPos) {
          setAnchorPos(newPos);
          updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true });
          return;
        }
        if (getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng) > IMMOBILITY_THRESHOLD_METERS) {
          setVesselStatus('moving');
          setAnchorPos(newPos);
          setLastMovementTime(Date.now());
          updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore]);

  const handleRecenter = () => {
    if (mode === 'receiver' && !isGpsActiveForReceiver) {
        setIsGpsActiveForReceiver(true);
        toast({ title: "Localisation active", description: "Votre position (point bleu) est affichée." });
    }
    
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : lastValidLocation);
    if (pos && map) { map.panTo(pos); map.setZoom(15); }
  };

  const sendEmergencySms = () => {
    if (!emergencyContact.trim()) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(finalSmsBody)}`;
  };

  const displayVessel = mode === 'sender' ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: vesselNickname || 'Moi' } : null) : remoteVessel;

  return (
    <div className="space-y-6 pb-12">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase tracking-tighter"><Navigation className="text-primary size-5" /> Vessel Tracker</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex bg-muted/50 p-1 rounded-xl border">
            <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-bold h-10 rounded-lg" onClick={() => setMode('sender')}>Émetteur (A)</Button>
            <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-bold h-10 rounded-lg" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          </div>

          {mode === 'sender' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-card">
                <Label className="text-base font-black uppercase">Partager ma position</Label>
                <Switch checked={isSharing} onCheckedChange={setIsSharing} />
              </div>
              <div className="space-y-4 rounded-2xl border-2 border-dashed p-4 bg-muted/10">
                <Input placeholder="Surnom navire..." value={vesselNickname} onChange={e => handleSaveNickname(e.target.value)} className="font-black h-12 border-2" />
                <div className="flex gap-2">
                  <Input placeholder="ID partagé (ex: BATEAU-NC)..." value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} disabled={isSharing} className="font-black text-center uppercase h-12 border-2" />
                  <Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={handleSaveCustomId} disabled={isSharing}><Save className="size-5" /></Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="ID à suivre..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center uppercase h-12 border-2" />
                <Button variant="secondary" size="icon" className="h-12 w-12 border-2" onClick={() => { if(vesselIdToFollow) addToHistory(vesselIdToFollow); }}><Plus className="size-5" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-2 shadow-xl rounded-2xl flex flex-col">
        <div className="h-[350px] relative bg-muted/20">
          {isLoaded && (
            <GoogleMap 
              mapContainerClassName="w-full h-full" 
              defaultCenter={displayVessel?.location ? { lat: displayVessel.location.latitude, lng: displayVessel.location.longitude } : (lastValidLocation || { lat: -22.27, lng: 166.45 })} 
              defaultZoom={15} 
              onLoad={setMap} 
              options={{ disableDefaultUI: true, mapTypeId: 'satellite' }}
            >
                {isGpsActiveForReceiver && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><div style={{ transform: 'translate(-50%, -50%)' }}><div className="size-4 bg-blue-500 rounded-full border-2 border-white shadow-2xl animate-pulse"></div></div></OverlayView>}
                {displayVessel?.location && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded shadow-2xl text-[10px] font-black">{displayVessel.displayName}</div>
                        <div className={cn("p-2 rounded-full shadow-2xl border-2 border-white", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                        {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
            </GoogleMap>
          )}
          <Button size="icon" className="absolute top-3 right-3 shadow-lg h-10 w-10 bg-background/90 border-2" onClick={handleRecenter}><LocateFixed className="size-5" /></Button>
        </div>

        <div className="bg-card border-t-2 p-4 flex flex-col gap-3">
            <div className={cn("flex items-center justify-between p-4 rounded-2xl border-2 shadow-sm", currentEffectiveStatus === 'moving' ? "bg-green-50 border-green-200" : currentEffectiveStatus === 'stationary' ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200")}>
                <div className="flex items-center gap-4">
                    <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white shadow-md", currentEffectiveStatus === 'moving' ? "bg-green-600" : currentEffectiveStatus === 'stationary' ? "bg-amber-600" : "bg-red-600")}>
                        {currentEffectiveStatus === 'moving' ? <Move className="size-6" /> : currentEffectiveStatus === 'stationary' ? <Anchor className="size-6" /> : <WifiOff className="size-6" />}
                    </div>
                    <div>
                        <p className="font-black text-lg uppercase tracking-tighter leading-none">{currentEffectiveStatus === 'moving' ? 'EN ROUTE' : currentEffectiveStatus === 'stationary' ? 'MOUILLAGE' : 'HORS LIGNE'}</p>
                        <p className="text-xs font-bold text-muted-foreground mt-1.5">depuis {elapsedString}</p>
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-muted/10 border-t-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Contact d'urgence :</Label>
                <div className="flex gap-2">
                  <input type="tel" placeholder="Numéro..." value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="flex h-12 w-full rounded-xl border-2 bg-white px-4 text-sm font-black" />
                  <Button variant="secondary" className="h-12" onClick={handleSaveEmergencyContact}><Save className="size-5" /></Button>
                </div>
              </div>
              <Button variant="destructive" className="w-full h-14 mt-4 font-black uppercase rounded-xl border-b-4 border-red-800" onClick={sendEmergencySms} disabled={!lastValidLocation}>
                <ShieldAlert className="size-6 mr-2" /> ALERTE SMS
              </Button>
            </div>
        </div>
      </Card>
    </div>
  );
}

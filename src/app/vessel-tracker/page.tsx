'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Save, 
  WifiOff, 
  Move, 
  Expand, 
  Shrink, 
  Zap, 
  AlertTriangle,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  History as HistoryIcon,
  MapPin,
  X,
  Play,
  Volume2,
  Check,
  Trash2,
  Ship,
  Home,
  RefreshCw,
  Settings,
  Smartphone,
  Phone,
  Waves,
  Bird,
  Camera,
  MessageSquare,
  Globe,
  ChevronDown
} from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

// CLÉ API WINDY FONCTIONNELLE
const MAP_KEY = 'VFcQ4k9H3wFrrJ1h6jfS4U3gODXADyyn';
const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
const IMMOBILITY_THRESHOLD_METERS = 20; 

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const shouldPanOnNextFix = useRef(false);

  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);
  const [anchorPos, setAnchorPos] = useState<{ lat: number, lng: number } | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const [sharingStartTime, setSharingStartTime] = useState<number | null>(null);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: '', stationary: '', offline: '' },
    isWatchEnabled: false,
    watchType: 'stationary',
    watchDuration: 60,
    watchSound: '',
    batteryThreshold: 20
  });
  
  const [history, setHistory] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: {lat: number, lng: number}, batteryLevel?: number, isCharging?: boolean }[]>([]);
  const lastStatusesRef = useRef<Record<string, string>>({});
  const lastUpdatesRef = useRef<Record<string, number>>({});
  const lastSentStatusRef = useRef<string | null>(null);
  const lastBatteryLevelsRef = useRef<Record<string, number>>({});
  const lastChargingStatesRef = useRef<Record<string, boolean>>({});
  const lastClearTimesRef = useRef<Record<string, number>>({});

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const savedVesselIds = userProfile?.savedVesselIds || [];
  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore || savedVesselIds.length === 0) return null;
    const queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing]);
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.filter(s => 
      !s.categories || s.categories.includes('Vessel') || s.categories.includes('General')
    ).map(s => ({ id: s.id, label: s.label, url: s.url }));
  }, [dbSounds]);

  const playVesselSound = useCallback((soundId: string) => {
    if (!vesselPrefs.isNotifyEnabled) return;
    const sound = availableSounds.find(s => s.id === soundId || s.label === soundId);
    if (sound) {
      const audio = new Audio(sound.url);
      audio.volume = vesselPrefs.vesselVolume;
      audio.play().catch(() => {});
    }
  }, [vesselPrefs.isNotifyEnabled, vesselPrefs.vesselVolume, availableSounds]);

  // --- WINDY INIT LOGIC ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const meta = document.createElement('meta');
    meta.name = "referrer";
    meta.content = "no-referrer-when-downgrade";
    document.head.appendChild(meta);

    const loadScript = (id: string, src: string) => {
      return new Promise<void>((resolve, reject) => {
        if (document.getElementById(id)) { resolve(); return; }
        const script = document.createElement('script');
        script.id = id; script.src = src; script.async = true;
        script.referrerPolicy = 'no-referrer-when-downgrade';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        (window as any).W = { apiKey: MAP_KEY };
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        let attempts = 0;
        const checkInit = setInterval(() => {
            attempts++;
            if ((window as any).windyInit) {
                clearInterval(checkInit);
                (window as any).windyInit({ key: MAP_KEY, lat: INITIAL_CENTER.lat, lon: INITIAL_CENTER.lng, zoom: 7 }, (windyAPI: any) => {
                    if (!windyAPI) return;
                    setMap(windyAPI.map);
                    setIsInitialized(true);
                });
            }
            if (attempts > 50) clearInterval(checkInit);
        }, 200);
      } catch (e) {}
    };

    setTimeout(init, 500);
    return () => { if (document.head.contains(meta)) document.head.removeChild(meta); };
  }, []);

  // --- PREFERENCES & NICKNAME SYNC ---
  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      const savedNickname = userProfile.vesselNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '';
      if (!vesselNickname) setVesselNickname(savedNickname);
      if (userProfile.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
    }
  }, [userProfile, user]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const update = async () => {
        let batteryInfo = {};
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }

        const updatePayload: any = { 
            id: sharingId,
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: data.isSharing !== undefined ? data.isSharing : isSharing, 
            lastActive: serverTimestamp(),
            ...batteryInfo,
            ...data 
        };

        if (data.status || data.eventLabel) updatePayload.statusChangedAt = serverTimestamp();

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname]);

  const handleStartSharing = () => {
    setIsSharing(true);
    setSharingStartTime(Date.now());
    updateVesselInFirestore({ isSharing: true, status: 'moving' });
    toast({ title: "Partage activé", description: `ID: ${sharingId}` });
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    setSharingStartTime(null);
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp() }, { merge: true });
    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleManualStatus = (st: VesselStatus['status'], label: string) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st, eventLabel: label });
    if (st === 'moving') setAnchorPos(null);
    toast({ title: label });
  };

  const handleTacticalSignal = (label: string) => {
    updateVesselInFirestore({ eventLabel: `SIGNAL : ${label}` });
    toast({ title: `Signal envoyé : ${label}`, variant: "default" });
  };

  const sendEmergencySms = (type: string) => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const posUrl = currentPos ? `https://www.google.com/maps?q=${currentPos.lat.toFixed(6)},${currentPos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    const body = `[${sharingId}] ${type} ! ${vesselSmsMessage} Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  // --- GPS TRACKING LOGIC ---
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        
        if (vesselStatus !== 'returning' && vesselStatus !== 'landed') {
            if (!anchorPos) { setAnchorPos(newPos); return; }
            const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
            if (dist > IMMOBILITY_THRESHOLD_METERS) {
              setVesselStatus('moving'); setAnchorPos(newPos); immobilityStartTime.current = null;
              updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving' });
            } else {
              if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
              if (Date.now() - immobilityStartTime.current > 30000 && vesselStatus !== 'stationary') {
                setVesselStatus('stationary'); updateVesselInFirestore({ status: 'stationary' });
              }
            }
        } else {
            updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng } });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, vesselStatus]);

  // --- HISTORY & NOTIFICATIONS ---
  useEffect(() => {
    if (!followedVessels) return;
    followedVessels.forEach(vessel => {
        const currentStatus = vessel.isSharing ? (vessel.status || 'moving') : 'offline';
        const timeKey = vessel.statusChangedAt?.toMillis?.() || 0;
        if (timeKey === 0 || lastUpdatesRef.current[vessel.id] >= timeKey) return;
        
        const label = vessel.eventLabel || (currentStatus === 'moving' ? 'EN MOUVEMENT' : currentStatus === 'stationary' ? 'AU MOUILLAGE' : 'SIGNAL PERDU');
        setHistory(prev => [{ vesselName: vessel.displayName || vessel.id, statusLabel: label, time: new Date(), pos: {lat: vessel.location?.latitude || 0, lng: vessel.location?.longitude || 0} }, ...prev].slice(0, 50));
        
        if (mode === 'receiver' && lastStatusesRef.current[vessel.id] && lastStatusesRef.current[vessel.id] !== currentStatus) {
            playVesselSound('sonar');
            toast({ title: vessel.displayName || vessel.id, description: label });
        }
        lastStatusesRef.current[vessel.id] = currentStatus;
        lastUpdatesRef.current[vessel.id] = timeKey;
    });
  }, [followedVessels, mode, playVesselSound]);

  const activeDuration = useMemo(() => {
    if (!sharingStartTime) return '0 min';
    const mins = Math.floor((Date.now() - sharingStartTime) / 60000);
    return `${mins} min`;
  }, [sharingStartTime]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto px-1 pb-32">
      {/* HEADER & MODE SELECTOR */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Globe className="text-primary" /> Boat Tracker
          </h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Surveillance Maritime NC</p>
        </div>
        <div className="flex bg-muted/30 p-1 rounded-xl border">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('sender')}>A - Émetteur</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} size="sm" className="font-black uppercase text-[9px] h-8 px-3" onClick={() => setMode('receiver')}>B - Récepteur</Button>
        </div>
      </div>

      {/* SENDER VIEW */}
      {mode === 'sender' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {isSharing ? (
            <div className="space-y-4">
              <Card className="bg-primary text-white border-none shadow-xl overflow-hidden relative">
                <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                <CardHeader className="p-5 pb-2">
                  <div className="flex items-center justify-between relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage Actif
                    </p>
                    <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[9px] h-5 px-2 animate-pulse">EN LIGNE</Badge>
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter mt-2">{sharingId}</h3>
                  <p className="text-xs font-bold opacity-80 italic">{vesselNickname || 'Capitaine'}</p>
                </CardHeader>
                <CardContent className="p-5 pt-4 flex items-center gap-6 relative z-10">
                  <div className="flex items-center gap-2">
                    {vesselStatus === 'moving' ? <Move className="size-4" /> : <Anchor className="size-4" />}
                    <span className="text-xs font-black uppercase tracking-widest">{vesselStatus === 'moving' ? 'En mouvement' : 'Au mouillage'}</span>
                  </div>
                  <div className="text-[10px] font-black uppercase opacity-60">Actif {activeDuration}</div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-2">
                <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-3">
                  <p className="text-[9px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><Settings className="size-3"/> Signalisation Manuelle</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-14 font-black uppercase text-[10px] gap-2 border-2 bg-white" onClick={() => handleManualStatus('returning', 'RETOUR MAISON')}>
                      <Navigation className="size-4 text-blue-600" /> Retour Maison
                    </Button>
                    <Button variant="outline" className="h-14 font-black uppercase text-[10px] gap-2 border-2 bg-white" onClick={() => handleManualStatus('landed', 'HOME (À TERRE)')}>
                      <Home className="size-4 text-green-600" /> Home (À terre)
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-3">
                  <p className="text-[9px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><Zap className="size-3"/> Signalement Tactique (Flotte)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'Oiseaux', icon: Bird, color: 'text-blue-600' },
                      { id: 'Marlin', icon: Fish, color: 'text-slate-800' },
                      { id: 'Thon', icon: Fish, color: 'text-red-600' },
                      { id: 'Tazard', icon: Fish, color: 'text-slate-500' },
                      { id: 'Wahoo', icon: Fish, color: 'text-cyan-600' },
                      { id: 'Bonite', icon: Fish, color: 'text-indigo-600' },
                      { id: 'Sardines', icon: Waves, color: 'text-emerald-600' },
                      { id: 'Prise', icon: Camera, color: 'text-teal-600' }
                    ].map(sig => (
                      <Button key={sig.id} variant="outline" className="h-12 flex flex-col items-center justify-center p-1 bg-white border-2 hover:bg-slate-50" onClick={() => handleTacticalSignal(sig.id)}>
                        <sig.icon className={cn("size-4 mb-1", sig.color)} />
                        <span className="text-[8px] font-black uppercase">{sig.id}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <Button variant="destructive" className="h-14 font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 text-sm animate-pulse" onClick={() => sendEmergencySms('DEMANDE D\'ASSISTANCE')}>
                  <ShieldAlert className="size-6" /> Demande d'Assistance
                </Button>
                <Button variant="destructive" className="h-14 font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 text-xs border-2 border-white/20" onClick={handleStopSharing}>
                  <X className="size-5" /> Arrêter le partage / Quitter
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Button className="w-full h-20 text-lg font-black uppercase tracking-widest shadow-xl rounded-2xl gap-4 bg-primary" onClick={handleStartSharing}>
                <Navigation className="size-8" /> Activer mon partage
              </Button>
              <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">ID du Navire (Unique)</Label>
                  <div className="flex gap-2">
                    <Input value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} placeholder="ID EX: MON-BATEAU" className="h-12 border-2 font-black text-center uppercase tracking-widest" />
                    <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0" onClick={handleSaveVessel}><Save className="size-5" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Mon Surnom</Label>
                  <Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="Capitaine..." className="h-12 border-2 font-bold text-center uppercase" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RECEIVER VIEW */}
      {mode === 'receiver' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Ajouter un navire à suivre</Label>
            <div className="flex gap-2">
              <Input value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} placeholder="ENTRER ID..." className="h-12 border-2 font-black text-center uppercase tracking-widest" />
              <Button className="h-12 px-6 font-black uppercase text-xs" onClick={handleSaveVessel}>Suivre</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {savedVesselIds.length > 0 ? savedVesselIds.map(id => {
              const v = followedVessels?.find(vessel => vessel.id === id);
              const active = v?.isSharing === true;
              return (
                <Card key={id} className={cn("border-2 shadow-sm transition-all", active ? "border-primary/30 bg-primary/5" : "opacity-60 bg-muted/10")}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2.5 rounded-xl shrink-0", active ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground")}>
                        {active ? <Navigation className="size-5" /> : <WifiOff className="size-5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-black uppercase text-sm truncate leading-none">{v?.displayName || id}</span>
                        <span className="text-[9px] font-bold uppercase opacity-60 mt-1">{active ? (v?.eventLabel || 'EN LIGNE') : 'HORS LIGNE'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {active && <BatteryIconComp level={v?.batteryLevel} charging={v?.isCharging} />}
                      <Button variant="ghost" size="icon" className="size-9 rounded-full text-destructive/40 hover:text-destructive hover:bg-red-50 border-2" onClick={() => handleRemoveSavedVessel(id)}><Trash2 className="size-4"/></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="text-center py-12 border-4 border-dashed rounded-[2rem] opacity-20">
                <Ship className="size-12 mx-auto mb-2" />
                <p className="font-black uppercase text-[10px]">Aucun navire dans votre liste</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAP SECTION */}
      <div className={cn(
          "relative w-full transition-all duration-500 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden",
          isFullscreen ? "fixed inset-0 z-[200] h-screen w-screen rounded-none" : "h-[500px]"
      )}>
        <div id="windy" className="w-full h-full"></div>
        
        <div className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-900 transition-all duration-700 pointer-events-none z-10",
            isInitialized ? "opacity-0 invisible" : "opacity-100 visible"
        )}>
            <RefreshCw className="size-10 animate-spin text-primary/40" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Initialisation tactique...</p>
        </div>

        <Button size="icon" className="absolute top-4 left-4 shadow-2xl h-10 w-10 z-[210] bg-white/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Shrink className="size-5 text-primary" /> : <Expand className="size-5 text-primary" />}
        </Button>
      </div>

      {/* FOOTER & ACCORDIONS */}
      {!isFullscreen && (
        <div className="space-y-4">
          <Card className="border-2 shadow-sm bg-card overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="history" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest"><HistoryIcon className="size-4" /> Journal tactique unifié</div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t border-dashed bg-muted/5">
                  <div className="divide-y max-h-60 overflow-y-auto scrollbar-hide">
                    {history.length > 0 ? history.map((h, i) => (
                      <div key={i} className="p-3 flex items-center justify-between bg-white text-[10px]">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-black uppercase truncate">{h.vesselName}</span>
                          <span className="font-bold opacity-40">{format(h.time, 'HH:mm:ss')} • {h.statusLabel}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase border-2 px-2" onClick={() => { map?.panTo(h.pos); map?.setZoom(15); }}>GPS</Button>
                      </div>
                    )) : <div className="p-10 text-center text-[10px] font-bold opacity-30 uppercase italic">Aucun événement enregistré</div>}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem value="safety" className="border-2 rounded-2xl bg-orange-50/20 border-orange-100 overflow-hidden shadow-sm">
              <AccordionTrigger className="px-4 py-4 hover:no-underline text-orange-900">
                <div className="flex items-center gap-3 font-black uppercase text-xs tracking-tight"><Smartphone className="size-5 text-orange-600" /> Réglages d'Urgence (SMS)</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Numéro du contact (Terre)</Label>
                    <Input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Ex: 77 12 34" className="h-11 border-2 font-black text-lg bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Message personnalisé</Label>
                    <Textarea value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} placeholder="Problème moteur, besoin assistance..." className="border-2 min-h-[80px] font-medium bg-white" />
                  </div>
                  <Button className="w-full h-12 font-black uppercase text-[10px] shadow-md gap-2" onClick={handleSaveSmsSettings}><Save className="size-4"/> Enregistrer mes réglages SMS</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sounds" className="border-2 rounded-2xl bg-blue-50/20 border-blue-100 overflow-hidden shadow-sm">
              <AccordionTrigger className="px-4 py-4 hover:no-underline text-blue-900">
                <div className="flex items-center gap-3 font-black uppercase text-xs tracking-tight"><Volume2 className="size-5 text-blue-600" /> Notifications & Sons</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase">Volume des alertes</span>
                    <span className="font-black text-xs">{Math.round(vesselPrefs.vesselVolume * 100)}%</span>
                  </div>
                  <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] font-black uppercase">Signaux sonores actifs</span>
                    <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}

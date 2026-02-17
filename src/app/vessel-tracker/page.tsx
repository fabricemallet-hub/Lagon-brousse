
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Bell,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  History,
  MapPin,
  ChevronDown,
  X,
  Play,
  Volume2,
  Check,
  Trash2,
  Ship,
  Home,
  RefreshCw,
  Settings,
  Battery,
  MessageSquare,
  Eye,
  Smartphone,
  Phone,
  Waves,
  Users
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

const INITIAL_CENTER = { lat: -22.27, lng: 166.45 };
const IMMOBILITY_THRESHOLD_METERS = 20; 

const BatteryIconComp = ({ level, charging, className }: { level?: number, charging?: boolean, className?: string }) => {
  if (level === undefined) return <WifiOff className={cn("size-4 opacity-40", className)} />;
  const props = { className: cn("size-4", className) };
  if (charging) return <BatteryCharging {...props} className={cn(props.className, "text-blue-500")} />;
  if (level <= 10) return <BatteryLow {...props} className={cn(props.className, "text-red-600")} />;
  if (level <= 40) return <BatteryMedium {...props} className={cn(props.className, "text-orange-500")} />;
  return <BatteryFull {...props} className={cn(props.className, "text-green-600")} />;
};

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="size-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="size-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
);

export default function VesselTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  // Navigation et Mode
  const [mode, setMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  // Émetteur
  const [isSharing, setIsSharing] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [vesselNickname, setVesselNickname] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [fleetGroupId, setFleetGroupId] = useState('');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  
  // Urgence
  const [emergencyContact, setEmergencyContact] = useState('');
  const [isEmergencyEnabled, setIsEmergencyEnabled] = useState(true);
  const [isCustomMessageEnabled, setIsCustomMessageEnabled] = useState(true);
  const [vesselSmsMessage, setVesselSmsMessage] = useState('');

  // GPS et Carte
  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<VesselStatus['status']>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);
  const shouldPanOnNextFix = useRef(false);

  // Préférences
  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true, battery: true },
    notifySounds: { moving: '', stationary: '', offline: '', battery: '' },
    isWatchEnabled: false,
    watchDuration: 60,
    batteryThreshold: 20
  });

  const [history, setHistory] = useState<{ vesselName: string, statusLabel: string, time: Date, pos: google.maps.LatLngLiteral, batteryLevel?: number, isCharging?: boolean, accuracy?: number }[]>([]);
  
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
  const idHistory = userProfile?.vesselIdHistory || [];

  const vesselsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let queryIds = [...savedVesselIds];
    if (isSharing && !queryIds.includes(sharingId)) queryIds.push(sharingId);
    
    if (mode === 'fleet' && fleetGroupId.trim()) {
        return query(collection(firestore, 'vessels'), where('fleetGroupId', '==', fleetGroupId.trim().toUpperCase()));
    }
    
    if (queryIds.length === 0) return null;
    return query(collection(firestore, 'vessels'), where('id', 'in', queryIds.slice(0, 10)));
  }, [firestore, savedVesselIds, sharingId, isSharing, mode, fleetGroupId]);
  
  const { data: followedVessels } = useCollection<VesselStatus>(vesselsQuery);

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    if (!dbSounds) return [];
    return dbSounds.filter(s => !s.categories || s.categories.includes('Vessel') || s.categories.includes('General'))
                   .map(s => ({ id: s.id, label: s.label, url: s.url }));
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

  useEffect(() => {
    if (userProfile) {
      if (userProfile.vesselPrefs) setVesselPrefs(prev => ({ ...prev, ...userProfile.vesselPrefs }));
      if (userProfile.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
      if (userProfile.vesselSmsMessage) setVesselSmsMessage(userProfile.vesselSmsMessage);
      setIsEmergencyEnabled(userProfile.isEmergencyEnabled ?? true);
      setIsCustomMessageEnabled(userProfile.isCustomMessageEnabled ?? true);
      setIsGhostMode(userProfile.isGhostMode ?? false);
      
      const savedNickname = userProfile.vesselNickname || userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '';
      setVesselNickname(savedNickname);
      
      if (userProfile.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
    }
  }, [userProfile, user]);

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    
    const newStatus = data.status || vesselStatus;
    const statusChanged = lastSentStatusRef.current !== newStatus;

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
            isGhostMode: isGhostMode,
            fleetGroupId: fleetGroupId.trim().toUpperCase() || null,
            lastActive: serverTimestamp(),
            ...batteryInfo,
            ...data 
        };

        if (statusChanged || lastSentStatusRef.current === null || data.eventLabel) {
            updatePayload.statusChangedAt = serverTimestamp();
            lastSentStatusRef.current = newStatus;
        }

        setDoc(doc(firestore, 'vessels', sharingId), updatePayload, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname, vesselStatus, isGhostMode, fleetGroupId]);

  const handleSaveVessel = async () => {
    if (!user || !firestore) return;
    const cleanId = (vesselIdToFollow || customSharingId).trim().toUpperCase();
    if (!cleanId) return;
    try {
        await updateDoc(doc(firestore, 'users', user.uid), {
            savedVesselIds: arrayUnion(cleanId),
            vesselIdHistory: arrayUnion(cleanId),
            lastVesselId: cleanId,
            vesselNickname: vesselNickname
        });
        setVesselIdToFollow('');
        toast({ title: "Identifiant enregistré" });
    } catch (e) { toast({ variant: 'destructive', title: "Erreur" }); }
  };

  const handleStopSharing = async () => {
    if (!user || !firestore) return;
    setIsSharing(false);
    await setDoc(doc(firestore, 'vessels', sharingId), { isSharing: false, lastActive: serverTimestamp(), statusChangedAt: serverTimestamp() }, { merge: true });
    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setCurrentPos(null);
    setAnchorPos(null);
    lastSentStatusRef.current = null;
    toast({ title: "Partage arrêté" });
  };

  const handleClearHistory = async () => {
    setHistory([]);
    if (!firestore || !user) return;
    if (isSharing) await updateDoc(doc(firestore, 'vessels', sharingId), { historyClearedAt: serverTimestamp() });
    toast({ title: "Historique effacé" });
  };

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing && (!v.isGhostMode || v.id === sharingId))?.location ? { lat: followedVessels.find(v => v.isSharing)!.location!.latitude, lng: followedVessels.find(v => v.isSharing)!.location!.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const saveVesselPrefs = async (newPrefs: typeof vesselPrefs) => {
    if (!user || !firestore) return;
    setVesselPrefs(newPrefs);
    await updateDoc(doc(firestore, 'users', user.uid), { vesselPrefs: newPrefs }).catch(() => {});
  };

  const handleManualStatus = (st: VesselStatus['status']) => {
    setVesselStatus(st);
    updateVesselInFirestore({ status: st });
    if (st === 'moving') { immobilityStartTime.current = null; setAnchorPos(null); }
    toast({ title: st === 'returning' ? 'Retour Maison' : st === 'landed' ? 'À terre' : 'Mode Auto' });
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!isEmergencyEnabled || !emergencyContact) { toast({ variant: "destructive", title: "Config d'urgence incomplète" }); return; }
    const pos = mode === 'sender' ? currentPos : (followedVessels?.find(v => v.isSharing)?.location ? { lat: followedVessels.find(v => v.isSharing)!.location!.latitude, lng: followedVessels.find(v => v.isSharing)!.location!.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[GPS EN COURS...]";
    const body = `[${vesselNickname.toUpperCase()}] ${isCustomMessageEnabled ? vesselSmsMessage : "Besoin assistance immédiate."} [${type}] Position : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const smsPreview = useMemo(() => {
    const nicknamePrefix = vesselNickname ? `[${vesselNickname.toUpperCase()}] ` : "";
    const customText = (isCustomMessageEnabled && vesselSmsMessage) ? vesselSmsMessage : "Requiert assistance immédiate.";
    return `${nicknamePrefix}${customText} [MAYDAY] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [vesselSmsMessage, isCustomMessageEnabled, vesselNickname]);

  // GPS Monitor
  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        const accuracy = Math.round(position.coords.accuracy);
        setCurrentPos(newPos);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        
        if (vesselStatus !== 'returning' && vesselStatus !== 'landed') {
            if (!anchorPos) { 
              setAnchorPos(newPos); 
              updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', accuracy }); 
              return; 
            }
            const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
            // Ignorer le bruit GPS : si le mouvement est inférieur à la précision, on considère qu'on n'a pas bougé
            const isMoving = dist > IMMOBILITY_THRESHOLD_METERS && dist > accuracy * 0.8;

            if (isMoving) {
              setVesselStatus('moving'); setAnchorPos(newPos); immobilityStartTime.current = null;
              updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', accuracy });
            } else {
              if (!immobilityStartTime.current) { immobilityStartTime.current = Date.now(); updateVesselInFirestore({ eventLabel: 'ANALYSE IMMOBILITÉ...', accuracy }); }
              if (Date.now() - immobilityStartTime.current > 15000 && vesselStatus !== 'stationary') {
                setVesselStatus('stationary'); updateVesselInFirestore({ status: 'stationary', accuracy });
              } else {
                updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, accuracy });
              }
            }
        } else {
            updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, accuracy });
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map, toast, vesselStatus]);

  // Global Vessels Sound Monitor
  useEffect(() => {
    if (!followedVessels) return;
    followedVessels.forEach(vessel => {
        const isSharingActive = vessel.isSharing === true;
        const currentStatus = isSharingActive ? (vessel.status || 'moving') : 'offline';
        const statusTime = vessel.statusChangedAt || vessel.lastActive;
        const currentBattery = vessel.batteryLevel ?? 100;
        const currentCharging = vessel.isCharging ?? false;
        
        const timeKey = (statusTime?.toMillis?.() || statusTime?.seconds * 1000 || 0);
        const clearTime = (vessel.historyClearedAt?.toMillis?.() || 0);

        if (clearTime > (lastClearTimesRef.current[vessel.id] || 0)) {
            setHistory(prev => prev.filter(h => h.vesselName !== (vessel.displayName || vessel.id)));
            lastClearTimesRef.current[vessel.id] = clearTime;
        }

        if (timeKey === 0) return;
        
        const lastStatus = lastStatusesRef.current[vessel.id];
        const statusChanged = lastStatus !== currentStatus;
        const timestampUpdated = timeKey > (lastUpdatesRef.current[vessel.id] || 0);
        const batteryAlert = (lastBatteryLevelsRef.current[vessel.id] ?? 100) >= vesselPrefs.batteryThreshold && currentBattery < vesselPrefs.batteryThreshold;

        const addToHistory = (label: string) => {
            setHistory(prev => [{ 
                vesselName: vessel.displayName || vessel.id, 
                statusLabel: label, 
                time: new Date(), 
                pos: { lat: vessel.location?.latitude || INITIAL_CENTER.lat, lng: vessel.location?.longitude || INITIAL_CENTER.lng },
                batteryLevel: currentBattery,
                isCharging: currentCharging,
                accuracy: vessel.accuracy
            }, ...prev].slice(0, 50));
        };

        if (statusChanged || timestampUpdated) {
            const label = vessel.eventLabel || { moving: 'MOUVEMENT', stationary: 'MOUILLAGE', offline: 'SIGNAL PERDU', returning: 'RETOUR MAISON', landed: 'À TERRE' }[currentStatus] || currentStatus;
            addToHistory(label);
            
            if (lastStatus && statusChanged && vesselPrefs.isNotifyEnabled && mode !== 'sender') {
                const key = (currentStatus === 'returning' || currentStatus === 'landed') ? 'moving' : currentStatus;
                if (vesselPrefs.notifySettings[key as keyof typeof vesselPrefs.notifySettings]) {
                    playVesselSound(vesselPrefs.notifySounds[key as keyof typeof vesselPrefs.notifySounds] || 'sonar');
                }
            }
            lastStatusesRef.current[vessel.id] = currentStatus;
            lastUpdatesRef.current[vessel.id] = timeKey;
        }

        if (batteryAlert && vesselPrefs.notifySettings.battery) {
            addToHistory('BATTERIE FAIBLE');
            playVesselSound(vesselPrefs.notifySounds.battery || 'alerte');
        }

        if (lastChargingStatesRef.current[vessel.id] !== currentCharging) {
            addToHistory(currentCharging ? "BATTERIE EN CHARGE" : "DÉBRANCHÉ DU SECTEUR");
            lastChargingStatesRef.current[vessel.id] = currentCharging;
        }
        lastBatteryLevelsRef.current[vessel.id] = currentBattery;
    });
  }, [followedVessels, vesselPrefs, playVesselSound, mode]);

  const NotificationSettingsUI = () => (
    <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
        <div className="flex items-center justify-between border-b border-dashed pb-3">
            <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Alertes Audio</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Activer les signaux sonores</p></div>
            <Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, isNotifyEnabled: v })} />
        </div>
        <div className="space-y-3 pt-2">
            <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Volume2 className="size-3" /> Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label>
            <Slider value={[vesselPrefs.vesselVolume * 100]} max={100} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, vesselVolume: v[0] / 100 })} />
        </div>
        <div className="grid gap-3 pt-4 border-t border-dashed">
            {[
                { key: 'moving', label: 'Mouvement', color: 'text-blue-600' },
                { key: 'stationary', label: 'Mouillage', color: 'text-amber-600' },
                { key: 'offline', label: 'Signal Perdu', color: 'text-red-600' },
                { key: 'battery', label: 'Batterie Faible', color: 'text-red-800' }
            ].map(ev => (
                <div key={ev.key} className={cn("p-3 rounded-xl border-2 flex flex-col gap-3 transition-all", vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings] ? "bg-white" : "bg-muted/30 opacity-60")}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Bell className={cn("size-3", ev.color)} /><span className="text-[10px] font-black uppercase">{ev.label}</span></div>
                        <Switch checked={vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings]} onCheckedChange={v => saveVesselPrefs({ ...vesselPrefs, notifySettings: { ...vesselPrefs.notifySettings, [ev.key]: v } })} className="scale-75" />
                    </div>
                    <div className="flex gap-2">
                        <Select disabled={!vesselPrefs.notifySettings[ev.key as keyof typeof vesselPrefs.notifySettings]} value={vesselPrefs.notifySounds[ev.key as keyof typeof vesselPrefs.notifySounds]} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, notifySounds: { ...vesselPrefs.notifySounds, [ev.key]: v } })}>
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-1"><SelectValue placeholder="Son..." /></SelectTrigger>
                            <SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 border" onClick={() => playVesselSound(vesselPrefs.notifySounds[ev.key as keyof typeof vesselPrefs.notifySounds])}><Play className="size-3" /></Button>
                    </div>
                </div>
            ))}
        </div>
        <div className="pt-4 border-t border-dashed space-y-3">
            <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase opacity-60">Seuil Batterie Faible</Label><Badge variant="outline" className="font-black text-[10px]">{vesselPrefs.batteryThreshold}%</Badge></div>
            <Slider value={[vesselPrefs.batteryThreshold]} min={5} max={50} step={5} onValueChange={v => saveVesselPrefs({ ...vesselPrefs, batteryThreshold: v[0] })} />
        </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
          <Button variant={mode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setMode('fleet')}>Flotte (C)</Button>
        </div>

        <CardContent className="p-4 space-y-4">
          {mode === 'sender' ? (
            <div className="space-y-4">
              {isSharing ? (
                <div className="space-y-4 animate-in fade-in">
                    <div className={cn("p-6 rounded-2xl shadow-xl relative overflow-hidden border-2 text-white", vesselStatus === 'landed' ? "bg-green-600 border-green-400/20" : "bg-primary border-primary-foreground/20")}>
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase flex items-center gap-2"><Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage actif</p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[10px] px-3 animate-pulse">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase flex items-center gap-2">
                                {vesselStatus === 'moving' ? <Navigation className="size-3" /> : <Anchor className="size-3" />}
                                {vesselStatus === 'moving' ? 'En mouvement' : 'Au mouillage'}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => handleManualStatus('returning')}><Navigation className="size-4 mr-2 text-blue-600" /> Retour Maison</Button>
                        <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => handleManualStatus('landed')}><Home className="size-4 mr-2 text-green-600" /> Home (À terre)</Button>
                    </div>
                    <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20" onClick={handleStopSharing}><X className="size-5" /> Arrêter le partage</Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                        <Switch checked={isSharing} onCheckedChange={setIsSharing} />
                    </div>
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-muted/10">
                        <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Mode Fantôme</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Masquer ma position pour la Flotte C uniquement</p></div>
                        <Switch checked={isGhostMode} onCheckedChange={setIsGhostMode} />
                    </div>
                </div>
              )}

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="sender-ids" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Identité & IDs</span></AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">Mon Surnom</Label><Input value={vesselNickname} onChange={e => setVesselNickname(e.target.value)} placeholder="CAPITAINE..." className="font-black h-12 border-2 uppercase" /></div>
                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID Navire (B)</Label>
                            <div className="flex gap-2">
                                <Input placeholder="BATEAU-1" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-mono h-12 border-2 uppercase flex-1" />
                                <Button variant="outline" size="icon" className="h-12 w-12 border-2" onClick={handleSaveVessel}><Save className="size-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-60 ml-1">ID Groupe Flotte (C)</Label><Input placeholder="EX: PECHE-NC" value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-mono h-12 border-2 uppercase" /></div>
                        {idHistory.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-dashed">
                                <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Historique des IDs</p>
                                <div className="grid gap-2">{idHistory.map(id => (
                                    <div key={id} className="flex items-center justify-between p-2 bg-white border-2 rounded-xl shadow-sm">
                                        <code className="font-black text-primary text-xs uppercase">{id}</code>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setCustomSharingId(id)}><Ship className="size-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="size-8 text-primary" onClick={() => setFleetGroupId(id)}><Users className="size-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="size-8 text-destructive/40" onClick={() => updateDoc(doc(firestore!, 'users', user!.uid), { vesselIdHistory: arrayRemove(id) })}><X className="size-3.5" /></Button>
                                        </div>
                                    </div>
                                ))}</div>
                            </div>
                        )}
                        <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] border-2 gap-2" onClick={toggleWakeLock}><Zap className={cn("size-4", wakeLock && "fill-primary")} />{wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}</Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sms-urgence" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-orange-50/50 border-2 border-orange-100/50 rounded-xl"><Smartphone className="size-4 text-orange-600" /><span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span></AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="space-y-4 p-4 border-2 rounded-2xl bg-card shadow-inner">
                            <div className="flex items-center justify-between border-b border-dashed pb-3"><div className="space-y-0.5"><Label className="text-xs font-black uppercase text-orange-800">Service d'Urgence</Label><p className="text-[9px] font-bold text-orange-600/60 uppercase">Activer le contact SMS</p></div><Switch checked={isEmergencyEnabled} onCheckedChange={setIsEmergencyEnabled} /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Numéro du contact à terre</Label><Input placeholder="Ex: 77 12 34" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="h-12 border-2 font-black text-lg" /></div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between mb-1"><Label className="text-[10px] font-black uppercase opacity-60">Message personnalisé</Label><Switch checked={isCustomMessageEnabled} onCheckedChange={setIsCustomMessageEnabled} className="scale-75" /></div>
                                <Textarea placeholder="Ex: Problème moteur, besoin aide." value={vesselSmsMessage} onChange={e => setVesselSmsMessage(e.target.value)} className="border-2 font-medium min-h-[80px]" disabled={!isCustomMessageEnabled} />
                            </div>
                            <div className="space-y-2 pt-2 border-t border-dashed">
                                <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2"><Eye className="size-3" /> Aperçu du message :</p>
                                <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] leading-relaxed">"{smsPreview}"</div>
                            </div>
                            <Button onClick={async () => { await updateDoc(doc(firestore!, 'users', user!.uid), { emergencyContact, vesselSmsMessage, isEmergencyEnabled, isCustomMessageEnabled }); toast({ title: "Réglages d'urgence sauvés" }); }} className="w-full h-12 font-black uppercase text-[10px] shadow-md">Sauvegarder réglages SMS</Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sender-sounds" className="border-none mt-2">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Volume2 className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Notifications & Sons</span></AccordionTrigger>
                    <AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : mode === 'receiver' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du navire à suivre (B)</Label>
                <div className="flex gap-2">
                    <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => setVesselIdToFollow(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" />
                    <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px]" onClick={handleSaveVessel}><Check className="size-4" /></Button>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="notifs-settings" className="border-none">
                  <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Notifications & Sons</span></AccordionTrigger>
                  <AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">ID du Groupe Flotte à suivre (C)</Label>
                <div className="flex gap-2">
                    <Input placeholder="ID GROUPE EX: PECHE-NC" value={fleetGroupId} onChange={e => setFleetGroupId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest flex-1" />
                    <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px]" onClick={() => { if(fleetGroupId) handleSaveVessel(); }}><Check className="size-4" /></Button>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="fleet-notifs" className="border-none">
                  <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl"><Settings className="size-4 text-primary" /><span className="text-[10px] font-black uppercase">Notifications & Sons Flotte</span></AccordionTrigger>
                  <AccordionContent className="pt-4"><NotificationSettingsUI /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={10} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {followedVessels?.filter(v => v.isSharing).map(vessel => {
                    const isOwn = vessel.id === sharingId;
                    const isModeFleet = mode === 'fleet';
                    // Si mode flotte et mode fantôme activé sur un autre navire, on ne l'affiche pas
                    if (isModeFleet && vessel.isGhostMode && !isOwn) return null;
                    if (isOwn && mode === 'sender') return null;
                    
                    return (
                        <OverlayView key={vessel.id} position={{ lat: vessel.location!.latitude, lng: vessel.location!.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                                <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2">
                                    <span className="truncate max-w-[80px]">{vessel.displayName || vessel.id}</span>
                                    <BatteryIconComp level={vessel.batteryLevel} charging={vessel.isCharging} className="size-2.5" />
                                </div>
                                <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", 
                                    vessel.status === 'moving' ? "bg-blue-600" : 
                                    vessel.status === 'returning' ? "bg-indigo-600" :
                                    vessel.status === 'landed' ? "bg-green-600" : "bg-amber-600")}>
                                    {vessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                                </div>
                            </div>
                        </OverlayView>
                    );
                })}
                {mode === 'sender' && currentPos && <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><PulsingDot /></OverlayView>}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0"><LocateFixed className="size-5 text-primary" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase shadow-lg gap-3 text-xs" onClick={() => sendEmergencySms('MAYDAY')}><ShieldAlert className="size-5" /> MAYDAY</Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase shadow-lg gap-3 text-xs border-2 border-primary/20" onClick={() => sendEmergencySms('PAN PAN')}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
            </div>
            <div className="border rounded-xl bg-muted/10 overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="history" className="border-none">
                        <div className="flex items-center justify-between px-3 h-12">
                            <AccordionTrigger className="flex-1 text-[10px] font-black uppercase hover:no-underline py-0"><History className="size-3 mr-2"/> Journal Technique</AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black text-destructive" onClick={handleClearHistory}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                        </div>
                        <AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 scrollbar-hide px-3">
                            {history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-primary uppercase">{h.vesselName}</span>
                                            <span className="font-black uppercase opacity-60">{h.statusLabel}</span>
                                            <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black border", h.isCharging ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-500 border-slate-200")}>
                                                {h.isCharging && <Zap className="size-2.5 fill-current" />}{h.batteryLevel}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 font-bold opacity-40">
                                            <span>{format(h.time, 'HH:mm:ss')}</span>
                                            {h.accuracy !== undefined && <span>• +/- {h.accuracy}m</span>}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 border-2 px-3 text-[9px] font-black uppercase gap-1" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>GPS</Button>
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
      </Card>
    </div>
  );
}

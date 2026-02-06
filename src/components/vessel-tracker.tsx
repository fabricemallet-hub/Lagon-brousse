
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser as useUserHook, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, orderBy, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
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
  Copy, 
  AlertTriangle,
  Bell,
  Clock,
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
  Ship
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VesselStatus, UserAccount, SoundLibraryEntry } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from './badge';

const INITIAL_CENTER = { lat: -22.27, lng: 166.45 };
const IMMOBILITY_THRESHOLD_METERS = 20; 

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

const defaultVesselSounds = [
  { id: 'sonar', label: 'Ping Sonar', url: 'https://assets.mixkit.co/active_storage/sfx/2564/2564-preview.mp3' },
  { id: 'cloche', label: 'Cloche Classique', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
  { id: 'alerte', label: 'Alerte Urgence', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'bip', label: 'Bip Digital', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
];

export function VesselTracker() {
  const { user } = useUserHook();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isLoaded, loadError } = useGoogleMaps();

  const [mode, setMode] = useState<'sender' | 'receiver'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const [isFollowActive, setIsFollowActive] = useState(false);
  const [confirmedVesselId, setConfirmedVesselId] = useState('');
  
  const [isSharing, setIsSharing] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [customSharingId, setCustomSharingId] = useState('');
  const [vesselNickname, setVesselNickname] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const shouldPanOnNextFix = useRef(false);

  const [currentPos, setCurrentPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [anchorPos, setAnchorPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [vesselStatus, setVesselStatus] = useState<'moving' | 'stationary'>('moving');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const immobilityStartTime = useRef<number | null>(null);

  const [vesselPrefs, setVesselPrefs] = useState<NonNullable<UserAccount['vesselPrefs']>>({
    isNotifyEnabled: true,
    vesselVolume: 0.8,
    notifySettings: { moving: true, stationary: true, offline: true },
    notifySounds: { moving: 'sonar', stationary: 'cloche', offline: 'alerte' },
    isWatchEnabled: false,
    watchType: 'stationary',
    watchDuration: 15,
    watchSound: 'alerte'
  });
  
  const [history, setHistory] = useState<{ status: string, time: Date, pos: google.maps.LatLngLiteral }[]>([]);
  const lastStatusRef = useRef<string | null>(null);
  const batteryAlertTriggered = useRef(false);
  const watchTriggeredRef = useRef(false);

  const sharingId = useMemo(() => (customSharingId.trim() || user?.uid || '').toUpperCase(), [customSharingId, user?.uid]);
  const activeVesselId = useMemo(() => 
    mode === 'sender' ? sharingId : confirmedVesselId.trim().toUpperCase(), 
  [mode, sharingId, confirmedVesselId]);

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

  const soundsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sound_library'), orderBy('label', 'asc'));
  }, [firestore]);
  const { data: dbSounds } = useCollection<SoundLibraryEntry>(soundsQuery);

  const availableSounds = useMemo(() => {
    const list = [...defaultVesselSounds];
    if (dbSounds) {
      dbSounds.forEach(s => {
        const isVessel = !s.categories || s.categories.includes('Vessel') || s.categories.includes('General');
        if (isVessel && !list.find(l => l.url === s.url)) list.push({ id: s.id, label: s.label, url: s.url });
      });
    }
    return list;
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
    if (userProfile?.vesselPrefs) setVesselPrefs(userProfile.vesselPrefs);
    if (userProfile?.emergencyContact) setEmergencyContact(userProfile.emergencyContact);
    if (userProfile?.displayName && !vesselNickname) setVesselNickname(userProfile.displayName);
    if (userProfile?.lastVesselId && !customSharingId) setCustomSharingId(userProfile.lastVesselId);
  }, [userProfile, vesselNickname, customSharingId]);

  const handleSaveVessel = async () => {
    if (!user || !firestore || !sharingId) return;
    try {
        const currentSaved = userProfile?.savedVesselIds || [];
        if (!currentSaved.includes(sharingId)) {
            await updateDoc(doc(firestore, 'users', user.uid), {
                savedVesselIds: [...currentSaved, sharingId],
                lastVesselId: sharingId
            });
            toast({ title: "Navire enregistré" });
        } else {
            await updateDoc(doc(firestore, 'users', user.uid), { lastVesselId: sharingId });
            toast({ title: "ID mis à jour" });
        }
    } catch (e) { console.error(e); }
  };

  const handleRemoveSavedVessel = async (id: string) => {
    if (!user || !firestore || !userProfile) return;
    try {
        const next = (userProfile.savedVesselIds || []).filter(v => v !== id);
        await updateDoc(doc(firestore, 'users', user.uid), { savedVesselIds: next });
        toast({ title: "Navire effacé" });
    } catch (e) { console.error(e); }
  };

  const updateVesselInFirestore = useCallback((data: Partial<VesselStatus>) => {
    if (!user || !firestore || (!isSharing && data.isSharing !== false)) return;
    const update = async () => {
        let batteryInfo = {};
        if ('getBattery' in navigator) {
            const b: any = await (navigator as any).getBattery();
            batteryInfo = { batteryLevel: Math.round(b.level * 100), isCharging: b.charging };
        }
        setDoc(doc(firestore, 'vessels', sharingId), { 
            userId: user.uid, 
            displayName: vesselNickname || user.displayName || 'Capitaine', 
            isSharing: isSharing, 
            lastActive: serverTimestamp(),
            ...batteryInfo,
            ...data 
        }, { merge: true }).catch(() => {});
    };
    update();
  }, [user, firestore, isSharing, sharingId, vesselNickname]);

  const handleStopSharing = async () => {
    setIsSharing(false);
    updateVesselInFirestore({ isSharing: false });
    if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
    }
    setCurrentPos(null);
    setAnchorPos(null);
    toast({ title: "Partage arrêté" });
  };

  const handleFollow = () => {
    if (!vesselIdToFollow.trim()) return;
    const cleanId = vesselIdToFollow.trim().toUpperCase();
    setConfirmedVesselId(cleanId);
    setIsFollowActive(true);
    setHistory([]);
    lastStatusRef.current = null;
    watchTriggeredRef.current = false;
    batteryAlertTriggered.current = false;
    toast({ title: "Suivi activé", description: `Connexion au navire ${cleanId}...` });
  };

  useEffect(() => {
    if (mode !== 'receiver' || !remoteVessel || !activeVesselId) return;
    const currentStatus = remoteVessel.isSharing ? (remoteVessel.status || 'moving') : 'offline';
    
    if (lastStatusRef.current !== currentStatus) {
      const statusLabels: Record<string, string> = { moving: 'En mouvement', stationary: 'Au mouillage', offline: 'Signal perdu' };
      const isInitial = lastStatusRef.current === null;
      const label = isInitial ? `Connecté - ${statusLabels[currentStatus] || currentStatus}` : (statusLabels[currentStatus] || currentStatus);
      
      const pos = { 
        lat: remoteVessel.location?.latitude || INITIAL_CENTER.lat, 
        lng: remoteVessel.location?.longitude || INITIAL_CENTER.lng 
      };

      setHistory(prev => [{ status: label, time: new Date(), pos }, ...prev].slice(0, 20));
      
      if (!isInitial && vesselPrefs.isNotifyEnabled) {
        if (vesselPrefs.notifySettings[currentStatus as keyof typeof vesselPrefs.notifySettings]) {
          playVesselSound(vesselPrefs.notifySounds[currentStatus as keyof typeof vesselPrefs.notifySounds]);
          toast({ title: "Changement d'état", description: `Le navire est maintenant : ${statusLabels[currentStatus] || currentStatus}` });
        }
      }
      lastStatusRef.current = currentStatus;
      watchTriggeredRef.current = false;
    }

    if (remoteVessel.batteryLevel !== undefined && remoteVessel.batteryLevel <= 5 && !remoteVessel.isCharging) {
        if (!batteryAlertTriggered.current) {
            toast({ variant: "destructive", title: "BATTERIE CRITIQUE", description: `L'émetteur n'a plus que ${remoteVessel.batteryLevel}% !` });
            playVesselSound('alerte');
            batteryAlertTriggered.current = true;
        }
    } else { batteryAlertTriggered.current = false; }

    if (vesselPrefs.isWatchEnabled && !watchTriggeredRef.current) {
        if (currentStatus === vesselPrefs.watchType) {
            const lastUpdate = remoteVessel.lastActive?.toDate?.() || new Date();
            const diffMinutes = (new Date().getTime() - lastUpdate.getTime()) / 60000;
            if (diffMinutes >= vesselPrefs.watchDuration) {
                watchTriggeredRef.current = true;
                playVesselSound(vesselPrefs.watchSound);
                toast({ variant: "destructive", title: "ALERTE VEILLE CRITIQUE", description: `Condition [${currentStatus}] maintenue trop longtemps (${vesselPrefs.watchDuration} min)` });
            }
        }
    }
  }, [remoteVessel, mode, vesselPrefs, playVesselSound, toast, activeVesselId]);

  useEffect(() => {
    if (!isSharing || mode !== 'sender' || !navigator.geolocation) {
      if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPos(newPos);
        if (shouldPanOnNextFix.current && map) { map.panTo(newPos); map.setZoom(15); shouldPanOnNextFix.current = false; }
        if (!anchorPos) { 
          setAnchorPos(newPos); 
          updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true }); 
          return; 
        }
        const dist = getDistance(newPos.lat, newPos.lng, anchorPos.lat, anchorPos.lng);
        if (dist > IMMOBILITY_THRESHOLD_METERS) {
          setVesselStatus('moving'); setAnchorPos(newPos); immobilityStartTime.current = null;
          updateVesselInFirestore({ location: { latitude: newPos.lat, longitude: newPos.lng }, status: 'moving', isSharing: true });
        } else {
          if (!immobilityStartTime.current) immobilityStartTime.current = Date.now();
          if (Date.now() - immobilityStartTime.current > 30000) {
            setVesselStatus('stationary'); updateVesselInFirestore({ status: 'stationary' });
          }
        }
      },
      () => toast({ variant: "destructive", title: "Erreur GPS" }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [isSharing, mode, anchorPos, updateVesselInFirestore, map, toast]);

  const savePrefs = (newPrefs: Partial<typeof vesselPrefs>) => {
    const updated = { ...vesselPrefs, ...newPrefs };
    setVesselPrefs(updated);
    if (userDocRef) updateDoc(userDocRef, { vesselPrefs: updated });
  };

  const toggleWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock) { try { await wakeLock.release(); setWakeLock(null); } catch (e) {} }
    else { try { const lock = await (navigator as any).wakeLock.request('screen'); setWakeLock(lock); lock.addEventListener('release', () => setWakeLock(null)); } catch (err) {} }
  };

  const handleRecenter = () => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : null);
    if (pos && map) { map.panTo(pos); map.setZoom(15); } else { shouldPanOnNextFix.current = true; }
  };

  const copyCoordinates = () => {
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : null);
    if (pos) { navigator.clipboard.writeText(`${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`); toast({ title: "Coordonnées copiées" }); }
  };

  const sendEmergencySms = (type: 'SOS' | 'MAYDAY' | 'PAN PAN') => {
    if (!emergencyContact) { toast({ variant: "destructive", title: "Numéro requis" }); return; }
    const pos = mode === 'sender' ? currentPos : (remoteVessel?.location ? { lat: remoteVessel.location.latitude, lng: remoteVessel.location.longitude } : null);
    const posUrl = pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}` : "[RECHERCHE GPS...]";
    let durationStr = "";
    if (mode === 'receiver' && remoteVessel?.status === 'stationary') {
        const lastActive = remoteVessel.lastActive?.toDate?.() || new Date();
        const diffMs = new Date().getTime() - lastActive.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        durationStr = ` (Immobile depuis ${diffMins} min)`;
    }
    const body = `${type} Lagon & Brousse NC : ${vesselNickname || remoteVessel?.displayName || 'Navire'} en difficulté${durationStr}.\nPosition : ${posUrl}`;
    window.location.href = `sms:${emergencyContact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const displayVessel = mode === 'sender' ? (isSharing ? { location: { latitude: currentPos?.lat || 0, longitude: currentPos?.lng || 0 }, status: vesselStatus, displayName: vesselNickname || 'Ma Position', batteryLevel: 100 } : null) : remoteVessel;

  const BatteryIconComp = ({ level, charging }: { level?: number, charging?: boolean }) => {
    if (level === undefined) return <WifiOff className="size-4 opacity-40" />;
    const props = { className: "size-4" };
    if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
    if (level <= 10) return <BatteryLow {...props} className="text-red-600" />;
    if (level <= 40) return <BatteryMedium {...props} className="text-orange-500" />;
    return <BatteryFull {...props} className="text-green-600" />;
  };

  if (isProfileLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-32">
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="flex bg-muted/30 p-1">
          <Button variant={mode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12 touch-manipulation" onClick={() => setMode('sender')}>Émetteur (A)</Button>
          <Button variant={mode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12 touch-manipulation" onClick={() => setMode('receiver')}>Récepteur (B)</Button>
        </div>

        <CardContent className="p-4 space-y-4">
          {mode === 'sender' ? (
            <div className="space-y-6">
              {isSharing ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="p-6 bg-primary text-white rounded-2xl shadow-xl relative overflow-hidden border-2 border-primary-foreground/20">
                        <Navigation className="absolute -right-4 -bottom-4 size-32 opacity-10 rotate-12" />
                        <div className="space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase text-blue-100 tracking-widest flex items-center gap-2">
                                <Zap className="size-3 fill-yellow-300 text-yellow-300" /> Partage en cours
                            </p>
                            <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{sharingId}</h3>
                            <p className="text-xs font-bold opacity-80 mt-1 italic">{vesselNickname || 'Capitaine'}</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <Badge variant="outline" className="bg-green-500/30 border-green-200 text-white font-black text-[10px] px-3 h-6 animate-pulse">EN LIGNE</Badge>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                {vesselStatus === 'moving' ? <Move className="size-3" /> : <Anchor className="size-3" />}
                                {vesselStatus === 'moving' ? 'En mouvement' : 'Au mouillage'}
                            </span>
                        </div>
                    </div>
                    <Button 
                        variant="destructive" 
                        className="w-full h-16 text-xs font-black uppercase tracking-widest shadow-lg rounded-xl gap-3 border-2 border-white/20 touch-manipulation"
                        onClick={handleStopSharing}
                    >
                        <X className="size-5" /> Arrêter le partage / Quitter
                    </Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-2xl bg-primary/5 border-primary/10">
                        <div className="space-y-0.5"><Label className="text-sm font-black uppercase">Partager ma position</Label><p className="text-[9px] font-bold text-muted-foreground uppercase">Flux direct vers récepteur</p></div>
                        <Switch checked={isSharing} onCheckedChange={(val) => { setIsSharing(val); updateVesselInFirestore({ isSharing: val }); }} />
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Identifiant de partage</Label>
                            <div className="flex gap-2">
                                <Input placeholder="EX: MONBATEAU" value={customSharingId} onChange={e => setCustomSharingId(e.target.value)} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                                <Button variant="outline" size="icon" className="h-12 w-12 border-2 shrink-0 touch-manipulation" onClick={handleSaveVessel}><Save className="size-4" /></Button>
                            </div>
                        </div>
                        
                        {(userProfile?.savedVesselIds || []).length > 0 && (
                            <div className="space-y-2 pt-2">
                                <Label className="text-[9px] font-black uppercase ml-1 opacity-40">Mes Navires Enregistrés</Label>
                                <div className="grid gap-2">
                                    {(userProfile?.savedVesselIds || []).map(id => (
                                        <div key={id} className="flex items-center justify-between p-3 border-2 rounded-xl bg-muted/5 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Ship className="size-4"/></div>
                                                <span className="font-black text-xs uppercase tracking-tight">{id}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => setCustomSharingId(id)} className="text-[9px] font-black uppercase h-8 px-3 border-2 touch-manipulation">Sél.</Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveSavedVessel(id)} className="size-8 text-destructive/40 hover:text-destructive border-2 touch-manipulation"><Trash2 className="size-3" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button variant={wakeLock ? "secondary" : "outline"} className="w-full h-12 font-black uppercase text-[10px] tracking-widest border-2 gap-2 touch-manipulation" onClick={toggleWakeLock}>
                            <Zap className={cn("size-4", wakeLock && "fill-primary")} />
                            {wakeLock ? "MODE ÉVEIL ACTIF" : "ACTIVER MODE ÉVEIL"}
                        </Button>
                    </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1 opacity-60">Suivre le navire ID</Label>
                <div className="flex gap-2">
                    <Input placeholder="ENTREZ L'ID..." value={vesselIdToFollow} onChange={e => { setVesselIdToFollow(e.target.value); setIsFollowActive(false); }} className="font-black text-center h-12 border-2 uppercase tracking-widest" />
                    <Button variant={isFollowActive ? "secondary" : "default"} className="h-12 px-4 font-black uppercase text-[10px] shrink-0 touch-manipulation" onClick={handleFollow} disabled={!vesselIdToFollow.trim()}>{isFollowActive ? <Check className="size-4" /> : "Suivre"}</Button>
                </div>
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 border rounded-xl bg-card shadow-sm"><div className="flex items-center gap-2"><Bell className="size-4 text-primary"/><span className="text-[10px] font-black uppercase">Alertes Sonores</span></div><Switch checked={vesselPrefs.isNotifyEnabled} onCheckedChange={(v) => savePrefs({ isNotifyEnabled: v })} /></div>
                <div className="space-y-3 px-1"><Label className="text-[9px] font-black uppercase opacity-40">Volume ({Math.round(vesselPrefs.vesselVolume * 100)}%)</Label><Slider value={[vesselPrefs.vesselVolume * 100]} max={100} step={1} onValueChange={(v) => savePrefs({ vesselVolume: v[0] / 100 })} /></div>
                <Accordion type="single" collapsible className="space-y-2">
                    <AccordionItem value="sounds" className="border rounded-xl px-3 bg-muted/10"><AccordionTrigger className="text-[10px] font-black uppercase hover:no-underline py-3"><div className="flex items-center gap-2"><Volume2 className="size-3"/> Personnaliser sons</div></AccordionTrigger><AccordionContent className="space-y-4 pt-2 pb-4">{['moving', 'stationary', 'offline'].map((st: any) => (<div key={st} className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-60">{st === 'moving' ? 'En mouvement' : st === 'stationary' ? 'Au mouillage' : 'Signal perdu'}</Label><div className="flex gap-2"><Select value={vesselPrefs.notifySounds[st as keyof typeof vesselPrefs.notifySounds]} onValueChange={(v) => { const s = { ...vesselPrefs.notifySounds, [st]: v }; savePrefs({ notifySounds: s }); }}><SelectTrigger className="h-9 text-[10px] font-bold"><SelectValue /></SelectTrigger><SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" className="size-9 shrink-0 touch-manipulation" onClick={() => playVesselSound(vesselPrefs.notifySounds[st as keyof typeof vesselPrefs.notifySounds])}><Play className="size-3" /></Button></div></div>))}</AccordionContent></AccordionItem>
                    <AccordionItem value="watch" className="border rounded-xl px-3 bg-muted/10"><AccordionTrigger className="text-[10px] font-black uppercase hover:no-underline py-3"><div className="flex items-center gap-2"><Clock className="size-3"/> Veille Critique</div></AccordionTrigger><AccordionContent className="space-y-4 pt-2 pb-4"><div className="flex items-center justify-between p-2 border-2 border-dashed rounded-lg"><span className="text-[9px] font-black uppercase">Activer la veille</span><Switch checked={vesselPrefs.isWatchEnabled} onCheckedChange={(v) => savePrefs({ isWatchEnabled: v })} /></div><div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-60">Condition</Label><Select value={vesselPrefs.watchType} onValueChange={(v: any) => savePrefs({ watchType: v })}><SelectTrigger className="h-9 text-[10px] font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stationary">Immobilité</SelectItem><SelectItem value="moving">Mouvement</SelectItem><SelectItem value="offline">Signal perdu</SelectItem></SelectContent></Select></div><div className="space-y-3"><div className="flex justify-between px-1"><Label className="text-[8px] font-black uppercase opacity-60">Durée</Label><span className="text-[10px] font-black text-orange-600">{vesselPrefs.watchDuration} min</span></div><Slider value={[vesselPrefs.watchDuration]} min={1} max={120} step={1} onValueChange={(v) => savePrefs({ watchDuration: v[0] })} /></div><div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-60">Son</Label><div className="flex gap-2"><Select value={vesselPrefs.watchSound} onValueChange={(v) => savePrefs({ watchSound: v })}><SelectTrigger className="h-9 text-[10px] font-bold"><SelectValue /></SelectTrigger><SelectContent>{availableSounds.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" className="size-9 shrink-0 touch-manipulation" onClick={() => playVesselSound(vesselPrefs.watchSound)}><Play className="size-3" /></Button></div></div></AccordionContent></AccordionItem>
                </Accordion>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("overflow-hidden border-2 shadow-xl flex flex-col transition-all", isFullscreen && "fixed inset-0 z-[100] w-screen h-screen rounded-none")}>
        <div className={cn("relative bg-muted/20", isFullscreen ? "flex-grow" : "h-[300px]")}>
          <GoogleMap mapContainerClassName="w-full h-full" defaultCenter={INITIAL_CENTER} defaultZoom={15} onLoad={setMap} options={{ disableDefaultUI: true, mapTypeId: 'satellite', gestureHandling: 'greedy' }}>
                {displayVessel?.location && (
                    <OverlayView position={{ lat: displayVessel.location.latitude, lng: displayVessel.location.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center gap-1">
                        <div className="px-2 py-1 bg-slate-900/90 text-white rounded text-[10px] font-black shadow-lg border border-white/20 whitespace-nowrap flex items-center gap-2">
                          {displayVessel.displayName}
                          <BatteryIconComp level={displayVessel.batteryLevel} charging={displayVessel.isCharging} />
                        </div>
                        <div className={cn("p-2 rounded-full border-2 border-white shadow-xl", displayVessel.status === 'moving' ? "bg-blue-600" : "bg-amber-600")}>
                          {displayVessel.status === 'stationary' ? <Anchor className="size-5 text-white" /> : <Navigation className="size-5 text-white" />}
                        </div>
                    </div>
                    </OverlayView>
                )}
          </GoogleMap>
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Button onClick={handleRecenter} className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 p-0 touch-manipulation"><LocateFixed className="size-5" /></Button>
            <Button size="icon" className="shadow-lg h-10 w-10 bg-background/90 backdrop-blur-md border-2 touch-manipulation" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
          </div>
          {displayVessel && (
            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                <div className={cn("flex-1 p-2 rounded-lg backdrop-blur-md text-white border flex items-center justify-between shadow-lg", displayVessel.status === 'moving' ? "bg-blue-600/80 border-blue-400/30" : "bg-amber-600/80 border-amber-400/30")}>
                    <div className="flex items-center gap-2"><Move className={cn("size-4", displayVessel.status === 'moving' && "animate-pulse")} /><span className="text-[10px] font-black uppercase">{displayVessel.status === 'moving' ? 'En mouvement' : 'Au mouillage'}</span></div>
                    <div className="flex items-center gap-2 border-l pl-2 border-white/20"><BatteryIconComp level={displayVessel.batteryLevel} charging={displayVessel.isCharging} /><span className="text-[10px] font-black">{displayVessel.batteryLevel}%</span></div>
                </div>
            </div>
          )}
        </div>

        <div className="bg-card p-4 flex flex-col gap-4 border-t-2">
            <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" className="h-10 font-black uppercase text-[9px] border-2 gap-2 touch-manipulation" onClick={copyCoordinates} disabled={!displayVessel?.location}><Copy className="size-3" /> Coordonnées</Button>
                <Button variant="ghost" className="h-10 font-black uppercase text-[9px] border-2 gap-2 touch-manipulation" onClick={() => { if(mode === 'receiver') setHistory([]); }}><X className="size-3" /> Effacer Hist.</Button>
            </div>
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs touch-manipulation" onClick={() => sendEmergencySms('MAYDAY')} disabled={!displayVessel?.location}><ShieldAlert className="size-5" /> MAYDAY</Button>
                <Button variant="secondary" className="flex-1 h-14 font-black uppercase rounded-xl shadow-lg gap-3 text-xs border-2 border-primary/20 touch-manipulation" onClick={() => sendEmergencySms('PAN PAN')} disabled={!displayVessel?.location}><AlertTriangle className="size-5 text-primary" /> PAN PAN</Button>
            </div>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history" className="border rounded-xl px-3 bg-muted/10"><AccordionTrigger className="text-[10px] font-black uppercase py-3"><div className="flex items-center gap-2"><History className="size-3"/> Historique des changements</div></AccordionTrigger><AccordionContent className="space-y-2 pt-2 pb-4 overflow-y-auto max-h-64 touch-pan-y min-h-0">
                        {history.length > 0 ? (
                            <div className="space-y-2">
                                {history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border-2 text-[10px] shadow-sm animate-in fade-in slide-in-from-left-2">
                                        <div className="flex flex-col gap-0.5"><span className={cn("font-black uppercase", h.status.includes('mouillage') ? 'text-orange-600' : h.status.includes('mouvement') ? 'text-blue-600' : 'text-red-600')}>{h.status}</span><span className="text-[9px] font-bold opacity-40">{format(h.time, 'HH:mm:ss')}</span></div>
                                        <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase border-2 px-3 gap-2 touch-manipulation" onClick={() => { map?.panTo(h.pos); map?.setZoom(17); }}>
                                          <MapPin className="size-3 text-primary" /> GPS
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-40 bg-white/50">
                              <History className="size-8 mx-auto mb-2 opacity-20" />
                              <p className="text-[10px] font-black uppercase tracking-widest">pas d'affichage dans l'historique</p>
                            </div>
                        )}
                    </AccordionContent></AccordionItem>
            </Accordion>
            <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-red-200"><span className="text-[10px] font-black uppercase text-red-800">MRCC Secours en mer</span><span className="font-black text-xs text-red-600">196 / VHF 16</span></div>
                <div className="space-y-1.5 pt-1"><Label className="text-[9px] font-black uppercase opacity-60">Contact d'urgence pour SMS</Label><div className="flex gap-2"><Input type="tel" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="+687..." className="flex h-11 rounded-xl border-2 font-black text-sm" /><Button variant="outline" size="icon" className="h-11 w-11 border-2 shrink-0 touch-manipulation" onClick={() => { if(userProfile) updateDoc(doc(firestore, 'users', user.uid), { emergencyContact }); toast({ title: "Enregistré" }); }}><Save className="size-4" /></Button></div></div>
            </div>
        </div>
      </Card>
    </div>
  );
}

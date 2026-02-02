'use client';
import { useState, useEffect, useRef, useCallback, Fragment, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Share2,
  LogIn,
  LogOut,
  Copy,
  Users,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  LocateFixed,
  AlertCircle,
  Navigation,
  Download,
  Expand,
  Shrink,
  User as UserIcon,
  Crosshair,
  Footprints,
  Mountain,
  Save,
  MapPin,
  Eye,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
  useDoc,
} from '@/firebase';
import {
  collection,
  getDoc,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  getDocs,
  deleteField,
} from 'firebase/firestore';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { GoogleMap, useJsApiLoader, OverlayView, MarkerF } from '@react-google-maps/api';

const playSound = (type: 'position' | 'battue' | 'gibier') => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);

  switch (type) {
    case 'position':
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.type = 'sine';
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
      oscillator.stop(audioCtx.currentTime + 0.2);
      break;
    case 'battue':
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.type = 'square';
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
      oscillator.stop(audioCtx.currentTime + 0.3);
      break;
    case 'gibier':
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.type = 'triangle';
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
      oscillator.stop(audioCtx.currentTime + 0.4);
      break;
  }
};


// --- Icon Map ---
const iconMap = { Navigation, UserIcon, Crosshair, Footprints, Mountain };
const availableIcons = Object.keys(iconMap);
const availableColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const iconSvgs: Record<string, string> = {
  Navigation: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
  UserIcon: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  Crosshair: `<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>`,
  Footprints: `<path d="M4 16v-2.38c0-1.4.9-2.62 2.24-2.62s2.24 1.22 2.24 2.62V16"/><path d="M10.24 13.38v2.38c0 1.4-.9 2.62-2.24 2.62S5.76 17.18 5.76 15.78v-2.4"/><path d="M14.76 13.38v2.38c0 1.4.9 2.62 2.24 2.62s2.24-1.22 2.24-2.62v-2.4"/><path d="M20 16v-2.38c0-1.4-.9-2.62-2.24-2.62s-2.24 1.22-2.24 2.62V16"/>`,
  Mountain: `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>`,
};

// --- Helper Components ---

const BatteryIcon = ({ level, charging }: { level: number; charging: boolean }) => {
  const props = { className: 'w-4 h-4 inline-block' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 0.15) return <BatteryLow {...props} className="text-red-500" />;
  return <BatteryFull {...props} className="text-green-500" />;
};


function HuntingSessionContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [session, setSession] = useState<WithId<HuntingSession> | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number} | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(8);
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<string>('terrain');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialCenter, setInitialCenter] = useState<{ lat: number; lng: number } | null>(null);


  // Customization state
  const [nickname, setNickname] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Navigation');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Status state
  const [baseStatus, setBaseStatus] = useState<SessionParticipant['baseStatus']>(undefined);
  const [isGibierEnVue, setIsGibierEnVue] = useState(false);
  const [flashingStatus, setFlashingStatus] = useState<{text: string; color: string} | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const previousParticipantsRef = useRef<WithId<SessionParticipant>[] | null>(null);


  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (userProfile) {
      setNickname(userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || '');
      setSelectedIcon(userProfile.mapIcon || 'Navigation');
      setSelectedColor(userProfile.mapColor || '#3b82f6');
    } else if (user) {
      setNickname(user.displayName || user.email?.split('@')[0] || '');
    }
  }, [userProfile, user]);
  
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  const { isLoaded, loadError } = useJsApiLoader({
      googleMapsApiKey: googleMapsApiKey || "",
      preventGoogleFontsLoading: true,
  });

  useEffect(() => {
    const savedMapTypeId = localStorage.getItem('huntingMapTypeId');
    if (savedMapTypeId && ['roadmap', 'satellite', 'hybrid', 'terrain'].includes(savedMapTypeId)) {
      setMapTypeId(savedMapTypeId);
    }
  }, []);

  const handleLeaveSession = useCallback(async () => {
    if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
    }
    
    const previousSessionId = session?.id;
    setSession(null);
    setIsParticipating(false);
    setUserLocation(null);
    setInitialZoomDone(false);

    if (!user || !previousSessionId || !firestore) {
        return;
    }

    setIsSessionLoading(true);
    try {
        const participantDocRef = doc(firestore, 'hunting_sessions', previousSessionId, 'participants', user.uid);
        await deleteDoc(participantDocRef);
        toast({ title: 'Vous avez quitté la session.' });
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `hunting_sessions/${previousSessionId}/participants/${user.uid}`,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Failed to leave session:", e);
            setError("Erreur lors de la déconnexion de la session.");
        }
    } finally {
        setIsSessionLoading(false);
    }
  }, [user, session, firestore, toast]);

 const updateFirestorePosition = useCallback((latitude: number, longitude: number) => {
    if (!user || !firestore || !session?.id) return;

    const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
    const dataToUpdate: any = {
        'location.latitude': latitude,
        'location.longitude': longitude,
        updatedAt: serverTimestamp(),
    };
    
    // Non-blocking update.
    updateDoc(participantDocRef, dataToUpdate).catch(err => {
        if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: participantDocRef.path,
                operation: 'update',
                requestResourceData: { location: { latitude, longitude } }
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error updating position in Firestore:", err);
        }
    });
}, [user, firestore, session]);

 const handleDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
        const newLocation = {
            latitude: e.latLng.lat(),
            longitude: e.latLng.lng(),
        };
        setUserLocation(newLocation); // Optimistic UI update
        updateFirestorePosition(newLocation.latitude, newLocation.longitude);
    }
  };

  const fetchAndSetUserPosition = useCallback(async (isFirstUpdate = false) => {
    if (!user || !firestore || !navigator.geolocation || !session?.id) return;

    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            });
        });
        
        const { latitude, longitude } = position.coords;
        const newLocation = { latitude, longitude };
        setUserLocation(newLocation);

        if (isFirstUpdate && map && latitude && longitude) {
            map.panTo({ lat: latitude, lng: longitude });
            map.setZoom(16);
            setInitialZoomDone(true);
        }

        let batteryData: SessionParticipant['battery'] | undefined = undefined;
        if ('getBattery' in navigator) {
            try {
                const battery = await (navigator as any).getBattery();
                batteryData = { level: battery.level, charging: battery.charging };
            } catch (batteryError) {
                console.warn("Could not retrieve battery status:", batteryError);
            }
        }
        
        const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
        const dataToUpdate: any = {
            location: newLocation,
            updatedAt: serverTimestamp(),
        };
        if (batteryData) {
            dataToUpdate.battery = batteryData;
        }
        
        // Non-blocking update
        updateDoc(participantDocRef, dataToUpdate).catch(err => {
            console.error("Error updating position:", err);
             if (err.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: participantDocRef.path,
                    operation: 'update',
                    requestResourceData: dataToUpdate
                });
                errorEmitter.emit('permission-error', permissionError);
            }
        });

    } catch (err: any) {
        console.error("Error getting geolocation:", err);
        if (err.code === 1) { // User denied Geolocation
          toast({
            variant: "destructive",
            title: "Géolocalisation refusée",
            description: "La géolocalisation est requise pour être visible sur la carte. Activez-la dans les paramètres de votre navigateur.",
          });
          // Do not leave session, just inform the user.
        }
    }
  }, [user, firestore, session, toast, map]);
  
  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants, isLoading: areParticipantsLoading } = useCollection<SessionParticipant>(participantsCollectionRef);
  
  const myParticipant = useMemo(() => participants?.find(p => p.id === user?.uid), [participants, user]);
  const otherParticipants = useMemo(() => participants?.filter(p => p.id !== user?.uid), [participants, user]);
  
  useEffect(() => {
      // Don't play sounds for initial load.
      if (!participants || areParticipantsLoading || !previousParticipantsRef.current) {
        previousParticipantsRef.current = participants;
        return;
      }
      
      const prevParts = new Map(previousParticipantsRef.current.map(p => [p.id, p]));

      participants.forEach(currentPart => {
        // Don't play sound for my own status changes or new users.
        const prevPart = prevParts.get(currentPart.id);
        if (!prevPart || currentPart.id === user?.uid) {
            return;
        }

        // Play sound for gibier en vue (only when it becomes true)
        if (currentPart.isGibierEnVue && !prevPart.isGibierEnVue) {
            playSound('gibier');
            return; // Prioritize gibier sound
        }

        // Play sound for base status change
        if (currentPart.baseStatus && currentPart.baseStatus !== prevPart.baseStatus) {
            if (currentPart.baseStatus === 'En position') {
                playSound('position');
            } else if (currentPart.baseStatus === 'Battue en cours') {
                playSound('battue');
            }
        }
      });
      
      previousParticipantsRef.current = participants;

    }, [participants, areParticipantsLoading, user?.uid]);


  useEffect(() => {
    if (myParticipant) {
      if (myParticipant.location && userLocation &&
          (Math.abs(myParticipant.location.latitude - userLocation.latitude) > 0.000001 ||
           Math.abs(myParticipant.location.longitude - userLocation.longitude) > 0.000001)) {
        setUserLocation(myParticipant.location);
      } else if (myParticipant.location && !userLocation) {
        setUserLocation(myParticipant.location)
      }
      
      setBaseStatus(myParticipant.baseStatus);
      setIsGibierEnVue(!!myParticipant.isGibierEnVue);
    }
  }, [myParticipant, userLocation]);

  useEffect(() => {
    if (isParticipating && session && !updateIntervalRef.current) {
        updateIntervalRef.current = setInterval(() => {
            if (navigator.geolocation) {
                fetchAndSetUserPosition();
            }
        }, 30000); // 30 seconds
    } else if (!isParticipating || !session) {
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }
    }
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isParticipating, session, fetchAndSetUserPosition]);

  useEffect(() => {
    if (map && initialCenter && !initialZoomDone && initialCenter.lat && initialCenter.lng) {
        map.panTo(initialCenter);
        map.setZoom(16);
        setInitialZoomDone(true);
        setInitialCenter(null);
    }
  }, [map, initialCenter, initialZoomDone]);

  useEffect(() => {
    if (map && userLocation && !initialZoomDone && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
      map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
      map.setZoom(16);
      setInitialZoomDone(true);
    }
  }, [map, userLocation, initialZoomDone]);

  const generateUniqueCode = async (): Promise<string> => {
    if (!firestore) throw new Error("Firestore not initialized");
    const chars = '0123456789';
    let code: string;
    let attempts = 0;
    while (attempts < 10) {
      code = 'CH-';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const sessionDocRef = doc(firestore, 'hunting_sessions', code);
      const docSnap = await getDoc(sessionDocRef);

      if (!docSnap.exists()) {
        return code;
      }
      attempts++;
    }
    throw new Error('Impossible de générer un code unique.');
  };
  
  const createParticipantDocument = useCallback(async (sessionId: string) => {
    if (!user || !firestore) throw new Error("User or Firestore not available");

    const participantDocRef = doc(firestore, 'hunting_sessions', sessionId, 'participants', user.uid);
    const participantData: Omit<SessionParticipant, 'id' | 'location' | 'battery'> = {
        displayName: nickname,
        mapIcon: selectedIcon,
        mapColor: selectedColor,
        updatedAt: serverTimestamp(),
    };
    
    await setDoc(participantDocRef, participantData, { merge: true }).catch(e => {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: participantDocRef.path,
                operation: 'create',
                requestResourceData: participantData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error("Error creating participant document:", e);
        }
    });

    // Initial user gesture triggers first location fetch
    await fetchAndSetUserPosition(true);
}, [user, firestore, fetchAndSetUserPosition, nickname, selectedIcon, selectedColor]);

  const handleCreateSession = async () => {
    if (!user || !firestore) return;
    setIsSessionLoading(true);
    setError(null);

    try {
        const code = await generateUniqueCode();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const newSessionData: Omit<HuntingSession, 'id'> = {
          organizerId: user.uid,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresAt),
        };
        
        await setDoc(doc(firestore, 'hunting_sessions', code), newSessionData);
        await createParticipantDocument(code);

        setSession({ id: code, ...newSessionData });
        setIsParticipating(true);
        
        toast({
            title: 'Session créée !',
            description: `Le code de votre session est : ${code}`,
        });
    } catch (e: any) {
        setError(e.message);
        toast({
            variant: 'destructive',
            title: 'Erreur de création',
            description: e.message,
        });
    } finally {
        setIsSessionLoading(false);
    }
  };
  
  const handleJoinSession = async () => {
    if (!user || !firestore || !joinCode) return;
    setIsSessionLoading(true);
    setError(null);
    try {
      const sessionId = joinCode.toUpperCase();
      const sessionDocRef = doc(firestore, 'hunting_sessions', sessionId);
      const sessionDoc = await getDoc(sessionDocRef);

      if (!sessionDoc.exists()) {
        throw new Error('Aucune session trouvée avec ce code.');
      }
      const sessionData = sessionDoc.data() as HuntingSession;

      if (sessionData.expiresAt && (sessionData.expiresAt as Timestamp).toDate() < new Date()) {
         await deleteDoc(sessionDocRef);
         throw new Error('Cette session a expiré et a été supprimée.');
      }
      
      const organizerId = sessionData.organizerId;
      if (organizerId && organizerId !== user.uid) {
        const organizerDocRef = doc(firestore, 'hunting_sessions', sessionId, 'participants', organizerId);
        try {
          const organizerDoc = await getDoc(organizerDocRef);
          if (organizerDoc.exists()) {
            const organizerData = organizerDoc.data() as SessionParticipant;
            if (organizerData.location) {
              setInitialCenter({ lat: organizerData.location.latitude, lng: organizerData.location.longitude });
            }
          }
        } catch (e) {
          console.error("Could not fetch organizer's location", e);
             if ((e as any).code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `hunting_sessions/${sessionId}/participants/${organizerId}`,
                    operation: 'get',
                }));
            }
        }
      }

      await createParticipantDocument(sessionId);

      setSession({ id: sessionDoc.id, ...sessionData });
      setIsParticipating(true);

    } catch (e: any) {
        if (e.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: `hunting_sessions/${joinCode.toUpperCase()}`,
                operation: 'get',
             });
             errorEmitter.emit('permission-error', permissionError);
        } else {
             setError(e.message);
             toast({
                variant: 'destructive',
                title: 'Erreur',
                description: e.message,
             });
        }
    } finally {
        setIsSessionLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user || !firestore || !nickname) {
        toast({ variant: 'destructive', title: 'Surnom requis', description: 'Veuillez entrer un surnom.' });
        return;
    }
    setIsSavingPrefs(true);
    const userDocRef = doc(firestore, 'users', user.uid);
    const newPreferences = {
        displayName: nickname,
        mapIcon: selectedIcon,
        mapColor: selectedColor,
    };
    try {
        await updateDoc(userDocRef, newPreferences);

        if (session && isParticipating) {
            const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
            await updateDoc(participantDocRef, newPreferences);
        }

        toast({ title: 'Préférences sauvegardées !' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder les préférences.' });
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: newPreferences
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    } finally {
        setIsSavingPrefs(false);
    }
  };

  const updateStatusInFirestore = async (updateData: { [key: string]: any }) => {
    if (!user || !firestore || !session) return;
    const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
    try {
        await updateDoc(participantDocRef, updateData);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le statut.' });
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: participantDocRef.path,
                operation: 'update',
                requestResourceData: updateData
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            console.error(e);
        }
    }
  };

  const triggerFlash = (text: string, color: string) => {
    if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
    }
    setFlashingStatus({ text, color });
    flashTimeoutRef.current = setTimeout(() => {
        setFlashingStatus(null);
        flashTimeoutRef.current = null;
    }, 2000);
  };
  
  const handleBaseStatusChange = (status: NonNullable<SessionParticipant['baseStatus']>) => {
    const isTogglingOff = baseStatus === status;
    const newBaseStatus = isTogglingOff ? undefined : status;
    setBaseStatus(newBaseStatus);
  
    const updatePayload = {
      baseStatus: newBaseStatus || deleteField()
    };
    
    updateStatusInFirestore(updatePayload);
  
    if(newBaseStatus) {
        triggerFlash(newBaseStatus, newBaseStatus === 'En position' ? 'text-green-500' : 'text-blue-500');
    }
  };
  
  const handleGibierEnVueToggle = () => {
    const newGibierStatus = !isGibierEnVue;
    setIsGibierEnVue(newGibierStatus);
    updateStatusInFirestore({ isGibierEnVue: newGibierStatus });
     if(newGibierStatus) {
        triggerFlash('Gibier en vue', 'text-red-500');
    }
  };


  const getStatusDisplay = (p: SessionParticipant) => {
    const parts = [];
    if (p.baseStatus) parts.push(p.baseStatus);
    if (p.isGibierEnVue) parts.push('Gibier en vue');
    
    let colorClass = '';
    if (p.isGibierEnVue) {
      colorClass = 'text-red-500';
    } else if (p.baseStatus === 'En position') {
      colorClass = 'text-green-400';
    } else if (p.baseStatus === 'Battue en cours') {
      colorClass = 'text-blue-400';
    }

    return {
      text: parts.join(', '),
      colorClass: colorClass,
    };
  };

  const copyToClipboard = () => {
    if(!session) return;
    navigator.clipboard.writeText(session.id);
    toast({ description: "Code copié dans le presse-papiers !" });
  }

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    setMap(mapInstance);
  }, []);


  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const handleMapIdle = useCallback(() => {
    if (map) {
      const newZoom = map.getZoom();
      if (newZoom) {
        setZoom(newZoom);
      }
    }
  }, [map]);

  const handleMapTypeIdChanged = useCallback(() => {
    if (map) {
        const newMapTypeId = map.getMapTypeId();
        if (newMapTypeId) {
            setMapTypeId(newMapTypeId);
            localStorage.setItem('huntingMapTypeId', newMapTypeId);
        }
    }
  }, [map]);

  const handleRecenter = () => {
    if (!navigator.geolocation) {
        toast({
            variant: "destructive",
            title: "Géolocalisation non supportée",
            description: "Votre navigateur ne supporte pas la géolocalisation.",
        });
        return;
    }

    toast({ description: "Mise à jour de votre position..." });

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
            const newLocation = { lat: latitude, lng: longitude };
            
            setUserLocation({latitude, longitude});
            updateFirestorePosition(latitude, longitude);

            if (map) {
                map.panTo(newLocation);
                if(map.getZoom()! < 14) {
                    map.setZoom(16);
                }
            }
        },
        (err) => {
            console.error("Error getting geolocation for recenter:", err);
            let description = "Impossible d'obtenir votre position actuelle.";
            if (err.code === 1) {
              description = "Veuillez activer la géolocalisation dans les paramètres de votre navigateur.";
            }
            toast({
                variant: "destructive",
                title: "Erreur de localisation",
                description: description,
            });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const createMarkerIcon = (color: string, iconName: string) => {
    const iconSvgPath = iconSvgs[iconName] || iconSvgs['Navigation'];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="2"/>
      <g transform="translate(8, 8) scale(1)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${iconSvgPath}
      </g>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  if (session) {
     if (loadError) {
        return (
             <Card>
                <CardHeader>
                     <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="size-5 text-primary" />
                            Session de Chasse
                        </div>
                        <Button onClick={handleLeaveSession} variant="destructive" size="sm" disabled={isSessionLoading}><LogOut/> Quitter</Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Erreur de clé API Google Maps</AlertTitle>
                        <AlertDescription>
                           La clé API semble invalide ou mal configurée.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!isLoaded || isProfileLoading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="size-5 text-primary" />
                            Session de Chasse
                        </div>
                        <Button onClick={handleLeaveSession} variant="destructive" size="sm" disabled={isSessionLoading}><LogOut/> Quitter</Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-80 w-full" />
                    <div className="mt-4">
                        <Skeleton className="h-8 w-1/2 mb-2" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn("transition-all", isFullscreen && "fixed inset-0 z-50 w-screen h-screen rounded-none border-none flex flex-col")}>
            <CardHeader className={cn(isFullscreen && "flex-shrink-0")}>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="size-5 text-primary" />
                        Session de Chasse
                    </div>
                    <Button onClick={handleLeaveSession} variant="destructive" size="sm" disabled={isSessionLoading}><LogOut/> Quitter</Button>
                </CardTitle>
                 <CardDescription>Partagez votre position avec votre groupe en temps réel.</CardDescription>
            </CardHeader>
            <CardContent className={cn("flex-grow flex flex-col", isFullscreen ? "p-2 gap-2" : "p-6 pt-0")}>
                 <div className={cn("relative w-full rounded-lg overflow-hidden border", isFullscreen ? "flex-grow" : "h-80 mb-4")}>
                    <GoogleMap
                        mapContainerClassName="w-full h-full"
                        center={(userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: -21.45, lng: 165.5 }}
                        zoom={initialZoomDone ? zoom : 8}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        onIdle={handleMapIdle}
                        onMapTypeIdChanged={handleMapTypeIdChanged}
                        options={{ 
                            disableDefaultUI: true, 
                            zoomControl: true, 
                            mapTypeControl: true,
                            mapTypeId: mapTypeId as google.maps.MapTypeId
                        }}
                    >
                        {flashingStatus && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <h2 className={cn('status-flash-animation text-4xl md:text-6xl font-bold [text-shadow:0_2px_4px_rgb(0_0_0_/_50%)]', flashingStatus.color)}>
                                {flashingStatus.text}
                                </h2>
                            </div>
                        )}
                        {myParticipant && userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number' && (
                          <Fragment>
                            <MarkerF
                              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
                              draggable={true}
                              onDragEnd={handleDragEnd}
                              icon={{
                                url: createMarkerIcon(myParticipant.mapColor || '#3b82f6', myParticipant.mapIcon || 'Navigation'),
                                scaledSize: new window.google.maps.Size(40, 40),
                                anchor: new window.google.maps.Point(20, 20),
                              }}
                              zIndex={99}
                            />
                             <OverlayView
                                position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div style={{ transform: 'translate(-50%, -150%)' }} className="flex flex-col items-center">
                                  <div className="flex items-baseline gap-2 px-2 py-0.5 text-xs font-bold text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_70%)] whitespace-nowrap">
                                      <span>{myParticipant.displayName}</span>
                                       {(() => {
                                        const statusDisplay = getStatusDisplay(myParticipant);
                                        return statusDisplay.text && (
                                            <span className={cn('font-semibold', statusDisplay.colorClass)}>
                                                ({statusDisplay.text})
                                            </span>
                                        );
                                       })()}
                                  </div>
                                </div>
                            </OverlayView>
                          </Fragment>
                        )}

                        {otherParticipants?.map(p => {
                            if (!p.location || typeof p.location.latitude !== 'number' || typeof p.location.longitude !== 'number') return null;
                             return (
                                <OverlayView
                                    key={p.id}
                                    position={{ lat: p.location.latitude, lng: p.location.longitude }}
                                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                >
                                    <div style={{ transform: 'translate(-50%, -150%)' }} className="flex flex-col items-center">
                                        <div className="px-2 pb-0.5 text-xs font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.7)] whitespace-nowrap">
                                            <span className="mr-1">{p.displayName}</span>
                                            {(() => {
                                              const statusDisplay = getStatusDisplay(p);
                                              return statusDisplay.text && (
                                                  <span className={cn('font-semibold', statusDisplay.colorClass)}>
                                                      ({statusDisplay.text})
                                                  </span>
                                              );
                                            })()}
                                        </div>
                                        <div
                                            className="p-1.5 rounded-full flex items-center justify-center shadow-lg"
                                            style={{ backgroundColor: p.mapColor || '#3b82f6' }}
                                        >
                                            <UserIcon
                                                className="size-5 drop-shadow-md text-white"
                                            />
                                        </div>
                                    </div>
                                </OverlayView>
                            )
                        })}
                    </GoogleMap>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                        <Button
                            onClick={() => handleBaseStatusChange('En position')}
                            className={cn(
                                'shadow-lg text-white bg-green-600 hover:bg-green-700',
                                baseStatus === 'En position' && 'ring-2 ring-offset-2 ring-green-500'
                            )}
                        >
                            <MapPin className="mr-2 h-4 w-4" /> En position
                        </Button>
                        <Button
                            onClick={() => handleBaseStatusChange('Battue en cours')}
                            className={cn(
                                'shadow-lg text-white bg-blue-600 hover:bg-blue-700',
                                baseStatus === 'Battue en cours' && 'ring-2 ring-offset-2 ring-blue-500'
                            )}
                        >
                            <Footprints className="mr-2 h-4 w-4" /> Battue en cours
                        </Button>
                        <Button
                            onClick={handleGibierEnVueToggle}
                            className={cn(
                                'shadow-lg text-white bg-red-600 hover:bg-red-700',
                                isGibierEnVue && 'ring-2 ring-offset-2 ring-red-500'
                            )}
                        >
                            <Eye className="mr-2 h-4 w-4" /> Gibier en vue
                        </Button>
                    </div>
                    <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-2 left-2 shadow-lg h-9 w-9 z-10">
                        {isFullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
                    </Button>
                    <Button size="icon" onClick={handleRecenter} className="absolute top-2 right-2 shadow-lg h-9 w-9">
                        <LocateFixed className="h-5 w-5" />
                    </Button>
                    <div className="absolute bottom-2 right-2 bg-card/80 p-1 px-2 rounded-md text-xs font-semibold shadow-lg border">
                      {map?.getZoom() ? `${Math.round((map.getZoom()! / 22) * 100)}%` : '...'}
                    </div>
                </div>
                <div className={cn("space-y-4", isFullscreen ? "flex-shrink-0 overflow-y-auto" : "")}>
                    {!isFullscreen && (
                        <>
                            <div className="space-y-4 rounded-lg border p-4">
                                <h4 className="font-semibold text-sm">Personnalisation</h4>
                                <div className="space-y-1">
                                    <Label htmlFor="nickname">Surnom</Label>
                                    <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Icône</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {availableIcons.map(iconName => {
                                                const Icon = iconMap[iconName as keyof typeof iconMap];
                                                return (
                                                    <Button key={iconName} variant="outline" size="icon" onClick={() => setSelectedIcon(iconName)} className={cn(selectedIcon === iconName && "ring-2 ring-primary")}>
                                                        <Icon className="size-5" />
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Couleur</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {availableColors.map(color => (
                                                <button key={color} onClick={() => setSelectedColor(color)} className={cn("w-8 h-8 rounded-full border-2", selectedColor === color ? "border-primary ring-2 ring-primary" : "border-transparent")} style={{ backgroundColor: color }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={handleSavePreferences} size="sm" disabled={isSavingPrefs} className="w-full">
                                    <Save className="mr-2" /> 
                                    {isSavingPrefs ? 'Sauvegarde...' : 'Sauvegarder mes préférences'}
                                </Button>
                            </div>
                            <Alert>
                                <Download className="h-4 w-4" />
                                <AlertTitle>Mode Hors Ligne</AlertTitle>
                                <AlertDescription>
                                La carte peut être utilisée hors ligne. Pour mettre une zone en cache, naviguez simplement sur la carte lorsque vous êtes connecté. Les tuiles seront automatiquement sauvegardées. Les positions se synchroniseront au retour du réseau.
                                </AlertDescription>
                            </Alert>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="space-y-1 flex-grow">
                                    <Label htmlFor="session-code-display">Code de session</Label>
                                    <Input id="session-code-display" readOnly value={session.id} className="font-mono text-center text-lg tracking-widest" />
                                </div>
                                <Button onClick={copyToClipboard} size="sm" className="w-full sm:w-auto self-end"><Copy className="mr-2"/> Copier</Button>
                            </div>
                        </>
                    )}
                    <div className="space-y-2">
                        <h4 className="font-semibold">Participants ({participants?.length || 0})</h4>
                        {areParticipantsLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : (
                            <div className={cn("space-y-2 pr-2", !isFullscreen && "max-h-48 overflow-y-auto")}>
                            {participants?.map(p => {
                                const statusDisplay = getStatusDisplay(p);
                                return (
                                <div key={p.id} className="flex items-center justify-between p-2 border rounded-lg bg-card">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-1.5 rounded-full flex items-center justify-center shadow-sm"
                                            style={{ backgroundColor: p.mapColor || '#3b82f6' }}
                                        >
                                            <UserIcon className="size-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{p.displayName}</p>
                                            {statusDisplay.text ? (
                                                <p className={cn("text-xs font-semibold", statusDisplay.colorClass)}>
                                                    {statusDisplay.text}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">En attente...</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        {p.battery && (
                                            <>
                                                <BatteryIcon level={p.battery.level} charging={p.battery.charging} />
                                                <span>{Math.round(p.battery.level * 100)}%</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )})}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          Session de Chasse en Groupe
        </CardTitle>
        <CardDescription>
          Partagez votre position en temps réel avec vos coéquipiers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
        <Tabs defaultValue="join">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="join">Rejoindre</TabsTrigger>
            <TabsTrigger value="create">Créer</TabsTrigger>
          </TabsList>
          <TabsContent value="join" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="join-code">Code de la session</Label>
              <Input
                id="join-code"
                placeholder="CH-XXXX"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="font-mono text-center text-lg tracking-widest"
              />
            </div>
            <Button onClick={handleJoinSession} className="w-full" disabled={isSessionLoading}>
              <LogIn className="mr-2" />
              {isSessionLoading ? 'Connexion...' : 'Rejoindre la session'}
            </Button>
          </TabsContent>
          <TabsContent value="create" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Créez une nouvelle session et partagez le code avec votre groupe. La
              session expirera automatiquement dans 24 heures.
            </p>
            <Button onClick={handleCreateSession} className="w-full" disabled={isSessionLoading}>
              <Share2 className="mr-2" />
              {isSessionLoading ? 'Création...' : 'Créer une nouvelle session'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function HuntingSessionCard() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Session de Chasse en Groupe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fonctionnalité réservée</AlertTitle>
            <AlertDescription>
              Vous devez être connecté pour créer ou rejoindre une session de chasse.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return <HuntingSessionContent />;
}

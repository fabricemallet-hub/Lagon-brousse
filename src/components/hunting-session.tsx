'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
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
} from 'firebase/firestore';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';


// --- Helper Components ---

const BatteryIcon = ({ level, charging }: { level: number; charging: boolean }) => {
  const props = { className: 'w-4 h-4 inline-block' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level > 0.5) return <BatteryFull {...props} className="text-green-500" />;
  if (level > 0.2) return <BatteryMedium {...props} className="text-orange-500" />;
  return <BatteryLow {...props} className="text-red-500" />;
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
  
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  const { isLoaded, loadError } = useJsApiLoader({
      googleMapsApiKey: googleMapsApiKey || "",
      preventGoogleFontsLoading: true,
  });

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

 const handleUpdatePosition = useCallback(async (currentSessionId: string, isFirstUpdate = false) => {
    if (!user || !firestore || !navigator.geolocation) return;

    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            });
        });
        
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });

        let batteryData: SessionParticipant['battery'] | undefined = undefined;
        if ('getBattery' in navigator) {
            try {
                const battery = await (navigator as any).getBattery();
                batteryData = { level: battery.level, charging: battery.charging };
            } catch (batteryError) {
                console.warn("Could not retrieve battery status:", batteryError);
            }
        }
        
        const participantDocRef = doc(firestore, 'hunting_sessions', currentSessionId, 'participants', user.uid);
        
        // Non-blocking update
        updateDoc(participantDocRef, {
            location: { latitude, longitude },
            battery: batteryData,
            updatedAt: serverTimestamp(),
        }).catch(err => {
            console.error("Error updating position:", err);
             if (err.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: participantDocRef.path,
                    operation: 'update',
                    requestResourceData: { location: { latitude, longitude } }
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
  }, [user, firestore, toast]);
  
  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants, isLoading: areParticipantsLoading } = useCollection<SessionParticipant>(participantsCollectionRef);

  useEffect(() => {
    // This effect now only sets up the recurring interval.
    // The initial position update is a one-off action triggered
    // by the user gesture of creating or joining a session.
    if (isParticipating && session) {
      updateIntervalRef.current = setInterval(() => handleUpdatePosition(session.id), 30000); // 30 seconds
    } else if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isParticipating, session, handleUpdatePosition]);

  useEffect(() => {
    if (map && userLocation && !initialZoomDone) {
      map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
      map.setZoom(16); // Zoom level that approximates 73%
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
        displayName: user.displayName || user.email || 'Chasseur',
        updatedAt: serverTimestamp(),
    };
    
    // Using setDoc with merge to avoid overwriting if doc somehow exists
    await setDoc(participantDocRef, participantData, { merge: true });
    
    // Explicitly trigger the first position update as a user gesture.
    await handleUpdatePosition(sessionId, true);
}, [user, firestore, handleUpdatePosition]);

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
        
        const sessionDocRef = doc(firestore, 'hunting_sessions', code);
        
        // Use a batch to ensure session and participant are created together
        const batch = writeBatch(firestore);
        batch.set(sessionDocRef, newSessionData);
        
        const participantDocRef = doc(firestore, 'hunting_sessions', code, 'participants', user.uid);
        const participantData: Omit<SessionParticipant, 'id' | 'location' | 'battery'> = {
            displayName: user.displayName || user.email || 'Chasseur',
            updatedAt: serverTimestamp(),
        };
        batch.set(participantDocRef, participantData);
        
        await batch.commit();
        
        // This will now be called after the user clicks "Create"
        await handleUpdatePosition(code, true);

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

  const handleRecenter = () => {
    if (map && userLocation) {
        map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
        map.setZoom(16);
    } else {
        toast({
            variant: "destructive",
            title: "Localisation introuvable",
            description: "Impossible de vous recentrer sans votre position.",
        })
    }
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
                           La clé API semble invalide ou mal configurée. Veuillez suivre les instructions dans la console Google Cloud pour la corriger.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!isLoaded) {
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
                    <Skeleton className="h-20 w-full mt-4" />
                </CardContent>
            </Card>
        )
    }

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
                 <CardDescription>Partagez votre position avec votre groupe en temps réel.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="relative h-80 w-full mb-4 rounded-lg overflow-hidden border">
                    <GoogleMap
                        mapContainerClassName="w-full h-full"
                        center={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: -21.45, lng: 165.5 }}
                        zoom={initialZoomDone ? zoom : 8}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        onIdle={handleMapIdle}
                        options={{ 
                            disableDefaultUI: true, 
                            zoomControl: true, 
                            mapTypeControl: true,
                            mapTypeId: 'terrain'
                        }}
                    >
                        {participants?.map(p => {
                            if (!p.location) return null;
                            const isCurrentUser = p.id === user.uid;
                            return (
                                <OverlayView
                                    key={p.id}
                                    position={{ lat: p.location.latitude, lng: p.location.longitude }}
                                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-full flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2",
                                        isCurrentUser ? "bg-primary/80" : "bg-card/80 border"
                                    )}>
                                        <Navigation className={cn(
                                            "size-5 drop-shadow-md",
                                            isCurrentUser ? "text-primary-foreground" : "text-card-foreground"
                                        )} />
                                    </div>
                                </OverlayView>
                            )
                        })}
                    </GoogleMap>
                    <Button size="icon" onClick={handleRecenter} className="absolute top-2 right-2 shadow-lg h-9 w-9">
                        <LocateFixed className="h-5 w-5" />
                    </Button>
                    <div className="absolute bottom-2 right-2 bg-card/80 p-1 px-2 rounded-md text-xs font-semibold shadow-lg border">
                      {Math.round((zoom / 22) * 100)}%
                    </div>
                </div>
                <div className="space-y-4">
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
                    <div className="space-y-2">
                        <h4 className="font-semibold">Participants ({participants?.length || 0})</h4>
                        {areParticipantsLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : (
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                            {participants?.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 border rounded-lg">
                                    <p className="font-medium text-sm">{p.displayName}</p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {p.battery && (
                                            <div className="flex items-center gap-1">
                                                <BatteryIcon level={p.battery.level} charging={p.battery.charging} />
                                                <span>{Math.round(p.battery.level * 100)}%</span>
                                            </div>
                                        )}
                                        {p.location && <span className="font-mono">{p.location.latitude.toFixed(3)}, {p.location.longitude.toFixed(3)}</span>}
                                    </div>
                                </div>
                            ))}
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

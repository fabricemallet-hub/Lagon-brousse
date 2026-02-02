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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Share2,
  LogIn,
  LogOut,
  Copy,
  Users,
  ChevronUp,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryCharging,
  LocateFixed,
  AlertCircle,
  Navigation,
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


// --- Main Component ---

export function HuntingSessionCard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [session, setSession] = useState<WithId<HuntingSession> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number} | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });
  
  const handleLeaveSession = useCallback(async () => {
     if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
     if (!user || !session || !firestore) {
         setSession(null);
         setIsParticipating(false);
         return;
     };
     setIsLoading(true);

     try {
       const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
       await deleteDoc(participantDocRef);
       
     } catch (e: any) {
        if (e.name === 'FirebaseError' || e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `hunting_sessions/${session.id}/participants/${user.uid}`,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            setError(e.message);
        }
     } finally {
        setSession(null);
        setIsParticipating(false);
        setUserLocation(null);
        setIsLoading(false);
        toast({ title: 'Vous avez quitté la session.' });
     }
  }, [user, session, firestore, toast]);

  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants, isLoading: areParticipantsLoading } = useCollection<SessionParticipant>(participantsCollectionRef);
  
  useEffect(() => {
    if (!session || !user || !firestore) {
        return;
    }

    let isCancelled = false;

    const performPeriodicUpdate = async () => {
        if (isCancelled || !session) return;

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                });
            });
            if (isCancelled) return;
            
            const { latitude, longitude } = position.coords;
            setUserLocation({ latitude, longitude });

            let batteryData: SessionParticipant['battery'] | undefined = undefined;
            if ('getBattery' in navigator) {
                const battery = await (navigator as any).getBattery();
                if (isCancelled) return;
                batteryData = { level: battery.level, charging: battery.charging };
            }

            const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
            const participantData: Partial<SessionParticipant> = {
                location: { latitude, longitude },
                battery: batteryData,
                updatedAt: serverTimestamp(),
            };

            await updateDoc(participantDocRef, participantData)

        } catch (err: any) {
            console.error("Error during periodic position update:", err);
        }
    };
  
    const joinAndSubscribe = async () => {
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        });
        if (isCancelled) return;
        
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });

        let batteryData: SessionParticipant['battery'] | undefined = undefined;
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          if (isCancelled) return;
          batteryData = { level: battery.level, charging: battery.charging };
        }

        const initialParticipantData: SessionParticipant = {
          id: user.uid,
          displayName: user.displayName || 'Chasseur Anonyme',
          location: { latitude, longitude },
          battery: batteryData,
          updatedAt: serverTimestamp(),
        };
        
        const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
        await setDoc(participantDocRef, initialParticipantData);
        
        if (!isCancelled) {
          setIsParticipating(true);
          performPeriodicUpdate(); // Initial update
          if (!updateIntervalRef.current) {
            updateIntervalRef.current = setInterval(performPeriodicUpdate, 30000);
          }
        }

      } catch (err: any) {
        if (isCancelled) return;
        console.error("Error joining session:", err);
        if (err.code === 1) {
          setError("La géolocalisation est requise. Veuillez l'activer pour rejoindre une session.");
        } else {
          setError("Une erreur est survenue en rejoignant la session.");
        }
        handleLeaveSession();
      }
    };
  
    joinAndSubscribe();
  
    return () => {
      isCancelled = true;
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [session, user, firestore, handleLeaveSession]);

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

  const handleCreateSession = () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    setError(null);

    const create = async () => {
        const code = await generateUniqueCode();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const docData: Omit<HuntingSession, 'id'> = {
          organizerId: user.uid,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresAt),
        };
        const sessionDocRef = doc(firestore, 'hunting_sessions', code);
        
        await setDoc(sessionDocRef, docData);

        setSession({ id: code, ...docData });
        
        toast({
            title: 'Session créée !',
            description: `Le code de votre session est : ${code}`,
        });
        setIsLoading(false);

    }

    create().catch(e => {
        setError(e.message);
        toast({
            variant: 'destructive',
            title: 'Erreur de création',
            description: e.message,
        });
        setIsLoading(false);
    });
  };
  
  const handleJoinSession = async () => {
    if (!user || !firestore || !joinCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const sessionDocRef = doc(firestore, 'hunting_sessions', joinCode.toUpperCase());
      const sessionDoc = await getDoc(sessionDocRef);

      if (!sessionDoc.exists()) {
        throw new Error('Aucune session trouvée avec ce code.');
      }
      const sessionData = sessionDoc.data() as HuntingSession;

      if (sessionData.expiresAt && (sessionData.expiresAt as Timestamp).toDate() < new Date()) {
         throw new Error('Cette session a expiré.');
      }
      
      setSession({ id: sessionDoc.id, ...sessionData });

    } catch (e: any) {
        if (e.name === 'FirebaseError' || e.code === 'permission-denied') {
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
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if(!session) return;
    navigator.clipboard.writeText(session.id);
    toast({ description: "Code copié dans le presse-papiers !" });
  }

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    if (userLocation) {
        const center = new window.google.maps.LatLng(userLocation.latitude, userLocation.longitude);
        mapInstance.setCenter(center);
        mapInstance.setZoom(13); // Zoom for ~10km radius
    } else {
        const ncBounds = new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(-22.8, 163.5),
            new window.google.maps.LatLng(-19.6, 168.1)
        );
        mapInstance.fitBounds(ncBounds);
    }
    setMap(mapInstance);
  }, [userLocation]);


  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const handleRecenter = () => {
    if (map && userLocation) {
        map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
        map.setZoom(13);
    } else {
        toast({
            variant: "destructive",
            title: "Localisation introuvable",
            description: "Impossible de vous recentrer sans votre position.",
        })
    }
  };

  if (isUserLoading) {
    return <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
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
    )
  }

  if (session) {
    if (loadError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription>La carte n'a pas pu être chargée. Vérifiez votre clé API Google Maps et sa configuration.</AlertDescription>
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Session de Chasse Active
            </div>
            <Button onClick={handleLeaveSession} variant="destructive" size="sm" disabled={isLoading}><LogOut/> Quitter</Button>
          </CardTitle>
           <CardDescription>Partagez votre position avec votre groupe en temps réel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
                <div className="space-y-1">
                    <Label>Code de la session</Label>
                    <p className="text-2xl font-bold font-mono tracking-widest">{session.id}</p>
                </div>
                <Button onClick={copyToClipboard} variant="outline" size="icon"><Copy /></Button>
            </div>
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}

            {!isLoaded ? (
              <Skeleton className="w-full aspect-square rounded-lg" />
            ) : (
              <div className="relative w-full aspect-square rounded-lg overflow-hidden border">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: -21.5, lng: 165.5 }}
                  zoom={userLocation ? 13 : 7}
                  onLoad={onLoad}
                  onUnmount={onUnmount}
                  options={{
                    mapTypeId: 'satellite',
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {isParticipating && participants?.map(p => {
                    if (!p.location?.latitude || !p.location?.longitude) return null;
                    
                    return (
                      <OverlayView
                        key={p.id}
                        position={{ lat: p.location.latitude, lng: p.location.longitude }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      >
                        <div className="absolute flex flex-col items-center" style={{transform: 'translate(-50%, -100%)'}}>
                          <div className="bg-black/60 text-white rounded-md px-2 py-0.5 text-xs whitespace-nowrap backdrop-blur-sm">
                            <p className="font-bold text-center">{p.displayName}</p>
                            {p.battery && (
                              <div className="flex items-center justify-center gap-1">
                                <BatteryIcon level={p.battery.level} charging={p.battery.charging} />
                                <span className="font-mono">{Math.round(p.battery.level * 100)}%</span>
                              </div>
                            )}
                          </div>
                          <div className={cn("w-3 h-3 rounded-full mt-1 border-2 border-white", p.id === user?.uid ? "bg-accent" : "bg-primary")}></div>
                        </div>
                      </OverlayView>
                    )
                  })}
                </GoogleMap>
                 <Button onClick={handleRecenter} variant="secondary" size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 shadow-lg">
                    <Navigation className="mr-2"/>
                    Recentrer sur moi
                </Button>
            </div>
            )}
            
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <Users className="mr-2"/>
                        {isParticipating ? (participants?.length ?? 1) : 0} Participant(s)
                        <ChevronUp className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto p-1">
                        {areParticipantsLoading && <Skeleton className="h-10 w-full" />}
                        {isParticipating && participants?.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border">
                                <span className="font-semibold">{p.displayName}</span>
                                {p.battery && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <BatteryIcon level={p.battery.level} charging={p.battery.charging} />
                                        <span>{Math.round(p.battery.level * 100)}%</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>
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
            <Button onClick={handleJoinSession} className="w-full" disabled={isLoading}>
              <LogIn className="mr-2" />
              {isLoading ? 'Connexion...' : 'Rejoindre la session'}
            </Button>
          </TabsContent>
          <TabsContent value="create" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Créez une nouvelle session et partagez le code avec votre groupe. La
              session expirera automatiquement dans 24 heures.
            </p>
            <Button onClick={handleCreateSession} className="w-full" disabled={isLoading}>
              <Share2 className="mr-2" />
              {isLoading ? 'Création...' : 'Créer une nouvelle session'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

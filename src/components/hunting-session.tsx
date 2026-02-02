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
  
  const googleMapsApiKey = "AIzaSyDCkKWAl86pviQm3jdH07CqQkJeqHL62JM";
  const { isLoaded, loadError } = useJsApiLoader({
      googleMapsApiKey: googleMapsApiKey,
      preventGoogleFontsLoading: true,
  });

  const handleLeaveSession = useCallback(async () => {
    if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
    }
    
    // Immediately update UI state
    const previousSessionId = session?.id;
    setSession(null);
    setIsParticipating(false);
    setUserLocation(null);

    if (!user || !previousSessionId || !firestore) {
        return;
    }

    setIsLoading(true);
    try {
        const participantDocRef = doc(firestore, 'hunting_sessions', previousSessionId, 'participants', user.uid);
        await deleteDoc(participantDocRef);
        toast({ title: 'Vous avez quitté la session.' });
    } catch (e: any) {
        // Error handling for deletion
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
        setIsLoading(false);
    }
}, [user, session, firestore, toast]);

  const handleUpdatePosition = useCallback(async (currentSession: WithId<HuntingSession>) => {
    if (!user || !firestore) return;

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
            const battery = await (navigator as any).getBattery();
            batteryData = { level: battery.level, charging: battery.charging };
        }

        const participantDocRef = doc(firestore, 'hunting_sessions', currentSession.id, 'participants', user.uid);
        
        await updateDoc(participantDocRef, {
            location: { latitude, longitude },
            battery: batteryData,
            updatedAt: serverTimestamp(),
        });

    } catch (err: any) {
        console.error("Error during periodic position update:", err);
        if (err.code === 1) { // User denied Geolocation
          toast({
            variant: "destructive",
            title: "Géolocalisation refusée",
            description: "La géolocalisation est requise. Déconnexion de la session.",
          });
          handleLeaveSession();
        }
    }
  }, [user, firestore, handleLeaveSession, toast]);
  
  const setupAndStartUpdates = useCallback((sessionToUpdate: WithId<HuntingSession>) => {
    handleUpdatePosition(sessionToUpdate); // Initial update
    const intervalId = setInterval(() => handleUpdatePosition(sessionToUpdate), 30000);
    updateIntervalRef.current = intervalId;
    
    return () => {
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }
    };
}, [handleUpdatePosition]);

  useEffect(() => {
    if (isParticipating && session) {
      const cleanup = setupAndStartUpdates(session);
      return cleanup;
    }
  }, [isParticipating, session, setupAndStartUpdates]);

  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants, isLoading: areParticipantsLoading } = useCollection<SessionParticipant>(participantsCollectionRef);

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
    await setDoc(participantDocRef, participantData);
}, [user, firestore]);

  const handleCreateSession = async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
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
        
        // Wait for participant doc to be created before setting state
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
        setIsLoading(false);
    }
  };
  
  const handleJoinSession = async () => {
    if (!user || !firestore || !joinCode) return;
    setIsLoading(true);
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
         await deleteDoc(sessionDocRef); // Clean up expired session
         throw new Error('Cette session a expiré et a été supprimée.');
      }
      
      // Wait for participant doc to be created
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
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if(!session) return;
    navigator.clipboard.writeText(session.id);
    toast({ description: "Code copié dans le presse-papiers !" });
  }

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    const ncBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(-22.8, 163.5),
        new window.google.maps.LatLng(-19.6, 168.1)
    );
    mapInstance.fitBounds(ncBounds);
    setMap(mapInstance);
  }, []);


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
    if (!isLoaded) {
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
          <CardContent>
            <Skeleton className="w-full aspect-square rounded-lg" />
            <p className="text-sm text-center text-muted-foreground mt-2">Chargement de la carte...</p>
          </CardContent>
        </Card>
      )
    }

    if (loadError) {
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
            <CardContent>
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur : Impossible de charger la carte</AlertTitle>
                    <AlertDescription className="space-y-2">
                        <p>L'erreur `InvalidKeyMapError` signifie que votre clé API n'est pas acceptée par Google. Veuillez suivre ces étapes :</p>
                        <ol className="list-decimal list-inside text-xs space-y-1">
                            <li>
                                **Vérifiez la clé :** Assurez-vous que la clé API dans votre environnement est correcte.
                            </li>
                            <li>
                                **Vérifiez les restrictions d'API :** Allez sur votre <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">console Google Cloud</a> et vérifiez que votre clé API a bien les restrictions de "Référents HTTP" suivantes :
                                <ul className="list-disc list-inside pl-4 mt-1">
                                    <li><code>*.cloudworkstations.dev/*</code></li>
                                    <li><code>studio.firebase.google.com/*</code></li>
                                </ul>
                                <p className="mt-1">Si le problème persiste, essayez de supprimer temporairement toutes les restrictions pour confirmer que la clé fonctionne.</p>
                            </li>
                            <li>
                                **Activez l'API :** Dans la console Google, assurez-vous que l'API "Maps JavaScript API" est bien activée pour votre projet.
                            </li>
                        </ol>
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
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

            <div className="relative w-full aspect-square rounded-lg overflow-hidden border">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
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
            
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <Users className="mr-2"/>
                        {isParticipating ? (participants?.length ?? 0) : 0} Participant(s)
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
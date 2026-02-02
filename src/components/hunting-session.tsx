'use client';
import { useState, useEffect, useRef } from 'react';
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
} from 'firebase/firestore';
import type { WithId } from '@/firebase';
import type { HuntingSession, SessionParticipant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { User } from 'firebase/auth';

// --- Helper Functions and Components ---

// Constants for the full map view
const NC_LAT_MIN = -22.8; // South
const NC_LAT_MAX = -19.6; // North
const NC_LON_MIN = 163.5; // West
const NC_LON_MAX = 168.1; // East
const NC_LON_RANGE = NC_LON_MAX - NC_LON_MIN;
const NC_LAT_RANGE = NC_LAT_MAX - NC_LAT_MIN;
const SVG_VIEWBOX_SIZE = 200;

// Function to convert Lat/Lon to SVG coordinates of the full map
const convertCoordsToSVG = (lat: number, lon: number) => {
    const x = ((lon - NC_LON_MIN) / NC_LON_RANGE) * SVG_VIEWBOX_SIZE;
    const y = ((NC_LAT_MAX - lat) / NC_LAT_RANGE) * SVG_VIEWBOX_SIZE;
    return { x, y };
};

// Function to calculate a zoomed-in viewBox
const getZoomedViewBox = (centerLat: number, centerLon: number, viewDiameterKm: number = 20) => {
    // Approximate conversion: 1 degree lat ~= 111km, 1 degree lon ~= 111 * cos(lat)
    const degPerKmLat = 1 / 111.1;
    const degPerKmLon = 1 / (111.3 * Math.cos(centerLat * Math.PI / 180));

    const latRadiusDeg = (viewDiameterKm / 2) * degPerKmLat;
    const lonRadiusDeg = (viewDiameterKm / 2) * degPerKmLon;

    // To make the view square in SVG units, we convert radii and take the max
    const vbWidthRadius = (lonRadiusDeg / NC_LON_RANGE) * SVG_VIEWBOX_SIZE;
    const vbHeightRadius = (latRadiusDeg / NC_LAT_RANGE) * SVG_VIEWBOX_SIZE;
    const vbRadius = Math.max(vbWidthRadius, vbHeightRadius);

    const center = convertCoordsToSVG(centerLat, centerLon);

    const vbX = center.x - vbRadius;
    const vbY = center.y - vbRadius;
    const size = vbRadius * 2;

    return `${vbX} ${vbY} ${size} ${size}`;
}


const NewCaledoniaPaths = () => (
    <g>
        <path d="M94.6,23.3C60,80,60,130,90,180c40-40,40-80,10-140C98.6,33.3,96.6,28.3,94.6,23.3z" />
        <path d="M91.6,18.3c-2-1-1-4,1-3C92.6,16.3,92.6,17.3,91.6,18.3z" />
        <path d="M87.6,14.3c-2-1-1-4,1-3C88.6,12.3,88.6,13.3,87.6,14.3z" />
        <path d="M152,70c-12,15,0,30,5,25C162,85,162,75,152,70z" />
        <path d="M165,105c-12,20,0,35,8,30C178,125,175,110,165,105z" />
        <path d="M185,140c-8,15,2,28,8,22C198,155,193,145,185,140z" />
        <path d="M125,170c-10,12,0,25,10,20C140,185,135,175,125,170z" />
    </g>
);


const BatteryIcon = ({ level, charging }: { level: number; charging: boolean }) => {
  const props = { className: 'w-4 h-4' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level > 0.5) return <BatteryFull {...props} className="text-green-500" />;
  if (level > 0.2) return <BatteryMedium {...props} className="text-orange-500" />;
  return <BatteryLow {...props} className="text-red-500" />;
};


const ParticipantMarker = ({ participant, isCurrentUser, centerLat, centerLon, viewDiameterKm }: { participant: WithId<SessionParticipant>, isCurrentUser: boolean, centerLat: number, centerLon: number, viewDiameterKm: number }) => {
  if (!participant.location) return null;
  
  // Approximate conversion to calculate the view boundaries in degrees
  const degPerKmLat = 1 / 111.1;
  const degPerKmLon = 1 / (111.3 * Math.cos(centerLat * Math.PI / 180));
  const latRadiusDeg = (viewDiameterKm / 2) * degPerKmLat;
  const lonRadiusDeg = (viewDiameterKm / 2) * degPerKmLon;
  const viewRadiusDeg = Math.max(latRadiusDeg, lonRadiusDeg);

  // Define the square viewing area in degrees
  const viewLatMin = centerLat - viewRadiusDeg;
  const viewLatMax = centerLat + viewRadiusDeg;
  const viewLonMin = centerLon - viewRadiusDeg;
  const viewLonMax = centerLon + viewRadiusDeg;

  // Calculate the participant's position as a percentage within this view
  const y = ((viewLatMax - participant.location.latitude) / (viewLatMax - viewLatMin)) * 100;
  const x = ((participant.location.longitude - viewLonMin) / (viewLonMax - viewLonMin)) * 100;

  // Don't render the marker if it's outside the current field of view
  if (x < 0 || x > 100 || y < 0 || y > 100) {
    return null;
  }

  return (
    <div
      className="absolute flex flex-col items-center transition-all duration-1000 ease-linear"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className={cn("bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-center shadow", isCurrentUser && "ring-2 ring-primary")}>
        <p className="text-xs font-bold truncate max-w-[100px]">
          {isCurrentUser ? "Vous" : participant.displayName}
        </p>
        {participant.battery && (
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <BatteryIcon
              level={participant.battery.level}
              charging={participant.battery.charging}
            />
            <span>{Math.round(participant.battery.level * 100)}%</span>
          </div>
        )}
      </div>
      <div className={cn("w-2 h-2 rounded-full bg-primary ring-2 ring-background mt-1", isCurrentUser && "bg-accent")}></div>
    </div>
  );
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

  // Subscribe to participants of the active session
  const participantsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !session || !isParticipating) return null;
    return collection(firestore, 'hunting_sessions', session.id, 'participants');
  }, [firestore, session, isParticipating]);

  const { data: participants, isLoading: areParticipantsLoading } = useCollection<SessionParticipant>(participantsCollectionRef);
  
  // Effect to clean up on unmount or session leave
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  const handleUpdatePosition = async () => {
    if (!user || !session || !firestore) return;

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
            batteryData = {
                level: battery.level,
                charging: battery.charging,
            };
        }

        const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
        const participantData: Omit<SessionParticipant, 'id'> = {
            displayName: user.displayName || 'Chasseur Anonyme',
            location: { latitude, longitude },
            battery: batteryData,
            updatedAt: serverTimestamp(),
        };

        setDoc(participantDocRef, participantData, { merge: true }).catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: participantDocRef.path,
                operation: 'write',
                requestResourceData: participantData,
             });
             errorEmitter.emit('permission-error', permissionError);
        });

        if (!isParticipating) {
            setIsParticipating(true);
        }

    } catch (err: any) {
        console.error("Error updating position:", err);
        if (err.name === 'FirebaseError' && err.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: `hunting_sessions/${session?.id}/participants/${user.uid}`,
                operation: 'write',
             });
             errorEmitter.emit('permission-error', permissionError);
        } else if (err.code === 1) { // PERMISSION_DENIED
          setError("La géolocalisation est requise. Veuillez l'activer dans les paramètres de votre navigateur.");
          handleLeaveSession(); // Kick user out if they deny permission
        }
    }
  };
  
  // Start/stop location tracking when session state changes
  useEffect(() => {
    if (session && isParticipating) {
      handleUpdatePosition(); // Initial update
      updateIntervalRef.current = setInterval(handleUpdatePosition, 15000); // Update every 15s
    } else {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isParticipating]);


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
        
        setDoc(sessionDocRef, docData).then(() => {
             setSession({ id: code, ...docData });
             setIsParticipating(true);
             toast({
                title: 'Session créée !',
                description: `Le code de votre session est : ${code}`,
            });
            setIsLoading(false);
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: sessionDocRef.path,
                operation: 'create',
                requestResourceData: docData,
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });
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
      setIsParticipating(true);

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

  const handleLeaveSession = async () => {
     if (!user || !session || !firestore) return;
     setIsLoading(true);
     try {
       const participantDocRef = doc(firestore, 'hunting_sessions', session.id, 'participants', user.uid);
       await deleteDoc(participantDocRef);
       setSession(null);
       setIsParticipating(false);
       setUserLocation(null);
       toast({ title: 'Vous avez quitté la session.' });
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
        setIsLoading(false);
     }
  };
  
  const copyToClipboard = () => {
    if(!session) return;
    navigator.clipboard.writeText(session.id);
    toast({ description: "Code copié dans le presse-papiers !" });
  }

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
    const ZOOM_DIAMETER_KM = 10;
    const currentUserParticipant = participants?.find(p => p.id === user?.uid);
    const centerLocation = currentUserParticipant?.location ?? userLocation;
    const viewBox = centerLocation
        ? getZoomedViewBox(centerLocation.latitude, centerLocation.longitude, ZOOM_DIAMETER_KM)
        : "0 0 200 200";

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

            <div className="relative w-full aspect-square rounded-lg overflow-hidden border bg-blue-50 dark:bg-blue-900/20">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={viewBox}
                    className="absolute inset-0 w-full h-full transition-all duration-1000 ease-linear"
                    fill="currentColor"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <g className="text-muted-foreground/10 dark:text-muted-foreground/5">
                        <NewCaledoniaPaths />
                    </g>
                </svg>

                 <div className="absolute inset-0">
                    {centerLocation && participants?.map(p => (
                        <ParticipantMarker
                            key={p.id}
                            participant={p}
                            centerLat={centerLocation.latitude}
                            centerLon={centerLocation.longitude}
                            viewDiameterKm={ZOOM_DIAMETER_KM}
                            isCurrentUser={p.id === user?.uid}
                        />
                    ))}
                 </div>
                 
                 <Button onClick={handleUpdatePosition} variant="secondary" size="icon" className="absolute top-2 right-2 z-10"><LocateFixed /></Button>
            </div>

            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <Users className="mr-2"/>
                        {participants?.length ?? 0} Participant(s)
                        <ChevronUp className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto p-1">
                        {areParticipantsLoading && <Skeleton className="h-10 w-full" />}
                        {participants?.map(p => (
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

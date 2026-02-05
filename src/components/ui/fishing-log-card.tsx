'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { LocationData, FishingSpot, SwellForecast } from '@/lib/types';
import { getDataForDate } from '@/lib/data';
import { Map, MapPin, Fish, Plus, Save, Trash2, BrainCircuit, BarChart, AlertCircle, Anchor, LocateFixed, Expand, Shrink, ChevronDown, Pencil, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { useLocation } from '@/context/location-context';
import { findSimilarDay, analyzeBestDay } from '@/ai/flows/find-best-fishing-day';
import type { FishingAnalysisOutput } from '@/ai/schemas';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from './badge';
import { useGoogleMaps } from '@/context/google-maps-context';


const mapIcons = {
    Fish: Fish,
    MapPin: MapPin,
    Anchor: Anchor
};
const availableIcons = Object.keys(mapIcons);
const availableColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const fishingTypes = [
  { id: 'Dérive', bgColor: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', label: 'Dérive' },
  { id: 'Mouillage', bgColor: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: 'Mouillage' },
  { id: 'Pêche à la ligne', bgColor: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: 'Ligne' },
  { id: 'Pêche au lancer', bgColor: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400', label: 'Lancer' },
  { id: 'Traine', bgColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: 'Traine' },
];

const PulsingDot = () => (
    <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="w-5 h-5 rounded-full bg-blue-500 opacity-75 animate-ping absolute"></div>
      <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white relative"></div>
    </div>
);

export function FishingLogCard({ data: locationData }: { data: LocationData }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newSpotLocation, setNewSpotLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [spotName, setSpotName] = useState('');
    const [spotNotes, setSpotNotes] = useState('');
    const [selectedIcon, setSelectedIcon] = useState<keyof typeof mapIcons>('Fish');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [selectedFishingTypes, setSelectedFishingTypes] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [initialZoomDone, setInitialZoomDone] = useState(false);
    const watchId = useRef<number | null>(null);

    const { selectedLocation } = useLocation();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<FishingAnalysisOutput | null>(null);
    const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
    const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]);
    
    const [openSpotId, setOpenSpotId] = useState<string | undefined>(undefined);
    const spotRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // State for the unified dialog
    const [isSpotDialogOpen, setIsSpotDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
    const [spotToEdit, setSpotToEdit] = useState<FishingSpot | null>(null);

    const { isLoaded, loadError } = useGoogleMaps();

    const fishingSpotsRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'users', user.uid, 'fishing_spots'), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: savedSpots, isLoading: areSpotsLoading } = useCollection<FishingSpot>(fishingSpotsRef);

    const handleSpotClick = (spotId: string) => {
        setOpenSpotId(prevId => (prevId === spotId ? undefined : spotId));
        setTimeout(() => {
            spotRefs.current[spotId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    };

    const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
        setMap(mapInstance);
        mapInstance.setMapTypeId('satellite');
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
        setInitialZoomDone(false);
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
        }
    }, []);

    const startWatchingPosition = useCallback(() => {
        if (!navigator.geolocation) {
            return;
        }
        navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
            if (permissionStatus.state === 'prompt' || permissionStatus.state === 'granted') {
                 if (watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current);
                }
                watchId.current = navigator.geolocation.watchPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        const newLocation = { lat: latitude, lng: longitude };
                        setUserLocation(newLocation);
                        if (map && !initialZoomDone) {
                            map.panTo(newLocation);
                            map.setZoom(16);
                            setInitialZoomDone(true);
                        }
                    },
                    () => { /* Error can be handled silently or with a toast */ },
                    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                );
            }
        });
    }, [map, initialZoomDone]);

     useEffect(() => {
        if (map && isLoaded) {
            startWatchingPosition();
        }
        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }
        };
    }, [map, isLoaded, startWatchingPosition]);

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
                
                setUserLocation({lat: latitude, lng: longitude});

                if (map) {
                    map.panTo(newLocation);
                    if(!initialZoomDone) {
                        map.setZoom(16);
                        setInitialZoomDone(true);
                    }
                }
            },
            (err) => {
                 let description = "Impossible d'obtenir votre position actuelle.";
                 if (err.code === 1) {
                   description = "Veuillez activer la géolocalisation dans les paramètres de votre navigateur.";
                 } else if (err.code === 3) {
                   description = "La demande de localisation a expiré. Veuillez réessayer dans une zone avec un meilleur signal GPS.";
                 } else if (err.code === 2) {
                   description = "Position indisponible. Vérifiez les paramètres de votre appareil et le signal GPS.";
                 }
                 toast({
                     variant: "destructive",
                     title: "Erreur de localisation",
                     description: description,
                 });
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    };

    const handleMapClick = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            setNewSpotLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    };
    
    const handleToggleFishingType = (typeId: string) => {
        setSelectedFishingTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(id => id !== typeId)
                : [...prev, typeId]
        );
    };

    const handleSaveSpot = async () => {
        if (!user || !firestore || !newSpotLocation || !spotName) {
            toast({ variant: 'destructive', title: 'Erreur', description: "Le nom du spot est requis." });
            return;
        }
        setIsSaving(true);
        
        const now = new Date();
        const todayData = getDataForDate(selectedLocation, now);
        const prevDate = new Date(now);
        prevDate.setDate(now.getDate() - 1);
        const prevDayData = getDataForDate(selectedLocation, prevDate);
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + 1);
        const nextDayData = getDataForDate(selectedLocation, nextDate);

        const timeToMinutes = (time: string, dayOffset = 0) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m + dayOffset * 24 * 60;
        };
        
        const combinedTides = [
            ...prevDayData.tides.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time, -1) })),
            ...todayData.tides.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time, 0) })),
            ...nextDayData.tides.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time, 1) })),
        ].sort((a, b) => a.timeMinutes - b.timeMinutes);

        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const prevTide = combinedTides.filter(t => t.timeMinutes <= nowMinutes).pop();
        const nextTide = combinedTides.find(t => t.timeMinutes > nowMinutes);

        const closestLowTide = prevTide?.type === 'basse' ? prevTide : (nextTide?.type === 'basse' ? nextTide : null);
        const closestHighTide = prevTide?.type === 'haute' ? prevTide : (nextTide?.type === 'haute' ? nextTide : null);

        const getTideMovementForContext = (): 'montante' | 'descendante' | 'étale' => {
            const nextTidePeak = combinedTides.find(t => t.timeMinutes > nowMinutes);
            const prevTidePeak = combinedTides.filter(t => t.timeMinutes < nowMinutes).pop();

            if (!nextTidePeak || !prevTidePeak) return 'étale';
            if (Math.abs(nowMinutes - nextTidePeak.timeMinutes) < 30 || Math.abs(nowMinutes - prevTidePeak.timeMinutes) < 30) {
                return 'étale';
            }
            return nextTidePeak.type === 'haute' ? 'montante' : 'descendante';
        };
        
        const currentHour = now.getHours();
        const currentForecast = todayData.weather.hourly.find(f => new Date(f.date).getHours() === currentHour) || todayData.weather.hourly[0];

        const findClosestSwell = (swellForecasts: SwellForecast[]): SwellForecast => {
            if (!swellForecasts || swellForecasts.length === 0) {
                return { time: '12:00', inside: 'N/A', outside: 'N/A', period: 0 };
            }
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            return swellForecasts.reduce((prev, curr) => {
                const prevTimeMinutes = timeToMinutes(prev.time);
                const currTimeMinutes = timeToMinutes(curr.time);
                return (Math.abs(currTimeMinutes - nowMinutes) < Math.abs(prevTimeMinutes - nowMinutes) ? curr : prev);
            });
        };
        const currentSwell = findClosestSwell(todayData.weather.swell);

        const newSpotData = {
            userId: user.uid,
            name: spotName,
            notes: spotNotes,
            location: { latitude: newSpotLocation.lat, longitude: newSpotLocation.lng },
            icon: selectedIcon,
            color: selectedColor,
            fishingTypes: selectedFishingTypes,
            createdAt: serverTimestamp(),
            context: {
                timestamp: now.toISOString(),
                moonPhase: todayData.weather.moon.phase,
                tideHeight: currentForecast.tideHeight,
                tideMovement: getTideMovementForContext(),
                tideCurrent: currentForecast.tideCurrent,
                weatherCondition: currentForecast.condition,
                windSpeed: currentForecast.windSpeed,
                windDirection: currentForecast.windDirection,
                airTemperature: currentForecast.temp,
                waterTemperature: todayData.weather.waterTemperature,
                ...(closestLowTide && { closestLowTide: { time: closestLowTide.time, height: closestLowTide.height } }),
                ...(closestHighTide && { closestHighTide: { time: closestHighTide.time, height: closestHighTide.height } }),
                swellInside: currentSwell.inside,
                swellOutside: currentSwell.outside,
            }
        };

        try {
            await addDoc(collection(firestore, 'users', user.uid, 'fishing_spots'), newSpotData);
            toast({ title: 'Spot sauvegardé !' });
            setIsSpotDialogOpen(false);
            setNewSpotLocation(null);
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du spot :", error);
            toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de sauvegarder le spot." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleUpdateSpot = async () => {
        if (!user || !firestore || !spotToEdit || !spotName) {
            toast({ variant: 'destructive', title: 'Erreur', description: "Le nom du spot est requis." });
            return;
        }
        setIsSaving(true);
        
        const spotRef = doc(firestore, 'users', user.uid, 'fishing_spots', spotToEdit.id);
        const updatedData = {
            name: spotName,
            notes: spotNotes,
            icon: selectedIcon,
            color: selectedColor,
            fishingTypes: selectedFishingTypes,
        };

        try {
            await updateDoc(spotRef, updatedData);
            toast({ title: 'Spot mis à jour !' });
            setIsSpotDialogOpen(false);
            setSpotToEdit(null);
        } catch (error) {
            console.error("Erreur lors de la mise à jour du spot :", error);
            toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de mettre à jour le spot." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (dialogMode === 'add') {
            await handleSaveSpot();
        } else {
            await handleUpdateSpot();
        }
    };
    
    const handleEditClick = (spot: FishingSpot) => {
        setDialogMode('edit');
        setSpotToEdit(spot);
        setSpotName(spot.name);
        setSpotNotes(spot.notes || '');
        setSelectedIcon(spot.icon as keyof typeof mapIcons);
        setSelectedColor(spot.color);
        setSelectedFishingTypes(spot.fishingTypes || []);
        setIsSpotDialogOpen(true);
    };
    
    const handleDeleteSpot = async (spotId: string) => {
        if (!user || !firestore) return;
        const spotRef = doc(firestore, 'users', user.uid, 'fishing_spots', spotId);
        try {
            await deleteDoc(spotRef);
            toast({ title: 'Spot supprimé.'});
        } catch (error) {
            console.error("Erreur lors de la suppression du spot:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer le spot.' });
        }
    };

    const handleFindSimilarDay = async (spot: FishingSpot) => {
        setIsAnalyzing(true);
        setAnalysisResult(null);
        setIsAnalysisDialogOpen(true);
        try {
            const result = await findSimilarDay({
                spotContext: spot.context,
                location: selectedLocation,
                searchRangeDays: 30,
            });
            setAnalysisResult(result);
        } catch (error) {
            console.error("AI analysis failed:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur de l\'analyse IA',
                description: 'Impossible de trouver un jour similaire. Veuillez réessayer.'
            });
            setIsAnalysisDialogOpen(false);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeNext7Days = async () => {
        if (selectedSpotIds.length === 0) {
            toast({
                title: 'Aucun spot sélectionné',
                description: 'Veuillez sélectionner au moins un spot à analyser.'
            });
            return;
        }

        const spotsToAnalyze = savedSpots?.filter(spot => selectedSpotIds.includes(spot.id));
        if (!spotsToAnalyze || spotsToAnalyze.length === 0) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        setIsAnalysisDialogOpen(true);

        try {
            const result = await analyzeBestDay({
                spotContexts: spotsToAnalyze.map(s => s.context),
                location: selectedLocation,
                searchRangeDays: 7,
            });
            setAnalysisResult(result);
        } catch (error) {
            console.error("AI analysis failed:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur de l\'analyse IA',
                description: 'Impossible d\'analyser les spots. Veuillez réessayer.'
            });
            setIsAnalysisDialogOpen(false);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSpotSelection = (spotId: string) => {
        setSelectedSpotIds(prev =>
            prev.includes(spotId)
                ? prev.filter(id => id !== spotId)
                : [...prev, spotId]
        );
    };

    if (!user) {
        return (
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Map /> Carnet de Pêche</CardTitle></CardHeader>
                <CardContent>
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Connectez-vous pour utiliser le carnet de pêche</AlertTitle>
                        <AlertDescription>Sauvegardez vos meilleurs coins de pêche et consultez votre historique.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className={cn("transition-all", isFullscreen && "fixed inset-0 z-50 w-screen h-screen rounded-none border-none flex flex-col")}>
            <CardHeader className={cn(isFullscreen && "flex-shrink-0")}>
                <CardTitle className="flex items-center gap-2"><Map /> Carnet de Pêche</CardTitle>
                <CardDescription>Cliquez sur la carte pour marquer un coin, puis enregistrez-le. Vos spots sauvegardés apparaîtront dans l'historique.</CardDescription>
            </CardHeader>
            <CardContent className={cn("space-y-4", isFullscreen ? "flex-grow flex flex-col p-2 gap-2" : "p-6 pt-0")}>
                {loadError && <Alert variant="destructive"><AlertTitle>Erreur de chargement de la carte</AlertTitle></Alert>}
                {!isLoaded && <Skeleton className="h-80 w-full" />}
                {isLoaded && (
                    <div className={cn("relative w-full rounded-lg overflow-hidden border", isFullscreen ? "flex-grow" : "h-80")}>
                        <GoogleMap
                            mapContainerClassName="w-full h-full"
                            center={userLocation || { lat: -21.5, lng: 165.5 }}
                            zoom={userLocation && initialZoomDone ? (map?.getZoom() ?? 16) : 7}
                            options={{ disableDefaultUI: true, zoomControl: true, mapTypeControl: true, clickableIcons: false, mapTypeId: 'satellite' }}
                            onClick={handleMapClick}
                            onLoad={onLoad}
                            onUnmount={onUnmount}
                        >
                           {userLocation && (
                                <OverlayView
                                    position={userLocation}
                                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                >
                                    <PulsingDot />
                                </OverlayView>
                            )}
                            {savedSpots?.map(spot => {
                                const Icon = mapIcons[spot.icon as keyof typeof mapIcons] || MapPin;
                                return (
                                    <OverlayView
                                        key={spot.id}
                                        position={{ lat: spot.location.latitude, lng: spot.location.longitude }}
                                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                    >
                                        <div
                                            style={{ transform: 'translate(-50%, -100%)' }}
                                            className="flex flex-col items-center gap-1 cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); handleSpotClick(spot.id); }}
                                        >
                                            <div className="flex flex-col items-center gap-1 px-2 py-1 bg-card/90 backdrop-blur-sm border border-border rounded-md shadow" onClick={(e) => e.stopPropagation()}>
                                                <span className="text-xs font-bold text-foreground whitespace-nowrap">{spot.name}</span>
                                                {spot.fishingTypes && spot.fishingTypes.length > 0 && (
                                                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 justify-center max-w-[150px]">
                                                        {spot.fishingTypes.map(type => {
                                                            const typeInfo = fishingTypes.find(t => t.id === type);
                                                            if (!typeInfo) return null;
                                                            return (
                                                                <span
                                                                    key={type}
                                                                    className={cn(
                                                                        "text-[10px] font-bold",
                                                                        typeInfo.textColor
                                                                    )}
                                                                >
                                                                    {typeInfo.label}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                             <div
                                                className="p-1.5 rounded-full flex items-center justify-center shadow-lg"
                                                style={{ backgroundColor: spot.color }}
                                            >
                                                <Icon className="size-5 text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                    </OverlayView>
                                )
                            })}
                           {newSpotLocation && (
                                <OverlayView
                                    position={newSpotLocation}
                                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                >
                                    <div style={{ transform: 'translate(-50%, -50%)' }}>
                                         <div className="size-10 bg-primary border-4 border-white rounded-full flex items-center justify-center shadow-xl">
                                            <Plus className="text-white size-6" strokeWidth={3} />
                                        </div>
                                    </div>
                                </OverlayView>
                            )}
                        </GoogleMap>
                        <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-2 left-2 shadow-lg h-9 w-9 z-10 bg-background/80 backdrop-blur-sm">
                            {isFullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
                        </Button>
                        <Button size="icon" onClick={handleRecenter} className="absolute top-2 right-2 shadow-lg h-9 w-9 z-10 bg-background/80 backdrop-blur-sm">
                            <LocateFixed className="h-5 w-5" />
                        </Button>
                         <div className={cn("absolute bottom-0 left-0 right-0 z-10", !newSpotLocation && "hidden")}>
                            <Button 
                                className="w-full h-14 rounded-none bg-primary hover:bg-primary/90 text-white font-black uppercase text-base tracking-widest shadow-[0_-4px_20px_rgba(0,0,0,0.3)] gap-3" 
                                onClick={() => {
                                    if (newSpotLocation) {
                                        setDialogMode('add');
                                        setSpotToEdit(null);
                                        setSpotName('');
                                        setSpotNotes('');
                                        setSelectedIcon('Fish');
                                        setSelectedColor('#3b82f6');
                                        setSelectedFishingTypes([]);
                                        setIsSpotDialogOpen(true);
                                    }
                                }}
                            >
                                <Plus className="size-6" /> Ajouter ce coin de pêche
                            </Button>
                        </div>
                    </div>
                )}
                 <Alert className={cn(isFullscreen && "hidden")}>
                    
                    <AlertTitle>Mode Hors Ligne</AlertTitle>
                    <AlertDescription>
                        La carte peut être utilisée hors ligne. Pour mettre une zone en cache, naviguez simplement sur la carte lorsque vous êtes connecté.
                    </AlertDescription>
                </Alert>
                
                <Dialog open={isSpotDialogOpen} onOpenChange={(open) => { if (!open) setSpotToEdit(null); setIsSpotDialogOpen(open); }}>
                    <DialogContent className="max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-lg">
                        <DialogHeader className="p-6 pb-2 shrink-0">
                            <DialogTitle className="font-black uppercase tracking-tight">{dialogMode === 'add' ? 'Enregistrer un nouveau spot' : 'Modifier le spot'}</DialogTitle>
                            <DialogDescription>
                                {dialogMode === 'add' ? "Remplissez les détails et sauvegardez pour ajouter ce spot à votre carnet." : "Modifiez les informations de votre spot."}
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="flex-grow overflow-y-auto p-6 py-2 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="spot-name" className="text-xs font-bold uppercase text-muted-foreground">Nom du spot</Label>
                                <Input id="spot-name" placeholder="Ex: Spot à bec de cane" value={spotName} onChange={(e) => setSpotName(e.target.value)} className="h-12 border-2 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="spot-notes" className="text-xs font-bold uppercase text-muted-foreground">Notes</Label>
                                <Textarea id="spot-notes" placeholder="Ex: Pris à la traîne avec un leurre rouge" value={spotNotes} onChange={(e) => setSpotNotes(e.target.value)} className="border-2 font-medium" />
                            </div>
                             <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Techniques de pêche</Label>
                                <div className="flex flex-wrap gap-2">
                                    {fishingTypes.map((type) => {
                                        const isSelected = selectedFishingTypes.includes(type.id);
                                        return (
                                            <Button
                                                key={type.id}
                                                variant={isSelected ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => handleToggleFishingType(type.id)}
                                                className={cn("font-bold text-[10px] uppercase h-8", isSelected && `${type.bgColor} hover:${type.bgColor}/90 text-white border-none shadow-sm`)}
                                            >
                                                {type.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Icône</Label>
                                <div className="flex gap-3">
                                    {availableIcons.map(iconName => {
                                        const Icon = mapIcons[iconName as keyof typeof mapIcons];
                                        return (
                                            <Button key={iconName} variant="outline" size="icon" onClick={() => setSelectedIcon(iconName as keyof typeof mapIcons)} className={cn("size-12 border-2 transition-all", selectedIcon === iconName ? "border-primary bg-primary/5 scale-110 shadow-md" : "opacity-60")}>
                                                <Icon className="size-6" />
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Couleur</Label>
                                <div className="flex flex-wrap gap-3">
                                    {availableColors.map(color => (
                                        <button key={color} onClick={() => setSelectedColor(color)} className={cn("w-10 h-10 rounded-full border-4 transition-all shadow-sm", selectedColor === color ? "border-white ring-2 ring-primary scale-110" : "border-transparent opacity-80")} style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <DialogFooter className="p-6 pt-2 border-t shrink-0 flex flex-row gap-2 sm:flex-row">
                            <Button variant="ghost" onClick={() => { setIsSpotDialogOpen(false); if (dialogMode === 'add') setNewSpotLocation(null); }} className="flex-1 font-bold h-12 uppercase text-xs">Annuler</Button>
                            <Button onClick={handleSave} disabled={isSaving} className="flex-1 font-black h-12 uppercase text-xs shadow-md"><Save className="mr-2 size-4"/>{isSaving ? "Sauvegarde..." : "Sauvegarder"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {!isFullscreen && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Button 
                                variant="outline" 
                                className="flex-1 font-bold h-12 uppercase text-[10px] tracking-widest border-2" 
                                onClick={handleAnalyzeNext7Days}
                                disabled={selectedSpotIds.length === 0 || isAnalyzing}
                            >
                                <BarChart className="mr-2 size-4"/> 
                                Analyser {selectedSpotIds.length > 0 ? `(${selectedSpotIds.length}) spot(s)` : ''} (IA)
                            </Button>
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2 px-1">
                            <History className="size-3" /> Historique des prises
                        </h4>
                        {areSpotsLoading && <Skeleton className="h-24 w-full" />}
                        {!areSpotsLoading && savedSpots && savedSpots.length > 0 ? (
                            <AccordionPrimitive.Root 
                                type="single" 
                                collapsible 
                                className="w-full space-y-2"
                                value={openSpotId}
                                onValueChange={setOpenSpotId}
                            >
                               {savedSpots.map(spot => {
                                   const displayLowTide = spot.context.closestLowTide || (spot.context as any).previousLowTide;
                                   const displayHighTide = spot.context.closestHighTide || (spot.context as any).nextHighTide;

                                   return (
                                   <AccordionPrimitive.Item 
                                        ref={(el) => (spotRefs.current[spot.id] = el)}
                                        value={spot.id} 
                                        key={spot.id} 
                                        className="border-2 rounded-xl bg-card overflow-hidden shadow-sm"
                                    >
                                       <div className="flex items-center w-full">
                                            <div className="pl-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    id={`select-spot-${spot.id}`}
                                                    className="size-5 border-2"
                                                    checked={selectedSpotIds.includes(spot.id)}
                                                    onCheckedChange={() => handleSpotSelection(spot.id)}
                                                />
                                            </div>
                                            <AccordionPrimitive.Header asChild>
                                                <AccordionPrimitive.Trigger className='flex flex-1 items-center justify-between py-4 font-medium transition-all hover:no-underline [&[data-state=open]>svg]:rotate-180 pl-3 pr-4 text-left'>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg" style={{backgroundColor: spot.color + '15'}}>
                                                            {React.createElement(mapIcons[spot.icon as keyof typeof mapIcons] || MapPin, { className: 'size-5', style: {color: spot.color} })}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black uppercase tracking-tight text-sm leading-none truncate">{spot.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 uppercase">
                                                                {spot.createdAt ? format(spot.createdAt.toDate(), 'd MMM yyyy à HH:mm', { locale: fr }) : 'Enregistrement...'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 opacity-30" />
                                                </AccordionPrimitive.Trigger>
                                            </AccordionPrimitive.Header>
                                       </div>
                                       <AccordionPrimitive.Content className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down border-t border-dashed">
                                           <div className="pb-4 pl-12 pr-4 space-y-4 pt-4 bg-muted/5">
                                            {spot.fishingTypes && spot.fishingTypes.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {spot.fishingTypes.map(type => {
                                                        const typeInfo = fishingTypes.find(t => t.id === type);
                                                        return (
                                                            <Badge key={type} variant="secondary" className={cn("text-[9px] font-black uppercase text-white border-none", typeInfo?.bgColor)}>
                                                                {typeInfo?.label}
                                                            </Badge>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                           <div className="text-[11px] leading-relaxed text-muted-foreground bg-white border rounded-xl p-4 space-y-2 shadow-inner">
                                               {spot.notes && <p className="italic text-foreground font-medium mb-3">"{spot.notes}"</p>}
                                                <p><strong>Conditions :</strong> {spot.context.airTemperature}°C (air), {spot.context.waterTemperature}°C (eau)</p>
                                                <p><strong>Vent :</strong> {spot.context.windSpeed} nœuds de {spot.context.windDirection}</p>
                                                {spot.context.swellInside && spot.context.swellOutside && (
                                                    <p><strong>Houle :</strong> {spot.context.swellInside} (lagon), {spot.context.swellOutside} (large)</p>
                                                )}
                                                <p><strong>Lune :</strong> {spot.context.moonPhase}</p>
                                                <p><strong>Marée :</strong> {spot.context.tideMovement} ({spot.context.tideHeight.toFixed(2)}m), courant {spot.context.tideCurrent.toLowerCase()}</p>
                                                {displayLowTide && <p><strong>Marée basse :</strong> {displayLowTide.time} ({displayLowTide.height.toFixed(2)}m)</p>}
                                                {displayHighTide && <p><strong>Marée haute :</strong> {displayHighTide.time} ({displayHighTide.height.toFixed(2)}m)</p>}
                                           </div>
                                           <div className="flex gap-2">
                                               <Button variant="outline" className="flex-1 font-black uppercase text-[10px] h-10 border-2" onClick={() => handleFindSimilarDay(spot)} disabled={isAnalyzing}><BrainCircuit className="mr-2 size-4 text-primary"/> Jour similaire</Button>
                                               <Button variant="outline" size="icon" onClick={() => handleEditClick(spot)} className="size-10 border-2"><Pencil className="h-4 w-4" /></Button>
                                               <Button variant="destructive" size="icon" onClick={() => handleDeleteSpot(spot.id)} className="size-10 shadow-sm"><Trash2 className="size-4" /></Button>
                                           </div>
                                           </div>
                                       </AccordionPrimitive.Content>
                                   </AccordionPrimitive.Item>
                               )})}
                            </AccordionPrimitive.Root>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-2xl opacity-40">
                                <Anchor className="size-8 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Aucun spot sauvegardé</p>
                            </div>
                        )}
                    </div>
                )}

                <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
                    <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 font-black uppercase">
                                <BrainCircuit className="text-primary" /> Analyse de l'IA
                            </DialogTitle>
                            <DialogDescription>
                                Prédiction basée exclusivement sur les marées et la lune.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            {isAnalyzing && (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <BrainCircuit className="size-12 text-primary animate-pulse" />
                                    <p className="text-xs font-bold uppercase text-muted-foreground animate-pulse">Analyse en cours...</p>
                                    <Skeleton className="h-2 w-full" />
                                </div>
                            )}
                            {analysisResult && (
                                <div className="space-y-6 animate-in fade-in zoom-in-95">
                                    <div className="text-center p-6 bg-primary/5 border-2 border-primary/20 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Meilleure fenêtre</p>
                                        <p className="text-2xl font-black text-primary uppercase tracking-tighter">
                                            {format(new Date(analysisResult.bestDate.replace(/-/g, '/')), 'eeee d MMMM', { locale: fr })}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between px-1"><Label className="text-[10px] font-black uppercase opacity-60">Indice de confiance</Label><span className="text-xs font-black">{analysisResult.score}%</span></div>
                                        <Progress value={analysisResult.score} className="h-2" />
                                    </div>
                                    <div className="p-4 bg-muted/30 border-2 rounded-2xl max-h-60 overflow-y-auto">
                                        <h4 className="text-[10px] font-black uppercase mb-3 flex items-center gap-2"><Sparkles className="size-3 text-primary" /> Conclusion</h4>
                                        <p className="text-xs font-medium leading-relaxed italic text-muted-foreground">"{analysisResult.explanation}"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAnalysisDialogOpen(false)} className="w-full font-black uppercase h-12">Fermer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

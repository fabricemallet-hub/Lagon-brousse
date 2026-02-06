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
import type { LocationData, FishingSpot, SwellForecast, Tide } from '@/lib/types';
import { getDataForDate, generateProceduralData } from '@/lib/data';
import { Map, MapPin, Fish, Plus, Save, Trash2, BrainCircuit, BarChart, AlertCircle, Anchor, LocateFixed, Expand, Shrink, ChevronDown, Pencil, History, Navigation, Map as MapIcon } from 'lucide-react';
import { cn, getDistance } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { useLocation } from '@/context/location-context';
import { findSimilarDay, analyzeBestDay } from '@/ai/flows/find-best-fishing-day';
import { recommendBestSpot } from '@/ai/flows/recommend-best-spot';
import type { FishingAnalysisOutput, RecommendBestSpotOutput } from '@/ai/schemas';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useGoogleMaps } from '@/context/google-maps-context';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const mapIcons = {
    Fish: Fish,
    MapPin: MapPin,
    Anchor: Anchor
};
const availableIcons = Object.keys(mapIcons);
const availableColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const fishingTypes = [
  { id: 'Dérive', bgColor: 'bg-blue-500', label: 'Dérive' },
  { id: 'Mouillage', bgColor: 'bg-green-500', label: 'Mouillage' },
  { id: 'Pêche à la ligne', bgColor: 'bg-yellow-500', label: 'Ligne' },
  { id: 'Pêche au lancer', bgColor: 'bg-purple-500', label: 'Lancer' },
  { id: 'Traine', bgColor: 'bg-red-500', label: 'Traine' },
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
    const watchId = useRef<number | null>(null);
    const shouldPanOnNextFix = useRef(false);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    const { selectedLocation } = useLocation();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<FishingAnalysisOutput | null>(null);
    const [recommendResult, setRecommendResult] = useState<RecommendBestSpotOutput | null>(null);
    const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
    const [isRecommendDialogOpen, setIsRecommendDialogOpen] = useState(false);
    const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]);
    
    const [openSpotId, setOpenSpotId] = useState<string | undefined>(undefined);
    const spotRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
    }, []);

    const startWatchingPosition = useCallback(() => {
        if (!navigator.geolocation) {
            toast({ variant: "destructive", title: "Non supporté", description: "La géolocalisation n'est pas supportée." });
            return;
        }

        if (watchId.current !== null) return;

        watchId.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newLocation = { lat: latitude, lng: longitude };
                setUserLocation(newLocation);
                
                if (shouldPanOnNextFix.current && map) {
                    map.panTo(newLocation);
                    map.setZoom(16);
                    shouldPanOnNextFix.current = false;
                }
            },
            (err) => {
                console.error("Geolocation error:", err);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    }, [map, toast]);

    const handleRecenter = () => {
        if (watchId.current === null) {
            shouldPanOnNextFix.current = true;
            startWatchingPosition();
            toast({ description: "Activation du GPS..." });
        } else if (userLocation && map) {
            map.panTo(userLocation);
            map.setZoom(16);
        }
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

    const getCurrentContext = () => {
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

        return {
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
        };
    };

    const handleSaveSpot = async () => {
        if (!user || !firestore || !newSpotLocation || !spotName) {
            toast({ variant: 'destructive', title: 'Erreur', description: "Le nom du spot est requis." });
            return;
        }
        setIsSaving(true);
        
        const context = getCurrentContext();

        try {
            await addDoc(collection(firestore, 'users', user.uid, 'fishing_spots'), {
                userId: user.uid,
                name: spotName,
                notes: spotNotes,
                location: { latitude: newSpotLocation.lat, longitude: newSpotLocation.lng },
                icon: selectedIcon,
                color: selectedColor,
                fishingTypes: selectedFishingTypes,
                createdAt: serverTimestamp(),
                context
            });
            toast({ title: 'Spot sauvegardé !' });
            setIsSpotDialogOpen(false);
            setNewSpotLocation(null);
        } catch (error) {
            console.error(error);
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
            console.error(error);
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
            console.error(error);
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
            console.error(error);
            toast({ variant: 'destructive', title: 'Erreur IA', description: 'Impossible de trouver un jour similaire.' });
            setIsAnalysisDialogOpen(false);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeNext7Days = async () => {
        if (selectedSpotIds.length === 0) {
            toast({ title: 'Aucun spot sélectionné', description: 'Sélectionnez au moins un spot.' });
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
            console.error(error);
            toast({ variant: 'destructive', title: 'Erreur IA', description: 'Impossible d\'analyser les spots.' });
            setIsAnalysisDialogOpen(false);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleRecommendSpotNow = async () => {
        if (!savedSpots || savedSpots.length === 0) {
            toast({ title: 'Aucun spot', description: 'Enregistrez d\'abord quelques coins de pêche.' });
            return;
        }

        setIsAnalyzing(true);
        setRecommendResult(null);
        setIsRecommendDialogOpen(true);

        try {
            const currentContext = getCurrentContext();
            
            // Si le GPS n'est pas actif, on utilise le centre de la carte comme fallback
            const referenceLocation = userLocation || { lat: map?.getCenter()?.lat() || INITIAL_CENTER.lat, lng: map?.getCenter()?.lng() || INITIAL_CENTER.lng };

            const candidateSpots = savedSpots.map(spot => ({
                id: spot.id,
                name: spot.name,
                distance: Math.round(getDistance(referenceLocation.lat, referenceLocation.lng, spot.location.latitude, spot.location.longitude)),
                historicalContext: spot.context
            }));

            const result = await recommendBestSpot({
                currentContext: currentContext as any,
                candidateSpots,
                location: selectedLocation
            });

            setRecommendResult(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erreur IA', description: 'Impossible de recommander un spot.' });
            setIsRecommendDialogOpen(false);
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
                <CardHeader><CardTitle className="flex items-center gap-2"><MapIcon /> Carnet de Pêche</CardTitle></CardHeader>
                <CardContent>
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Connexion requise</AlertTitle>
                        <AlertDescription>Sauvegardez vos meilleurs coins de pêche et consultez votre historique.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className={cn("transition-all", isFullscreen && "fixed inset-0 z-50 w-screen h-screen rounded-none border-none flex flex-col")}>
            <CardHeader className={cn(isFullscreen && "flex-shrink-0")}>
                <CardTitle className="flex items-center gap-2"><MapIcon /> Carnet de Pêche</CardTitle>
                <CardDescription>Cliquez sur la carte pour marquer un coin. Vos spots apparaîtront dans l'historique.</CardDescription>
            </CardHeader>
            <CardContent className={cn("space-y-4", isFullscreen ? "flex-grow flex flex-col p-2 gap-2" : "p-6 pt-0")}>
                {loadError && <Alert variant="destructive"><AlertTitle>Erreur de chargement de la carte</AlertTitle></Alert>}
                {!isLoaded && <Skeleton className="h-80 w-full" />}
                {isLoaded && (
                    <div ref={mapContainerRef} className={cn("relative w-full rounded-lg overflow-hidden border", isFullscreen ? "flex-grow" : "h-80")}>
                        <GoogleMap
                            mapContainerClassName="w-full h-full"
                            defaultCenter={INITIAL_CENTER}
                            defaultZoom={7}
                            options={{ disableDefaultUI: true, zoomControl: true, mapTypeControl: true, clickableIcons: false, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
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
                        <Button 
                            onClick={handleRecenter} 
                            className={cn(
                                "absolute top-2 right-2 shadow-lg h-10 w-auto px-3 z-10 border-2 gap-2 flex items-center", 
                                watchId.current !== null ? "bg-primary text-white border-primary" : "bg-background/80 backdrop-blur-sm"
                            )}
                        >
                            <span className="text-[9px] font-black uppercase tracking-tighter">ACTIVER MON GPS + RECENTRER</span>
                            <LocateFixed className="size-5" />
                        </Button>
                         <div className={cn("absolute bottom-0 left-0 right-0 z-10", !newSpotLocation && "hidden")}>
                            <Button 
                                className="w-full h-14 rounded-none bg-primary hover:bg-primary/90 text-white font-black uppercase text-sm sm:text-base tracking-tight shadow-[0_-4px_20px_rgba(0,0,0,0.3)] gap-3" 
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

                {watchId.current === null && !isFullscreen && (
                    <Alert className="bg-primary/5 border-primary/20">
                        <LocateFixed className="size-4 text-primary" />
                        <AlertTitle className="text-xs font-black uppercase">Localisation Inactive</AlertTitle>
                        <AlertDescription className="flex flex-col gap-2">
                            <p className="text-[10px] font-medium leading-relaxed">Cliquez sur le bouton ci-dessous pour vous situer sur la carte et afficher votre position en temps réel.</p>
                            <Button size="sm" onClick={handleRecenter} className="font-black uppercase text-[10px] h-8 tracking-widest">
                                <LocateFixed className="size-3 mr-2" /> Afficher ma position
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="grid grid-cols-1 gap-2">
                    <Button 
                        variant="secondary" 
                        className="w-full font-black uppercase h-14 text-sm tracking-tight shadow-md border-2 border-primary/20 gap-3"
                        onClick={handleRecommendSpotNow}
                        disabled={isAnalyzing}
                    >
                        <BrainCircuit className={cn("size-6 text-primary", isAnalyzing && "animate-pulse")} />
                        Quel spot pour maintenant ? (IA)
                    </Button>
                </div>

                <Dialog open={isSpotDialogOpen} onOpenChange={(open) => { if (!open) setSpotToEdit(null); setIsSpotDialogOpen(open); }}>
                    <DialogContent className="max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-lg">
                        <DialogHeader className="p-6 pb-2 shrink-0">
                            <DialogTitle className="font-black uppercase tracking-tight">{dialogMode === 'add' ? 'Nouveau spot' : 'Modifier le spot'}</DialogTitle>
                        </DialogHeader>
                        
                        <div className="flex-grow overflow-y-auto p-6 py-2 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="spot-name" className="text-xs font-bold uppercase text-muted-foreground">Nom du spot</Label>
                                <Input id="spot-name" placeholder="Ex: Spot à bec de cane" value={spotName} onChange={(e) => setSpotName(e.target.value)} className="h-12 border-2 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="spot-notes" className="text-xs font-bold uppercase text-muted-foreground">Notes</Label>
                                <Textarea id="spot-notes" placeholder="Détails..." value={spotNotes} onChange={(e) => setSpotNotes(e.target.value)} className="border-2 font-medium" />
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
                        
                        <DialogFooter className="p-6 pt-2 border-t shrink-0 flex flex-row gap-2">
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
                                Analyser {selectedSpotIds.length > 0 ? `(${selectedSpotIds.length})` : ''} (IA)
                            </Button>
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2 px-1">
                            <History className="size-3" /> Historique des prises
                        </h4>
                        {!areSpotsLoading && savedSpots && savedSpots.length > 0 ? (
                            <AccordionPrimitive.Root 
                                type="single" 
                                collapsible 
                                className="w-full space-y-2"
                                value={openSpotId}
                                onValueChange={setOpenSpotId}
                            >
                               {savedSpots.map(spot => (
                                   <AccordionPrimitive.Item 
                                        ref={(el) => (spotRefs.current[spot.id] = el)}
                                        value={spot.id} 
                                        key={spot.id} 
                                        className="border-2 rounded-xl bg-card overflow-hidden shadow-sm"
                                    >
                                       <div className="flex items-center w-full">
                                            <div className="pl-3 py-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    id={`select-spot-${spot.id}`}
                                                    className="size-5 border-2"
                                                    checked={selectedSpotIds.includes(spot.id)}
                                                    onCheckedChange={() => handleSpotSelection(spot.id)}
                                                />
                                            </div>
                                            <AccordionPrimitive.Header asChild>
                                                <AccordionPrimitive.Trigger className='flex flex-1 items-center justify-between py-4 font-medium transition-all hover:no-underline [&[data-state=open]>svg]:rotate-180 pl-2 pr-4 text-left'>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg" style={{backgroundColor: spot.color + '15'}}>
                                                            {React.createElement(mapIcons[spot.icon as keyof typeof mapIcons] || MapPin, { className: 'size-5', style: {color: spot.color} })}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black uppercase tracking-tight text-xs leading-none truncate">{spot.name}</p>
                                                            <p className="text-[9px] font-bold text-muted-foreground/60 mt-1 uppercase">
                                                                {spot.createdAt ? format(spot.createdAt.toDate(), 'd MMM yyyy', { locale: fr }) : '...'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 opacity-30" />
                                                </AccordionPrimitive.Trigger>
                                            </AccordionPrimitive.Header>
                                       </div>
                                       <AccordionPrimitive.Content className="overflow-hidden text-sm transition-all border-t border-dashed">
                                           <div className="pb-4 px-4 space-y-4 pt-4 bg-muted/5">
                                           <div className="text-[11px] leading-relaxed text-muted-foreground bg-white border rounded-xl p-4 space-y-2 shadow-inner">
                                               {spot.notes && <p className="italic text-foreground font-medium mb-3">"{spot.notes}"</p>}
                                                <p><strong>Conditions :</strong> {spot.context.airTemperature}°C, {spot.context.windSpeed} nds {spot.context.windDirection}</p>
                                                <p><strong>Lune :</strong> {spot.context.moonPhase}</p>
                                                <p><strong>Marée :</strong> {spot.context.tideMovement} ({spot.context.tideHeight.toFixed(2)}m)</p>
                                           </div>
                                           <div className="grid grid-cols-2 gap-2">
                                               <Button variant="outline" className="font-black uppercase text-[10px] h-12 border-2 px-1 whitespace-normal text-center" onClick={() => handleFindSimilarDay(spot)} disabled={isAnalyzing}>
                                                   <BrainCircuit className="mr-1 size-4 text-primary shrink-0"/> Jour similaire
                                               </Button>
                                               <Button variant="outline" className="font-black uppercase text-[10px] h-12 border-2 px-1" onClick={() => {
                                                   if (map && spot.location) {
                                                       map.panTo({ lat: spot.location.latitude, lng: spot.location.longitude });
                                                       map.setZoom(16);
                                                       mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                   }
                                               }}>
                                                   <LocateFixed className="mr-1 size-4 text-primary shrink-0" /> GPS
                                               </Button>
                                               <Button variant="outline" className="font-black uppercase text-[10px] h-12 border-2" onClick={() => handleEditClick(spot)}><Pencil className="mr-1 size-4 shrink-0" /> Modifier</Button>
                                               <Button variant="destructive" className="font-black uppercase text-[10px] h-12" onClick={() => handleDeleteSpot(spot.id)}><Trash2 className="mr-1 size-4 shrink-0" /> Supprimer</Button>
                                           </div>
                                           </div>
                                       </AccordionPrimitive.Content>
                                   </AccordionPrimitive.Item>
                               ))}
                            </AccordionPrimitive.Root>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-2xl opacity-40">
                                <Anchor className="size-8 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Aucun spot sauvegardé</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Dialog Analyse 7 jours / Jour similaire */}
                <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
                    <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 font-black uppercase"><BrainCircuit className="text-primary" /> Analyse de l'IA</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            {isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <BrainCircuit className="size-12 text-primary animate-pulse" />
                                    <p className="text-xs font-bold uppercase text-muted-foreground animate-pulse">Analyse en cours...</p>
                                </div>
                            ) : analysisResult && (
                                <div className="space-y-6 animate-in fade-in zoom-in-95">
                                    <div className="text-center p-6 bg-primary/5 border-2 border-primary/20 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Meilleure fenêtre</p>
                                        <p className="text-2xl font-black text-primary uppercase tracking-tighter">
                                            {format(new Date(analysisResult.bestDate.replace(/-/g, '/')), 'eeee d MMMM', { locale: fr })}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between px-1"><Label className="text-[10px] font-black uppercase opacity-60">Confiance</Label><span className="text-xs font-black">{analysisResult.score}%</span></div>
                                        <Progress value={analysisResult.score} className="h-2" />
                                    </div>
                                    <p className="text-xs font-medium leading-relaxed italic text-muted-foreground bg-muted/30 p-4 rounded-xl border-2">"{analysisResult.explanation}"</p>
                                </div>
                            )}
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => setIsAnalysisDialogOpen(false)} className="w-full font-black uppercase h-12">Fermer</Button></DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog Recommandation Spot Actuel */}
                <Dialog open={isRecommendDialogOpen} onOpenChange={setIsRecommendDialogOpen}>
                    <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 font-black uppercase"><BrainCircuit className="text-primary" /> Meilleur spot immédiat</DialogTitle>
                            <DialogDescription className="text-[10px] uppercase font-bold">Analyse basée sur votre GPS, la marée et la lune actuelle</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            {isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <BrainCircuit className="size-12 text-primary animate-pulse" />
                                    <p className="text-xs font-bold uppercase text-muted-foreground animate-pulse">Calcul tactique en cours...</p>
                                </div>
                            ) : recommendResult && (
                                <div className="space-y-6 animate-in fade-in zoom-in-95">
                                    <div className="p-6 bg-indigo-600 text-white rounded-2xl shadow-xl relative overflow-hidden">
                                        <Navigation className="absolute -right-4 -bottom-4 size-24 opacity-10 rotate-12" />
                                        <p className="text-[10px] font-black uppercase text-indigo-200 mb-1 tracking-widest">Allez à :</p>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">{recommendResult.bestSpotName}</h3>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-black text-[10px]">CONFIANCE {recommendResult.confidence}%</Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-1"><BrainCircuit className="size-3" /> Pourquoi ce choix ?</p>
                                            <div className="bg-muted/30 p-4 rounded-xl border-2 italic text-xs font-medium leading-relaxed">
                                                "{recommendResult.reason}"
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-black uppercase text-primary flex items-center gap-2 px-1"><Fish className="size-3" /> Conseil Tactique</p>
                                            <div className="bg-primary/5 p-4 rounded-xl border-2 border-primary/10 text-xs font-bold leading-relaxed text-primary">
                                                {recommendResult.advice}
                                            </div>
                                        </div>
                                    </div>

                                    <Button 
                                        className="w-full h-12 font-black uppercase gap-2"
                                        onClick={() => {
                                            const spot = savedSpots?.find(s => s.id === recommendResult.bestSpotId);
                                            if (spot && map) {
                                                map.panTo({ lat: spot.location.latitude, lng: spot.location.longitude });
                                                map.setZoom(16);
                                                setIsRecommendDialogOpen(false);
                                                mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }}
                                    >
                                        <LocateFixed className="size-4" /> Voir sur la carte
                                    </Button>
                                </div>
                            )}
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => setIsRecommendDialogOpen(false)} className="w-full font-black uppercase h-12">Fermer</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

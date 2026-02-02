'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, OverlayView } from '@react-google-maps/api';
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
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { LocationData, FishingSpot } from '@/lib/types';
import { Map, MapPin, Fish, Plus, Save, Trash2, BrainCircuit, BarChart, AlertCircle, Anchor, LocateFixed, Expand, Shrink, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { useLocation } from '@/context/location-context';
import { findSimilarDay, analyzeBestDay } from '@/ai/flows/find-best-fishing-day';
import type { FishingAnalysisOutput } from '@/ai/schemas';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from './badge';


const mapIcons = {
    Fish: Fish,
    MapPin: MapPin,
    Anchor: Anchor
};
const availableIcons = Object.keys(mapIcons);
const availableColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const fishingTypes = [
  { id: 'Dérive', color: 'bg-blue-500', label: 'Dérive' },
  { id: 'Mouillage', color: 'bg-green-500', label: 'Mouillage' },
  { id: 'Pêche à la ligne', color: 'bg-yellow-500', label: 'Ligne' },
  { id: 'Pêche au lancer', color: 'bg-purple-500', label: 'Lancer' },
  { id: 'Traine', color: 'bg-red-500', label: 'Traine' },
];

const createMarkerIconSvg = (color: string, iconName: keyof typeof mapIcons) => {
    const Icon = mapIcons[iconName];
    // A simplified SVG representation to avoid JSX in data URI
    const iconSvgPaths: Record<keyof typeof mapIcons, string> = {
        Fish: `<path d="M16.5 22a2.5 2.5 0 0 1-4.25-2.035l-.625-5.003a3.5 3.5 0 0 1 3.25-3.96h.625a3.5 3.5 0 0 1 3.25 3.96l-.625 5.003A2.5 2.5 0 0 1 16.5 22Z" /><path d="m18 11-2.5-2a4 4 0 0 0-5.336-1.336" /><path d="M6.5 12c-2 0-4.5 1-4.5 4v0" /><path d="M12 12A3 3 0 0 0 9 9" /><path d="M15.5 12c2 0 4.5 1 4.5 4v0" />`,
        MapPin: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />`,
        Anchor: `<path d="M12 22V8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /><circle cx="12" cy="5" r="3" />`
    };
    const iconPath = iconSvgPaths[iconName] || iconSvgPaths.MapPin;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

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
    const [isAddSpotOpen, setIsAddSpotOpen] = useState(false);
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

    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: googleMapsApiKey || "", mapIds: ['satellite_id'] });

    const fishingSpotsRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'users', user.uid, 'fishing_spots'), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: savedSpots, isLoading: areSpotsLoading } = useCollection<FishingSpot>(fishingSpotsRef);

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

    const startWatchingPosition = useCallback((centerMap: boolean) => {
        if (!navigator.geolocation) {
            return;
        }

        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
        }

        navigator.permissions?.query({name: 'geolocation'}).then(status => {
            if (status.state === 'prompt') {
                if (centerMap) { 
                     navigator.geolocation.getCurrentPosition(position => {
                        const { latitude, longitude } = position.coords;
                        const newLocation = { lat: latitude, lng: longitude };
                        setUserLocation(newLocation);
                        if (map) {
                            map.panTo(newLocation);
                            map.setZoom(16);
                            setInitialZoomDone(true);
                        }
                     },
                     () => {
                         toast({
                            variant: 'destructive',
                            title: 'Position non disponible',
                            description: "Veuillez autoriser l'accès à votre position.",
                        });
                     });
                }
                return;
            }
            if (status.state === 'denied') {
                 toast({
                    variant: 'destructive',
                    title: 'Géolocalisation refusée',
                    description: "Veuillez l'activer dans les paramètres de votre navigateur pour utiliser cette fonctionnalité.",
                });
                return;
            }
            
            watchId.current = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const newLocation = { lat: latitude, lng: longitude };
                    setUserLocation(newLocation);

                    if (map && centerMap && !initialZoomDone) {
                        map.panTo(newLocation);
                        map.setZoom(16);
                        setInitialZoomDone(true);
                    }
                },
                () => {
                     toast({
                        variant: 'destructive',
                        title: 'Position non disponible',
                        description: "Veuillez autoriser l'accès à votre position.",
                    });
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }, [map, initialZoomDone, toast]);

    const handleRecenter = () => {
        if (userLocation) {
            map?.panTo(userLocation);
            map?.setZoom(16);
        } else {
            startWatchingPosition(true);
        }
    };
    
    const handleMapClick = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            setNewSpotLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    };
    
    const handleNewSpotDragEnd = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            setNewSpotLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    };

    const getTideMovement = useCallback((): 'montante' | 'descendante' | 'étale' => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentForecast = locationData.weather.hourly.find(f => new Date(f.date).getHours() === currentHour) || locationData.weather.hourly[0];
        if (currentForecast.tideCurrent === 'Nul' || currentForecast.tidePeakType) {
            return 'étale';
        }
        const timeToMinutes = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        const sortedTides = [...locationData.tides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        let nextTidePeak = sortedTides.find(t => timeToMinutes(t.time) > nowMinutes);
        if (!nextTidePeak) {
            nextTidePeak = sortedTides[0];
        }
        return nextTidePeak.type === 'haute' ? 'montante' : 'descendante';
    }, [locationData]);

    const handleToggleFishingType = (typeId: string) => {
        setSelectedFishingTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(t => t !== typeId)
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
        const currentHour = now.getHours();
        const currentForecast = locationData.weather.hourly.find(f => new Date(f.date).getHours() === currentHour) || locationData.weather.hourly[0];

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
                moonPhase: locationData.weather.moon.phase,
                tideHeight: currentForecast.tideHeight,
                tideMovement: getTideMovement(),
                tideCurrent: currentForecast.tideCurrent,
                weatherCondition: currentForecast.condition,
                windSpeed: currentForecast.windSpeed,
                windDirection: currentForecast.windDirection,
                airTemperature: currentForecast.temp,
                waterTemperature: locationData.weather.waterTemperature,
            }
        };

        try {
            await addDoc(collection(firestore, 'users', user.uid, 'fishing_spots'), newSpotData);
            toast({ title: 'Spot sauvegardé !' });
            setIsAddSpotOpen(false);
            setNewSpotLocation(null);
            setSpotName('');
            setSpotNotes('');
            setSelectedFishingTypes([]);
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du spot :", error);
            toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de sauvegarder le spot." });
        } finally {
            setIsSaving(false);
        }
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
                : [...prev, id]
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
                            {savedSpots?.map(spot => (
                                <React.Fragment key={spot.id}>
                                    <MarkerF 
                                        position={{ lat: spot.location.latitude, lng: spot.location.longitude }}
                                        icon={{
                                            url: createMarkerIconSvg(spot.color, spot.icon as keyof typeof mapIcons),
                                            scaledSize: new window.google.maps.Size(32, 32),
                                            anchor: new window.google.maps.Point(16, 16),
                                        }}
                                    />
                                    <OverlayView
                                        position={{ lat: spot.location.latitude, lng: spot.location.longitude }}
                                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                    >
                                        <div 
                                            style={{ transform: 'translate(-50%, -150%)' }} 
                                            className="flex flex-col items-center gap-1"
                                        >
                                            <div className="flex flex-col items-center gap-1 px-2 py-1 bg-card/90 border border-border rounded-md shadow text-xs font-bold text-card-foreground whitespace-nowrap">
                                                <span>{spot.name}</span>
                                                {spot.fishingTypes && spot.fishingTypes.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {spot.fishingTypes.map(type => {
                                                            const typeInfo = fishingTypes.find(t => t.id === type);
                                                            return (
                                                                <Badge key={type} variant="secondary" className={cn("text-xs px-1.5 py-0 text-white", typeInfo?.color)}>
                                                                    {type}
                                                                </Badge>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </OverlayView>
                                </React.Fragment>
                            ))}
                            {newSpotLocation && (
                                <MarkerF 
                                    position={newSpotLocation}
                                    draggable={true}
                                    onDragEnd={handleNewSpotDragEnd}
                                />
                            )}
                        </GoogleMap>
                        <Button size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-2 left-2 shadow-lg h-9 w-9 z-10">
                            {isFullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
                        </Button>
                        <Button size="icon" onClick={handleRecenter} className="absolute top-2 right-2 shadow-lg h-9 w-9 z-10">
                            <LocateFixed className="h-5 w-5" />
                        </Button>
                        <div className={cn("absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-2rem)] max-w-sm")}>
                            <Button 
                                className="shadow-lg w-full" 
                                onClick={() => { if (newSpotLocation) setIsAddSpotOpen(true); }}
                                disabled={!newSpotLocation}
                            >
                                <Plus className="mr-2" /> 
                                {newSpotLocation ? 'Ajouter ce coin de pêche' : 'Cliquez sur la carte pour placer un repère'}
                            </Button>
                        </div>
                    </div>
                )}
                
                <Dialog open={isAddSpotOpen} onOpenChange={setIsAddSpotOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Enregistrer un nouveau spot</DialogTitle>
                            <DialogDescription>
                                Remplissez les détails et sauvegardez pour ajouter ce spot à votre carnet.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="spot-name">Nom du spot</Label>
                                <Input id="spot-name" placeholder="Ex: Spot à bec de cane" value={spotName} onChange={(e) => setSpotName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="spot-notes">Notes</Label>
                                <Textarea id="spot-notes" placeholder="Ex: Pris à la traîne avec un leurre rouge" value={spotNotes} onChange={(e) => setSpotNotes(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Techniques de pêche</Label>
                                <div className="flex flex-wrap gap-2">
                                    {fishingTypes.map((type) => {
                                        const isSelected = selectedFishingTypes.includes(type.id);
                                        return (
                                            <Button
                                                key={type.id}
                                                variant={isSelected ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => handleToggleFishingType(type.id)}
                                                className={cn(isSelected && `${type.color} hover:${type.color}/90 text-white`)}
                                            >
                                                {type.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Icône</Label>
                                <div className="flex gap-2">
                                    {availableIcons.map(iconName => {
                                        const Icon = mapIcons[iconName as keyof typeof mapIcons];
                                        return (
                                            <Button key={iconName} variant="outline" size="icon" onClick={() => setSelectedIcon(iconName as keyof typeof mapIcons)} className={cn(selectedIcon === iconName && "ring-2 ring-primary")}>
                                                <Icon className="size-5" />
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Couleur</Label>
                                <div className="flex gap-2">
                                    {availableColors.map(color => (
                                        <button key={color} onClick={() => setSelectedColor(color)} className={cn("w-8 h-8 rounded-full border-2", selectedColor === color ? "border-primary ring-2 ring-primary" : "border-transparent")} style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => { setIsAddSpotOpen(false); setNewSpotLocation(null); setSelectedFishingTypes([]); }}>Annuler</Button>
                            <Button onClick={handleSaveSpot} disabled={isSaving}><Save className="mr-2"/>{isSaving ? "Sauvegarde..." : "Sauvegarder"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {!isFullscreen && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Button 
                                variant="outline" 
                                className="flex-1" 
                                onClick={handleAnalyzeNext7Days}
                                disabled={selectedSpotIds.length === 0 || isAnalyzing}
                            >
                                <BarChart className="mr-2"/> 
                                Analyser {selectedSpotIds.length > 0 ? `(${selectedSpotIds.length}) spot(s)` : ''} pour les 7 prochains jours (IA)
                            </Button>
                        </div>
                        <h4 className="font-semibold text-lg mb-2">Historique des prises</h4>
                        {areSpotsLoading && <Skeleton className="h-24 w-full" />}
                        {!areSpotsLoading && savedSpots && savedSpots.length > 0 ? (
                            <AccordionPrimitive.Root type="single" collapsible className="w-full">
                               {savedSpots.map(spot => (
                                   <AccordionPrimitive.Item value={spot.id} key={spot.id} className="border-b">
                                       <AccordionPrimitive.Header className="flex items-center w-full">
                                            <span className="pl-4 py-4" onClick={(e) => e.stopPropagation()}>
                                               <Checkbox
                                                   id={`select-spot-${spot.id}`}
                                                   className="size-5"
                                                   checked={selectedSpotIds.includes(spot.id)}
                                                   onCheckedChange={() => handleSpotSelection(spot.id)}
                                               />
                                           </span>
                                           <AccordionPrimitive.Trigger className={cn("flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180", "pr-4")}>
                                               <div className="flex items-center gap-3">
                                                   <div className="p-1 rounded-md" style={{backgroundColor: spot.color + '20'}}>
                                                       {React.createElement(mapIcons[spot.icon as keyof typeof mapIcons] || MapPin, { className: 'size-5', style: {color: spot.color} })}
                                                   </div>
                                                   <div>
                                                       <p className="font-bold text-left">{spot.name}</p>
                                                        <p className="text-xs text-muted-foreground text-left">
                                                          {spot.createdAt ? format(spot.createdAt.toDate(), 'dd MMMM yyyy à HH:mm', { locale: fr }) : 'Enregistrement...'}
                                                        </p>
                                                   </div>
                                               </div>
                                               <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                           </AccordionPrimitive.Trigger>
                                       </AccordionPrimitive.Header>
                                       <AccordionPrimitive.Content className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                                           <div className="pb-4 pl-12 pr-4 space-y-4">
                                            {spot.fishingTypes && spot.fishingTypes.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {spot.fishingTypes.map(type => (
                                                        <Badge key={type} variant="secondary">{type}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                           <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg space-y-2">
                                               {spot.notes && <p className="italic">"{spot.notes}"</p>}
                                                <p><strong>Conditions :</strong> {spot.context.weatherCondition}, {spot.context.airTemperature}°C (air), {spot.context.waterTemperature}°C (eau)</p>
                                                <p><strong>Vent :</strong> {spot.context.windSpeed} nœuds de {spot.context.windDirection}</p>
                                                <p><strong>Lune :</strong> {spot.context.moonPhase}</p>
                                                <p><strong>Marée :</strong> {spot.context.tideMovement} ({spot.context.tideHeight.toFixed(2)}m), courant {spot.context.tideCurrent.toLowerCase()}</p>
                                           </div>
                                           <div className="flex flex-col sm:flex-row gap-2">
                                               <Button variant="outline" className="flex-1" onClick={() => handleFindSimilarDay(spot)} disabled={isAnalyzing}><BrainCircuit className="mr-2"/> Chercher un jour similaire (IA)</Button>
                                               <Button variant="destructive" size="icon" onClick={() => handleDeleteSpot(spot.id)}><Trash2 /></Button>
                                           </div>
                                           </div>
                                       </AccordionPrimitive.Content>
                                   </AccordionPrimitive.Item>
                               ))}
                            </AccordionPrimitive.Root>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Aucun spot sauvegardé pour le moment.</p>
                        )}
                    </div>
                )}

                <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <BrainCircuit /> Analyse de l'IA
                            </DialogTitle>
                            <DialogDescription>
                                L'intelligence artificielle recherche les meilleures opportunités de pêche pour vous.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            {isAnalyzing && (
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <p className="text-sm text-muted-foreground">Analyse des marées, de la lune et de la météo...</p>
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-4/5" />
                                    <Skeleton className="h-4 w-full" />
                                </div>
                            )}
                            {analysisResult && (
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Meilleur jour recommandé</p>
                                        <p className="text-2xl font-bold text-primary">
                                            {format(new Date(analysisResult.bestDate.replace(/-/g, '/')), 'eeee d MMMM', { locale: fr })}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="confidence-score">Score de confiance</Label>
                                        <Progress value={analysisResult.score} id="confidence-score" />
                                        <p className="text-xs text-right text-muted-foreground">{analysisResult.score}%</p>
                                    </div>
                                    <div className="p-3 bg-muted/50 rounded-lg max-h-60 overflow-y-auto">
                                        <h4 className="font-semibold mb-2">Explication de l'IA</h4>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.explanation}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAnalysisDialogOpen(false)}>Fermer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

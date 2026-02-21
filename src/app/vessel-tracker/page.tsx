'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
import { GoogleMap, OverlayView, Polyline, Circle } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  AlertTriangle,
  BatteryFull, 
  History as HistoryIcon, 
  MapPin, 
  X, 
  Play, 
  RefreshCw, 
  Home, 
  Settings, 
  Smartphone, 
  Bird, 
  Target, 
  Fish, 
  Camera, 
  Ghost, 
  Users, 
  Phone, 
  Waves, 
  Lock, 
  Unlock, 
  Save, 
  Battery,
  MessageSquare,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  WifiOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

export default function VesselTrackerPage() {
  const [appMode, setAppMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const { toast } = useToast();
  
  const mapCore = useMapCore();
  const emetteur = useEmetteur(
    mapCore.updateBreadcrumbs,
    () => mapCore.clearBreadcrumbs() // Callback cleanup à l'arrêt
  );
  const recepteur = useRecepteur(emetteur.customSharingId);
  const flotte = useFlotte(emetteur.customSharingId, emetteur.vesselNickname);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation LED Sync
  const [isLedActive, setIsLedActive] = useState(false);
  useEffect(() => {
    if (emetteur.lastSyncTime > 0) {
      setIsLedActive(true);
      const timer = setTimeout(() => setIsLedActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emetteur.lastSyncTime]);

  const handleRecenterTo = (pos: { lat: number, lng: number }) => {
      mapCore.handleRecenter(pos);
      if (mapCore.isFullscreen) {
          toast({ title: "Position centrée" });
      }
  };

  const handleClearTrace = () => {
    mapCore.clearBreadcrumbs();
    emetteur.addTechLog('TRACE RESET', 'Trace de parcours réinitialisée par l\'utilisateur');
    toast({ title: "Trace effacée" });
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {/* SÉLECTEUR DE MODE GLOBAL */}
      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <Button 
            variant={appMode === 'sender' ? 'default' : 'ghost'} 
            className="flex-1 font-black uppercase text-[9px] sm:text-[10px] h-12 px-1" 
            onClick={() => setAppMode('sender')}
          >
            Émetteur (A)
          </Button>
          <Button 
            variant={appMode === 'receiver' ? 'default' : 'ghost'} 
            className="flex-1 font-black uppercase text-[9px] sm:text-[10px] h-12 px-1" 
            onClick={() => setAppMode('receiver')}
          >
            Récepteur (B)
          </Button>
          <Button 
            variant={appMode === 'fleet' ? 'default' : 'ghost'} 
            className="flex-1 font-black uppercase text-[9px] sm:text-[10px] h-12 px-1" 
            onClick={() => setAppMode('fleet')}
          >
            Flotte (C)
          </Button>
      </div>

      {/* SÉLECTEUR DE MODE CARTE */}
      <div className="flex bg-muted/30 p-1 rounded-xl border relative z-20">
          <Button variant={mapCore.viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('alpha')}>Maps</Button>
          <Button variant={mapCore.viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('beta')}>Météo</Button>
          <Button variant={mapCore.viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('gamma')}>Windy</Button>
      </div>

      {/* CONTENEUR CARTE */}
      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        {mapCore.isGoogleLoaded && (
            <GoogleMap
                mapContainerClassName="w-full h-full"
                defaultCenter={INITIAL_CENTER}
                defaultZoom={12}
                onLoad={mapCore.setGoogleMap}
                onDragStart={() => mapCore.setIsFollowMode(false)}
                options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
            >
                {/* POSITION RÉELLE */}
                {emetteur.currentPos && (
                    <OverlayView position={emetteur.currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }} className="relative">
                            <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                            <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
                                <Navigation className="size-3 text-white fill-white" />
                            </div>
                        </div>
                    </OverlayView>
                )}

                {/* BREADCRUMBS (REF STOCKÉE) */}
                {mapCore.breadcrumbs.length > 1 && (
                    <Polyline 
                        path={mapCore.breadcrumbs} 
                        onLoad={(p) => mapCore.polylineRef.current = p}
                        options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} 
                    />
                )}

                {/* MOUILLAGE ACTIF (REF STOCKÉE) */}
                {emetteur.anchorPos && (
                    <>
                        <OverlayView position={emetteur.anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                                <Anchor className="size-4 text-white" />
                            </div>
                        </OverlayView>
                        <Circle 
                            center={emetteur.anchorPos} 
                            radius={emetteur.mooringRadius} 
                            onLoad={(c) => emetteur.anchorCircleRef.current = c}
                            options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, strokeWeight: 1 }} 
                        />
                    </>
                )}
            </GoogleMap>
        )}
        
        {/* BOUTONS FLOTTANTS TACTIQUES */}
        <div className="absolute top-4 left-4 z-[200] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>
                {mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
        </div>
        <div className="absolute top-4 right-4 z-[200] flex flex-col gap-2">
            <Button 
                onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} 
                className={cn("h-10 w-10 border-2 shadow-xl", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}
            >
                {mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!mapCore.isFollowMode && (
                <Button 
                    onClick={() => mapCore.handleRecenter(emetteur.currentPos)} 
                    className="bg-white border-2 font-black text-[9px] uppercase gap-2 px-2 h-10 text-primary shadow-xl"
                >
                    <LocateFixed className="size-4"/> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      {/* PANNEAUX DE CONTRÔLE */}
      <div className="grid grid-cols-1 gap-4">
          {appMode === 'sender' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                      <CardHeader className="bg-primary/5 p-4 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <Navigation className="size-4 text-primary" /> Identité & Partage GPS
                            </CardTitle>
                            {emetteur.isSharing && (
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "size-2.5 rounded-full bg-green-500 transition-all shadow-sm",
                                        isLedActive ? "opacity-100 scale-125 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "opacity-30 scale-100"
                                    )} />
                                    <span className="text-[8px] font-black text-green-600 uppercase">Sync Active</span>
                                </div>
                            )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                          {!emetteur.isSharing ? (
                              <div className="space-y-4">
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Surnom du Navire</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-11 border-2 font-black uppercase" /></div>
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Navire (Partage Direct)</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ID UNIQUE" className="h-11 border-2 font-black uppercase text-center tracking-widest" /></div>
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Flotte C (Communautaire)</Label><Input value={emetteur.customFleetId} onChange={e => emetteur.setCustomFleetId(e.target.value)} placeholder="ID GROUPE" className="h-11 border-2 font-black uppercase text-center tracking-widest" /></div>
                                  <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-base" onClick={emetteur.startSharing}>Lancer le Partage GPS</Button>
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  <div className="p-4 bg-primary/10 rounded-xl border-2 border-primary/20 flex flex-col items-center text-center gap-1">
                                      <p className="text-[10px] font-black uppercase text-primary">Navire en cours de partage</p>
                                      <p className="text-xl font-black uppercase">{emetteur.sharingId}</p>
                                      <Badge variant="outline" className="bg-green-500 text-white border-none text-[8px] animate-pulse">EN LIGNE</Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-indigo-50 text-indigo-700 shadow-sm" onClick={() => emetteur.setManualStatus('returning', 'RETOUR MAISON')}>
                                        <Navigation className="size-4 mr-2" /> Retour Maison
                                      </Button>
                                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-green-50 text-green-700 shadow-sm" onClick={() => emetteur.setManualStatus('landed', 'À TERRE')}>
                                        <Home className="size-4 mr-2" /> Home (À terre)
                                      </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                      <Button 
                                        variant={emetteur.vesselStatus === 'stationary' ? 'default' : 'outline'} 
                                        className={cn("h-14 font-black uppercase text-[10px] border-2", emetteur.vesselStatus === 'stationary' ? "bg-orange-500 text-white border-orange-600" : "bg-white text-orange-600 border-orange-200")} 
                                        onClick={emetteur.toggleAnchor}
                                      >
                                        <Anchor className="size-4 mr-2" /> {emetteur.vesselStatus === 'stationary' ? 'Mouillage Actif' : 'Activer Mouillage'}
                                      </Button>
                                      <div className="p-2 border-2 rounded-xl bg-muted/10 space-y-1">
                                          <Label className="text-[8px] font-black uppercase opacity-60">Rayon Dérive: {emetteur.mooringRadius}m</Label>
                                          <Slider value={[emetteur.mooringRadius]} min={10} max={200} step={10} onValueChange={v => emetteur.setMooringRadius(v[0])} />
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-4 gap-2">
                                      <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => emetteur.addTacticalLog('THON')}>
                                        <Target className="size-4 text-red-600"/> THON
                                      </Button>
                                      <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => emetteur.addTacticalLog('TAZARD')}>
                                        <Fish className="size-4 text-emerald-600"/> TAZARD
                                      </Button>
                                      <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => emetteur.addTacticalLog('OISEAUX')}>
                                        <Bird className="size-4 text-slate-500"/> OISEAUX
                                      </Button>
                                      <Button variant="secondary" className="h-12 flex-col gap-1 font-black text-[8px] border-2 shadow-sm" onClick={() => photoInputRef.current?.click()}>
                                        <Camera className="size-4 text-primary"/> PRISE
                                      </Button>
                                  </div>

                                  <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl border-2 border-white/20" onClick={emetteur.stopSharing}>
                                    <X className="size-5 mr-2" /> Arrêter le partage
                                  </Button>
                              </div>
                          )}
                      </CardContent>
                  </Card>

                  {/* JOURNAL DE BORD ÉMETTEUR */}
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden bg-white z-30 relative">
                      <CardHeader className="bg-slate-100 p-4 border-b">
                          <CardTitle className="text-xs font-black uppercase flex items-center justify-between">
                              <div className="flex items-center gap-2"><HistoryIcon className="size-4 text-primary" /> Journal de Bord</div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" className="h-7 text-[8px] font-black uppercase border-primary/30 text-primary gap-1 px-2" onClick={handleClearTrace}>
                                    <Waves className="size-2.5" /> Effacer Trace
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/40 hover:text-destructive" onClick={emetteur.clearLogs}><Trash2 className="size-3" /></Button>
                              </div>
                          </CardTitle>
                      </CardHeader>
                      <Tabs defaultValue="tech">
                          <TabsList className="grid grid-cols-2 h-10 border-b bg-muted/20">
                              <TabsTrigger value="tech" className="text-[10px] font-black uppercase">Technique</TabsTrigger>
                              <TabsTrigger value="tact" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                          </TabsList>
                          <TabsContent value="tech" className="p-0">
                              <ScrollArea className="h-48">
                                  <div className="p-3 space-y-2">
                                      {emetteur.techLogs.length > 0 ? emetteur.techLogs.map((log, i) => (
                                          <div key={i} className="p-2 bg-slate-50 border-2 rounded-xl flex items-center justify-between shadow-sm text-[9px] font-bold">
                                              <div className="flex flex-col">
                                                  <span className="text-primary font-black uppercase">{log.label}</span>
                                                  <span className="text-[8px] opacity-60 uppercase">{log.details}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  <span className="opacity-40">{format(new Date(log.time), 'HH:mm:ss')}</span>
                                                  <div className="flex items-center gap-1 bg-white px-1.5 rounded border shadow-inner">
                                                      <Battery className="size-2.5" /> {log.battery}%
                                                  </div>
                                              </div>
                                          </div>
                                      )) : <p className="py-10 text-center text-[10px] font-black uppercase opacity-20 italic tracking-widest">Boîte noire vide</p>}
                                  </div>
                              </ScrollArea>
                          </TabsContent>
                          <TabsContent value="tact" className="p-0">
                              <ScrollArea className="h-48">
                                  <div className="p-3 space-y-2">
                                      {emetteur.tacticalLogs.length > 0 ? emetteur.tacticalLogs.map((log, i) => (
                                          <div 
                                            key={i} 
                                            onClick={() => handleRecenterTo(log.pos)}
                                            className="p-3 bg-white border-2 rounded-xl flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition-all"
                                          >
                                              <div className="flex items-center gap-3">
                                                  <div className="p-1.5 bg-primary/10 rounded-lg"><Target className="size-3.5 text-primary" /></div>
                                                  <div className="flex flex-col">
                                                      <span className="font-black text-[10px] uppercase text-slate-800">{log.type}</span>
                                                      <span className="text-[8px] opacity-40 uppercase">{format(new Date(log.time), 'HH:mm')} • GPS OK</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  {log.photoUrl && <div className="size-8 rounded border overflow-hidden shadow-sm"><img src={log.photoUrl} className="w-full h-full object-cover" /></div>}
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border-2"><ChevronDown className="size-3 -rotate-90" /></Button>
                                              </div>
                                          </div>
                                      )) : <p className="py-10 text-center text-[10px] font-black uppercase opacity-20 italic tracking-widest">Aucune prise enregistrée</p>}
                                  </div>
                              </ScrollArea>
                          </TabsContent>
                      </Tabs>
                  </Card>

                  <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="id-history" className="border-none">
                          <AccordionTrigger className="h-12 bg-white px-4 rounded-xl border-2 shadow-sm hover:no-underline">
                              <div className="flex items-center gap-2 font-black uppercase text-[10px] text-slate-700">
                                <HistoryIcon className="size-4 text-primary" /> Historique des IDs
                              </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 space-y-2">
                              <div className="grid grid-cols-1 gap-2 p-2 bg-muted/10 rounded-xl">
                                  <p className="text-[8px] font-black uppercase text-muted-foreground ml-1">Derniers navires</p>
                                  {emetteur.vesselHistory.map(id => (
                                      <div key={id} className="flex items-center justify-between p-2 bg-white border rounded-lg shadow-sm">
                                          <code className="text-xs font-black text-primary">{id}</code>
                                          <div className="flex gap-1">
                                              <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => emetteur.setCustomSharingId(id)}>Utiliser</Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => emetteur.deleteFromHistory(id)}><Trash2 className="size-3" /></Button>
                                          </div>
                                      </div>
                                  ))}
                                  {emetteur.vesselHistory.length === 0 && <p className="text-center py-4 text-[9px] italic opacity-40">Aucun historique</p>}
                              </div>
                          </AccordionContent>
                      </AccordionItem>
                  </Accordion>
              </div>
          )}

          {appMode === 'receiver' && (
              <div className="space-y-4 animate-in fade-in">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden min-h-[400px]">
                      <Tabs defaultValue="tech">
                          <TabsList className="grid grid-cols-2 h-12 bg-muted/30 border-b">
                              <TabsTrigger value="tech" className="font-black uppercase text-[10px]">Technique</TabsTrigger>
                              <TabsTrigger value="pref" className="font-black uppercase text-[10px]">Réglages</TabsTrigger>
                          </TabsList>
                          <TabsContent value="tech" className="p-0 m-0">
                              <ScrollArea className="h-[350px]">
                                  <div className="p-3 space-y-2">
                                      {recepteur.techLogs.length > 0 ? recepteur.techLogs.map((log, i) => (
                                          <div key={i} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between shadow-sm">
                                              <div className="flex flex-col">
                                                <span className="font-black text-[10px] uppercase text-primary">{log.status}</span>
                                                <span className="text-[8px] font-bold opacity-40">{log.time ? format(log.time.toDate(), 'HH:mm:ss') : '...'}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  <span className="text-[9px] font-black">{log.batteryLevel}%</span>
                                                  <BatteryIcon level={log.batteryLevel / 100} charging={log.isCharging} />
                                              </div>
                                          </div>
                                      )) : <div className="py-20 text-center opacity-20"><RefreshCw className="size-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Attente de données...</p></div>}
                                  </div>
                              </ScrollArea>
                          </TabsContent>
                          <TabsContent value="pref" className="p-4 space-y-4">
                              <div className="space-y-4">
                                  <Label className="text-[10px] font-black uppercase">Volume alertes</Label>
                                  <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} onValueChange={v => recepteur.savePrefs({ volume: v[0] / 100 })} />
                                  <div className="grid gap-2">
                                      {Object.keys(recepteur.vesselPrefs.sounds).map(key => (
                                          <div key={key} className="flex items-center justify-between p-2 bg-muted/10 rounded-lg">
                                              <span className="text-[10px] font-black uppercase">{key}</span>
                                              <Switch checked={recepteur.vesselPrefs.notifyEnabled} onCheckedChange={v => recepteur.savePrefs({ notifyEnabled: v })} />
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </TabsContent>
                      </Tabs>
                  </Card>
              </div>
          )}

          {appMode === 'fleet' && (
              <div className="space-y-4 animate-in fade-in">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden min-h-[400px]">
                      <CardHeader className="bg-slate-900 text-white p-4">
                          <CardTitle className="text-xs font-black uppercase">Journal Tactique Flotte</CardTitle>
                      </CardHeader>
                      <ScrollArea className="h-[350px]">
                          <div className="p-3 space-y-3">
                              {flotte.tacticalLogs.map((log, i) => (
                                  <div key={i} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between shadow-sm">
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-primary/10 rounded-lg"><Fish className="size-4 text-primary"/></div>
                                          <div className="flex flex-col">
                                              <span className="font-black text-xs uppercase text-primary">{log.type}</span>
                                              <span className="text-[8px] font-bold opacity-40 uppercase">{log.sender}</span>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[10px] font-black text-blue-600">{log.wind} ND</p>
                                          <p className="text-[8px] font-bold opacity-40">{log.time ? format(log.time.toDate(), 'HH:mm') : '...'}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </ScrollArea>
                  </Card>
              </div>
          )}
      </div>

      <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => emetteur.addTacticalLog('PHOTO', ev.target?.result as string);
              reader.readAsDataURL(file);
          }
      }} />

      {/* ANNUAIRE */}
      <Card className="border-2 shadow-sm bg-muted/5">
          <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Phone className="size-3" /> Annuaire Maritime NC</CardTitle></CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</p><p className="text-xs font-black">COSS Mer : 16</p><p className="text-xs font-black">SAMU Terre : 15</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</p><p className="text-xs font-black">Météo Marine : 36 67 36</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">VHF</p><p className="text-xs font-black">Port Autonome : Canal 12</p></div>
          </CardContent>
      </Card>
    </div>
  );
}

function BatteryIcon({ level, charging }: { level: number; charging: boolean }) {
  const props = { className: 'w-4 h-4' };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level < 0.2) return <BatteryLow {...props} className="text-red-500" />;
  if (level < 0.6) return <BatteryMedium {...props} className="text-amber-500" />;
  return <BatteryFull {...props} className="text-green-500" />;
}

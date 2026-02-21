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
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

export default function VesselTrackerPage() {
  const [appMode, setAppMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  
  // 1. Initialisation des pôles isolés (Protection v40)
  const mapCore = useMapCore();
  const emetteur = useEmetteur(mapCore.updateBreadcrumbs);
  const recepteur = useRecepteur(emetteur.customSharingId);
  const flotte = useFlotte(emetteur.customSharingId, emetteur.vesselNickname);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Forcer le redimensionnement de la carte lors du changement de mode
  useEffect(() => {
    if (mapCore.googleMap) {
        setTimeout(() => {
            google.maps.event.trigger(mapCore.googleMap, 'resize');
        }, 300);
    }
  }, [mapCore.viewMode, mapCore.googleMap]);

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {/* SÉLECTEUR DE MODE GLOBAL - RESTAURATION FLOTTE (C) */}
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
          <Button variant={mapCore.viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('alpha')}>Alpha</Button>
          <Button variant={mapCore.viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('beta')}>Béta</Button>
          <Button variant={mapCore.viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('gamma')}>Gamma</Button>
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
                {/* POSITION RÉELLE (ÉMETTEUR) */}
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

                {/* BREADCRUMBS (Trace 30 min) */}
                {mapCore.breadcrumbs.length > 1 && (
                    <Polyline path={mapCore.breadcrumbs} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} />
                )}

                {/* MOUILLAGE ACTIF */}
                {emetteur.anchorPos && (
                    <>
                        <OverlayView position={emetteur.anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg"><Anchor className="size-4 text-white" /></div>
                        </OverlayView>
                        <Circle center={emetteur.anchorPos} radius={emetteur.mooringRadius} options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, strokeWeight: 1 }} />
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

      {/* PANNEAUX DE CONTRÔLE SELON MODE */}
      <div className="grid grid-cols-1 gap-4">
          {appMode === 'sender' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                  {emetteur.isSharing ? (
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-indigo-50 text-indigo-700 shadow-sm" onClick={() => emetteur.setManualStatus('returning', 'RETOUR MAISON')}>
                                <Navigation className="size-4 mr-2" /> Retour Maison
                              </Button>
                              <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-green-50 text-green-700 shadow-sm" onClick={() => emetteur.setManualStatus('landed', 'À TERRE')}>
                                <Home className="size-4 mr-2" /> Home (À terre)
                              </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <Button variant="destructive" className="h-14 font-black text-[10px] shadow-lg" onClick={() => flotte.triggerEmergency('MAYDAY', emetteur.emergencyContact, emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>MAYDAY</Button>
                              <Button variant="secondary" className="h-14 font-black text-[10px] border-2 border-orange-200 shadow-lg" onClick={() => flotte.triggerEmergency('PANPAN', emetteur.emergencyContact, emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>PANPAN</Button>
                              <Button variant="outline" className="h-14 font-black text-[10px] bg-red-50 text-red-600 animate-pulse border-2 shadow-lg" onClick={() => emetteur.setManualStatus('emergency', 'ASSISTANCE')}>ASSISTANCE</Button>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                              <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => flotte.addTacticalLog('THON', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>
                                <Target className="size-4 text-red-600"/> THON
                              </Button>
                              <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => flotte.addTacticalLog('TAZARD', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>
                                <Fish className="size-4 text-emerald-600"/> TAZARD
                              </Button>
                              <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => flotte.addTacticalLog('OISEAUX', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>
                                <Bird className="size-4 text-slate-500"/> OISEAUX
                              </Button>
                              <Button variant="secondary" className="h-12 flex-col gap-1 font-black text-[8px] border-2 shadow-sm" onClick={() => photoInputRef.current?.click()}>
                                <Camera className="size-4 text-primary"/> PRISE
                              </Button>
                          </div>
                          
                          <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => flotte.addTacticalLog('PHOTO', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0, ev.target?.result as string);
                                  reader.readAsDataURL(file);
                              }
                          }} />
                          
                          <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl border-2 border-white/20" onClick={emetteur.stopSharing}>
                            <X className="size-5 mr-2" /> Arrêter le partage
                          </Button>
                      </div>
                  ) : (
                      <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                          <CardHeader className="bg-primary/5 p-4 border-b">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <Navigation className="size-4 text-primary" /> Identité & Partage GPS
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Surnom du Navire</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: BLACK PEARL" className="h-11 border-2 font-black uppercase" /></div>
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Navire (Partage Direct)</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ID UNIQUE" className="h-11 border-2 font-black uppercase text-center tracking-widest" /></div>
                              <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl" onClick={emetteur.startSharing}>Lancer le Partage GPS</Button>
                          </CardContent>
                      </Card>
                  )}
              </div>
          )}

          {appMode === 'receiver' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
                      <Tabs defaultValue="tech" className="flex flex-col h-full">
                          <TabsList className="grid grid-cols-2 h-12 bg-muted/30 border-b">
                              <TabsTrigger value="tech" className="font-black uppercase text-[10px] gap-2"><Battery className="size-3" /> Technique</TabsTrigger>
                              <TabsTrigger value="pref" className="font-black uppercase text-[10px] gap-2"><Settings className="size-3" /> Réglages</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="tech" className="flex-1 p-0 m-0">
                              <ScrollArea className="h-[350px]">
                                  <div className="p-3 space-y-2">
                                      <div className="flex items-center justify-between px-1 mb-2">
                                          <span className="text-[9px] font-black uppercase text-muted-foreground">Historique Télémétrie</span>
                                          <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-destructive border-2 border-dashed" onClick={mapCore.clearBreadcrumbs}>Vider trace</Button>
                                      </div>
                                      {recepteur.techLogs.length > 0 ? recepteur.techLogs.map((log, i) => (
                                          <div key={i} className="p-3 bg-slate-50 border-2 rounded-xl flex items-center justify-between shadow-sm">
                                              <div className="flex flex-col">
                                                <span className={cn("font-black text-[10px] uppercase", 
                                                    log.status === 'stationary' ? 'text-orange-600' : 
                                                    log.status === 'moving' ? 'text-blue-600' : 'text-slate-600'
                                                )}>
                                                    {log.status === 'stationary' ? 'AU MOUILLAGE' : 'EN MOUVEMENT'}
                                                </span>
                                                <span className="text-[8px] font-bold opacity-40 uppercase">{log.time ? format(log.time.toDate(), 'HH:mm:ss', {locale: fr}) : '...'}</span>
                                              </div>
                                              <div className="text-right flex items-center gap-3">
                                                  <div className="flex flex-col items-end">
                                                      <span className="text-[9px] font-black text-slate-500">ACC: {log.accuracy || '0'}m</span>
                                                      <div className="flex items-center gap-1.5">
                                                          <span className="text-[9px] font-black">{log.batteryLevel}%</span>
                                                          <Battery className={cn("size-3", log.batteryLevel < 20 ? "text-red-500" : "text-green-600")} />
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      )) : (
                                          <div className="py-20 text-center opacity-20 flex flex-col items-center">
                                              <RefreshCw className="size-8 mb-2" />
                                              <p className="text-[10px] font-black uppercase">En attente de données...</p>
                                          </div>
                                      )}
                                  </div>
                              </ScrollArea>
                          </TabsContent>

                          <TabsContent value="pref" className="p-4 space-y-6">
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase">Volume alertes</Label><span className="text-[10px] font-black">{Math.round(recepteur.vesselPrefs.volume * 100)}%</span></div>
                                  <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} onValueChange={v => recepteur.savePrefs({ volume: v[0] / 100 })} />
                                  <div className="grid gap-2 pt-2">
                                      {Object.keys(recepteur.vesselPrefs.sounds).map(key => (
                                          <div key={key} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border">
                                              <span className="text-[10px] font-black uppercase">{key}</span>
                                              <div className="flex items-center gap-3">
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 border bg-white" onClick={() => recepteur.playSound(recepteur.vesselPrefs.sounds[key as keyof typeof recepteur.vesselPrefs.sounds])}><Play className="size-3 text-primary" /></Button>
                                                  <Switch checked={recepteur.vesselPrefs.notifyEnabled} onCheckedChange={v => recepteur.savePrefs({ notifyEnabled: v })} />
                                              </div>
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
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden min-h-[400px] flex flex-col">
                      <CardHeader className="bg-slate-900 text-white p-4">
                          <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                              <Users className="size-4 text-primary" /> Journal Tactique de Flotte
                          </CardTitle>
                      </CardHeader>
                      <ScrollArea className="flex-1">
                          <div className="p-3 space-y-3">
                              {flotte.tacticalLogs.length > 0 ? flotte.tacticalLogs.map((log, i) => (
                                  <div key={i} onClick={() => mapCore.handleRecenter({ lat: log.lat, lng: log.lng })} className="p-3 bg-white border-2 rounded-2xl flex items-center justify-between cursor-pointer active:scale-95 shadow-sm hover:border-primary/30 transition-all">
                                      <div className="flex items-center gap-3">
                                          {log.photoUrl ? (
                                              <div className="size-12 rounded-xl border overflow-hidden shadow-inner">
                                                  <img src={log.photoUrl} className="size-full object-cover" alt=""/>
                                              </div>
                                          ) : (
                                              <div className="p-2.5 bg-primary/10 rounded-xl">
                                                  <Fish className="size-5 text-primary"/>
                                              </div>
                                          )}
                                          <div className="flex flex-col">
                                              <div className="flex items-center gap-2">
                                                  <span className="font-black text-xs uppercase text-primary">{log.type}</span>
                                                  <Badge variant="outline" className="text-[7px] font-black uppercase h-3.5 px-1">{log.sender}</Badge>
                                              </div>
                                              <span className="text-[8px] font-bold opacity-40 uppercase">{log.time ? format(log.time.toDate(), 'HH:mm', {locale: fr}) : '...'}</span>
                                          </div>
                                      </div>
                                      <div className="text-right border-l pl-3 border-dashed">
                                          <p className="text-[10px] font-black text-blue-600">{log.wind} ND</p>
                                          <p className="text-[10px] font-black text-orange-600">{log.temp}°C</p>
                                      </div>
                                  </div>
                              )) : (
                                  <div className="py-24 text-center opacity-20 flex flex-col items-center">
                                      <HistoryIcon className="size-10 mb-2" />
                                      <p className="text-[10px] font-black uppercase tracking-widest">Aucune prise partagée</p>
                                  </div>
                              )}
                          </div>
                      </ScrollArea>
                  </Card>
              </div>
          )}
      </div>

      {/* ACCORDÉON RÉGLAGES SYSTÈME (A & B) */}
      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="prefs" className="border-none">
              <AccordionTrigger className="h-14 bg-white px-4 rounded-2xl border-2 shadow-sm hover:no-underline">
                  <div className="flex items-center gap-2 font-black uppercase text-[10px] text-slate-700">
                    <Settings className="size-4 text-primary" /> Sons, Rayon & SMS d'Urgence
                  </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <Card className="border-2 p-5 space-y-6 bg-white rounded-3xl shadow-inner">
                      {/* MOUILLAGE (Émetteur uniquement) */}
                      {appMode === 'sender' && (
                          <div className="space-y-4 pb-4 border-b border-dashed">
                              <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                                    <Anchor className="size-3" /> Rayon de Mouillage
                                </Label>
                                <Badge variant="outline" className="font-black bg-primary/5 text-primary border-primary/20">{emetteur.mooringRadius}m</Badge>
                              </div>
                              <Slider value={[emetteur.mooringRadius]} min={10} max={200} step={10} onValueChange={v => emetteur.setMooringRadius(v[0])} />
                              <p className="text-[8px] font-bold text-muted-foreground italic px-1 text-center">Déclenche une alerte sonore si le navire sort du cercle bleu.</p>
                          </div>
                      )}

                      {/* SMS D'URGENCE (Émetteur uniquement) */}
                      {appMode === 'sender' && (
                          <div className="space-y-4">
                              <Label className="text-[10px] font-black uppercase flex items-center gap-2">
                                <Phone className="size-3 text-red-600" /> Contact d'urgence (SMS)
                              </Label>
                              <div className="space-y-2">
                                <Input value={emetteur.emergencyContact} onChange={e => emetteur.saveSmsSettings(e.target.value, emetteur.vesselSmsMessage)} placeholder="Numéro du contact à terre..." className="h-11 border-2 font-black text-center" />
                                <Textarea value={emetteur.vesselSmsMessage} onChange={e => emetteur.saveSmsSettings(emetteur.emergencyContact, e.target.value)} placeholder="Message de détresse personnalisé..." className="border-2 font-medium min-h-[100px] text-xs leading-relaxed" />
                              </div>
                              <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed italic text-[9px] text-muted-foreground leading-relaxed">
                                "Le point GPS Google Maps sera automatiquement ajouté à la fin de votre message."
                              </div>
                          </div>
                      )}

                      {/* SECTION RÉGLAGES B (Si on veut les voir ici aussi) */}
                      {appMode === 'receiver' && (
                          <div className="text-center py-4 text-[10px] font-black uppercase text-muted-foreground opacity-40">
                            Utilisez l'onglet RÉGLAGES du panneau technique ci-dessus.
                          </div>
                      )}
                  </Card>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      {/* ANNUAIRE MARITIME */}
      <Card className="border-2 shadow-sm bg-muted/5 rounded-2xl overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b bg-muted/10">
            <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-600">
                <Phone className="size-3 text-primary" /> Annuaire de Sécurité NC
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-red-600 border-b border-red-100 pb-1">Urgences Vitales</p>
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-black flex items-center justify-between">COSS Mer <span className="text-red-600">16</span></p>
                    <p className="text-xs font-black flex items-center justify-between">SAMU Terre <span className="text-red-600">15</span></p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-blue-600 border-b border-blue-100 pb-1">Météo & Services</p>
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-black flex items-center justify-between">Météo Marine <span className="text-blue-600">36 67 36</span></p>
                    <p className="text-xs font-black flex items-center justify-between">Phares & Balises <span className="text-blue-600">23 21 00</span></p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-indigo-600 border-b border-indigo-100 pb-1">Ports & VHF</p>
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-black flex items-center justify-between">Port Autonome <span className="text-indigo-600">VHF 12</span></p>
                    <p className="text-xs font-black flex items-center justify-between">Port Moselle <span className="text-indigo-600">VHF 67</span></p>
                </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}

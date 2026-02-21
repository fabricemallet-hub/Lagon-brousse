'use client';

import { useState, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { fetchWindyWeather } from '@/lib/windy-api';
import { useToast } from '@/hooks/use-toast';
import type { VesselStatus } from '@/lib/types';

/**
 * LOGIQUE FLOTTE (C) : Journal Tactique, Photos, Urgences.
 */
export function useFlotte(fleetId?: string, vesselNickname?: string) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const tacticalLogsRef = useMemoFirebase(() => (firestore && fleetId) ? query(collection(firestore, 'vessels', fleetId, 'tactical_logs'), orderBy('time', 'desc')) : null, [firestore, fleetId]);
  const { data: tacticalLogs } = useCollection(tacticalLogsRef);

  const fleetMembersRef = useMemoFirebase(() => (firestore && fleetId) ? query(collection(firestore, 'vessels'), where('fleetId', '==', fleetId), where('isSharing', '==', true)) : null, [firestore, fleetId]);
  const { data: fleetMembers } = useCollection<VesselStatus>(fleetMembersRef);

  const addTacticalLog = async (type: string, lat: number, lng: number, photoUrl?: string) => {
    if (!firestore || !fleetId) return;
    const weather = await fetchWindyWeather(lat, lng);
    const log = {
      type,
      lat,
      lng,
      time: serverTimestamp(),
      wind: weather.windSpeed || 0,
      temp: weather.temp || 0,
      photoUrl: photoUrl || null,
      sender: vesselNickname || 'Anonyme'
    };
    await addDoc(collection(firestore, 'vessels', fleetId, 'tactical_logs'), log);
    toast({ title: `Signalement ${type} enregistré` });
  };

  const triggerEmergency = (type: 'MAYDAY' | 'PANPAN', contact: string, lat: number, lng: number) => {
    if (!contact) { toast({ variant: 'destructive', title: "Contact requis" }); return; }
    const posUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const body = `[${type}] ${vesselNickname || 'Navire'} : DÉTRESSE. Position : ${posUrl}`;
    window.location.href = `sms:${contact.replace(/\s/g, '')}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  return {
    tacticalLogs: tacticalLogs || [],
    fleetMembers: fleetMembers || [],
    addTacticalLog,
    triggerEmergency
  };
}

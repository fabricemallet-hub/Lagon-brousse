'use client';

import { useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { TacticalLogEntry } from '@/lib/types';

export function useFlotte(sharingId?: string, vesselNickname?: string) {
    const firestore = useFirestore();

    const addTacticalLog = useCallback(async (type: string, lat: number, lng: number) => {
        if (!firestore || !sharingId) return;

        const logEntry: TacticalLogEntry = {
            type: type.toUpperCase(),
            time: serverTimestamp(),
            pos: { latitude: lat, longitude: lng },
            vesselId: sharingId,
            vesselName: vesselNickname || sharingId
        };

        await setDoc(doc(firestore, 'tactical', `${sharingId}-${Date.now()}`), logEntry);
    }, [firestore, sharingId, vesselNickname]);

    return { addTacticalLog };
}

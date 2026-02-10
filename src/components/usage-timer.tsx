
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';

const USAGE_LIMIT_SECONDS = 60;

/**
 * Minuteur de session optimisé pour PWABuilder.
 * Les mises à jour du localStorage sont regroupées toutes les 15s pour éviter les violations de performance.
 */
export function UsageTimer({ status, auth, userId }: { status: string, auth: any, userId?: string }) {
  const [timeLeft, setTimeLeft] = useState(USAGE_LIMIT_SECONDS);
  const router = useRouter();
  const timeLeftRef = useRef(USAGE_LIMIT_SECONDS);

  useEffect(() => {
    if ((status !== 'limited' && status !== 'trial') || !auth || !userId) return;

    const today = new Date().toDateString();
    const lastUsageDate = localStorage.getItem('usage_date');
    const lastUserId = localStorage.getItem('usage_uid');
    let dailyUsage = parseInt(localStorage.getItem('usage_seconds') || '0', 10);

    if (lastUsageDate !== today || lastUserId !== userId) {
      dailyUsage = 0;
      localStorage.setItem('usage_date', today);
      localStorage.setItem('usage_uid', userId);
      localStorage.setItem('usage_seconds', '0');
    }

    const initial = Math.max(0, USAGE_LIMIT_SECONDS - dailyUsage);
    timeLeftRef.current = initial;
    setTimeLeft(initial);

    if (initial <= 0) {
      signOut(auth).then(() => router.push('/login'));
      return;
    }

    const interval = setInterval(() => {
      timeLeftRef.current -= 1;
      const current = timeLeftRef.current;
      
      // Mise à jour de l'UI chaque seconde mais du stockage local toutes les 15s seulement
      // Cela évite les ralentissements excessifs lors des scans de performance.
      if (current % 5 === 0 || current <= 5) {
        setTimeLeft(current);
      }
      
      if (current % 15 === 0 || current <= 0) {
        localStorage.setItem('usage_seconds', String(USAGE_LIMIT_SECONDS - current));
      }

      if (current <= 0) {
        clearInterval(interval);
        signOut(auth).then(() => {
          sessionStorage.clear();
          router.push('/login');
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, auth, userId, router]);

  if (status !== 'limited' && status !== 'trial') return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white flex items-center justify-center text-xs font-black z-[100] shadow-xl px-4 border-b border-white/20 transform-gpu">
      <AlertCircle className="size-4 mr-2 shrink-0" />
      {status === 'trial' ? 'Session d\'essai' : 'Mode Limité'} : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} restant
    </div>
  );
}

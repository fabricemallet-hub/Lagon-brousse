'use client';

import React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { SystemNotification } from '@/lib/types';
import { Info, AlertTriangle, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationBanner() {
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // On simplifie la requête si les permissions posent problème, 
    // mais le tri et le filtre sont ici essentiels.
    return query(
      collection(firestore, 'system_notifications'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: notifications, error } = useCollection<SystemNotification>(notificationsQuery);

  // En cas d'erreur de permission (pendant le déploiement des règles), on n'affiche rien 
  // plutôt que de laisser l'application planter via le listener global.
  if (error || !notifications || notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-4 duration-500">
      {notifications.map((notif) => (
        <BannerItem key={notif.id} notification={notif} />
      ))}
    </div>
  );
}

function BannerItem({ notification }: { notification: SystemNotification }) {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  const config = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: <Info className="size-5 text-blue-600 shrink-0" />,
      badge: 'bg-blue-600',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      icon: <AlertTriangle className="size-5 text-amber-600 shrink-0" />,
      badge: 'bg-amber-600',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <AlertCircle className="size-5 text-red-600 shrink-0" />,
      badge: 'bg-red-600',
    },
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle2 className="size-5 text-green-600 shrink-0" />,
      badge: 'bg-green-600',
    },
  }[notification.type] || config.info;

  return (
    <div className={cn(
      "relative w-full border-2 rounded-xl p-4 flex gap-4 shadow-sm overflow-hidden",
      config.bg,
      config.text
    )}>
      {config.icon}
      <div className="flex-grow space-y-1 pr-6">
        <h4 className="font-black uppercase tracking-tighter text-sm leading-none flex items-center gap-2">
          {notification.title}
        </h4>
        <p className="text-xs font-medium leading-relaxed opacity-90">
          {notification.content}
        </p>
      </div>
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 p-1 hover:bg-black/5 rounded-full transition-colors"
      >
        <X className="size-4 opacity-40" />
      </button>
    </div>
  );
}

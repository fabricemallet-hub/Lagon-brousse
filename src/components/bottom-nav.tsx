'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { navLinks } from '@/lib/nav-links';
import { cn } from '@/lib/utils';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { LogIn, User } from 'lucide-react';


export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserAccount>(userDocRef);

  // Mobile navigation filters
  const visibleLinks = navLinks.filter(link => {
    // List of main tabs for mobile - adjusted to include Vessel Tracker and remove Lagon
    const mobileTabs = ['/', '/peche', '/vessel-tracker', '/chasse', '/champs'];
    return mobileTabs.includes(link.href);
  });

  // Find the icon for the account page or fallback to default User icon
  const accountLink = navLinks.find(l => l.href === '/compte');
  const AccountIcon = accountLink?.icon || User;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[40] bg-card border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] h-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-around items-center h-16 px-1">
        {visibleLinks.map(link => {
          const isActive = pathname === link.href;
          
          return (
            <Link
              href={link.href}
              key={link.label}
              className={cn(
                'flex flex-col items-center justify-center text-center w-full h-full text-muted-foreground transition-all active:scale-90',
                isActive && 'text-primary font-bold'
              )}
            >
              <link.icon className={cn("size-6 mb-1", isActive && "scale-110")} />
              <span className="text-[9px] uppercase tracking-tighter leading-none">{link.label}</span>
            </Link>
          );
        })}
        
        <Link
          href={user ? "/compte" : "/login"}
          className={cn(
            'flex flex-col items-center justify-center text-center w-full h-full text-muted-foreground transition-all active:scale-90',
            (pathname === '/compte' || pathname === '/login') && 'text-primary font-bold'
          )}
        >
          {user ? (
            <AccountIcon className="size-6 mb-1" />
          ) : (
            <LogIn className="size-6 mb-1" />
          )}
          <span className="text-[9px] uppercase tracking-tighter leading-none">{user ? 'Profil' : 'Log'}</span>
        </Link>
      </div>
    </nav>
  );
}

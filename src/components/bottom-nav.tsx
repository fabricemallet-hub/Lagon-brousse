
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { navLinks } from '@/lib/nav-links';
import { cn } from '@/lib/utils';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { LogIn } from 'lucide-react';


export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserAccount>(userDocRef);
  const isAdmin = userProfile?.subscriptionStatus === 'admin';

  // Filter out admin link for simplicity on mobile, and contact link for admin
  const visibleLinks = navLinks.filter(link => {
    if (link.href === '/admin') return false;
    if (link.href === '/contact' && isAdmin) return false;
    return true;
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-t-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {visibleLinks.map(link => {
          const requiresAuth = link.href === '/compte' || link.href === '/contact';
          const isActive = pathname === link.href;

          if (requiresAuth && !user) {
            if (link.href === '/compte') {
              return (
                <Link
                    href="/login"
                    key="login-link"
                    className='flex flex-col items-center justify-center text-center w-full h-full text-muted-foreground hover:text-primary transition-colors'
                    >
                    <LogIn className="size-6" />
                    <span className="text-[10px] font-medium mt-1">Connexion</span>
                </Link>
              );
            }
            // For other auth-requiring links like /contact, we just won't render them if logged out, to avoid clutter.
            return null;
          }
          
          return (
            <Link
              href={link.href}
              key={link.label}
              className={cn(
                'flex flex-col items-center justify-center text-center w-full h-full text-muted-foreground hover:text-primary transition-colors',
                isActive && 'text-primary'
              )}
            >
              <link.icon className="size-6" />
              <span className="text-[10px] font-medium mt-1">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

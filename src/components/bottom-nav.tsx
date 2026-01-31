
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { navLinks } from '@/lib/nav-links';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();

  // Filter out admin link for simplicity on mobile
  const visibleLinks = navLinks.filter(link => link.href !== '/admin');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-t-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {visibleLinks.map(link => {
          // The 'Compte' link requires the user to be logged in. 
          // If not logged in, this button will navigate to the login page.
          // The account page itself handles redirection if the user is not authenticated.
          if (link.href === '/compte' && !user) {
             return (
                 <Link
                    href="/login"
                    key="login"
                    className='flex flex-col items-center justify-center text-center w-full h-full text-muted-foreground hover:text-primary transition-colors'
                    >
                    <link.icon className="size-6" />
                    <span className="text-[10px] font-medium mt-1">Connexion</span>
                </Link>
             )
          }
           if (link.href === '/compte' && user) {
             const isActive = pathname === link.href;
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
             )
           }


          const isActive = pathname === link.href;
          if (link.href !== '/compte') {
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
          }
        })}
      </div>
    </nav>
  );
}

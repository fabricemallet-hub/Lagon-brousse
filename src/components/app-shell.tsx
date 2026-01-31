'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { AppLogo } from './icons';
import { SidebarNav } from './sidebar-nav';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookOpen,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from '@/context/location-context';
import { useCalendarView } from '@/context/calendar-view-context';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { usePathname, useRouter } from 'next/navigation';
import { useDate } from '@/context/date-context';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useUser, useAuth } from '@/firebase';
import { Skeleton } from './ui/skeleton';
import { signOut } from 'firebase/auth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locations, selectedLocation, setSelectedLocation } = useLocation();
  const { calendarView, setCalendarView } = useCalendarView();
  const { selectedDate, setSelectedDate } = useDate();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const handlePrevDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const showDayNavigator =
    ['/', '/lagon', '/peche', '/champs', '/chasse'].includes(pathname);

  const renderUserMenu = () => {
    if (isUserLoading) {
      return (
        <div className="flex items-center gap-3 p-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      )
    }

    if (!user) {
      return (
        <Button asChild className="w-full justify-start h-12 p-2 gap-3" variant="ghost">
          <Link href="/login">
            <LogOut className="h-8 w-8" />
            <div className="text-left group-data-[collapsible=icon]:hidden">
              <p className="font-medium text-sm">Se connecter</p>
            </div>
          </Link>
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start h-12 p-2 gap-3"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.photoURL ?? `https://picsum.photos/seed/${user.uid}/40/40`}
                data-ai-hint="person avatar"
              />
              <AvatarFallback>{user.email?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
            <div className="text-left group-data-[collapsible=icon]:hidden">
              <p className="font-medium text-sm truncate" title={user.email!}>{user.email}</p>
              <p className="text-xs text-muted-foreground">Gratuit</p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Compte</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 p-2">
            <AppLogo className="size-8 text-primary" />
            <h1 className="font-bold text-lg text-primary-foreground group-data-[collapsible=icon]:hidden">
              Marées & Terroir
            </h1>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav />
        </SidebarContent>

        <SidebarFooter>
          {renderUserMenu()}
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1">
        <header className="flex h-auto min-h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30 py-2">
          <SidebarTrigger className="shrink-0 md:hidden" />
          <div className="w-full flex-1 flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger className="w-[150px] sm:w-[180px]">
                  <SelectValue placeholder="Choisir une commune" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showDayNavigator && (
                <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePrevDay}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className="w-[150px] sm:w-[180px] justify-start text-left font-normal h-8"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, 'PPP', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleNextDay}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
               {pathname === '/calendrier' && calendarView === 'champs' && (
                 <Button asChild variant="outline" size="sm">
                    <Link href="/semis">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Guide de Culture
                    </Link>
                  </Button>
              )}
            </div>

            {pathname === '/calendrier' && (
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="calendar-view"
                  className="text-sm font-medium"
                >
                  Pêche
                </Label>
                <Switch
                  id="calendar-view"
                  checked={calendarView === 'champs'}
                  onCheckedChange={(checked) =>
                    setCalendarView(checked ? 'champs' : 'peche')
                  }
                />
                <Label
                  htmlFor="calendar-view"
                  className="text-sm font-medium"
                >
                  Champs
                </Label>
              </div>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}

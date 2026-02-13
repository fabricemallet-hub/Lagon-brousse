
import { Home, Waves, Leaf, Fish, Calendar, Scale, Crosshair, User, Shield, BookOpen, Sprout, Sun, Navigation, HelpCircle, Briefcase, ShoppingBag } from 'lucide-react';

export const navLinks = [
  { href: '/', label: 'Accueil', icon: Home, adminOnly: false },
  { href: '/pro/dashboard', label: 'Dashboard Pro', icon: Briefcase, proOnly: true },
  { href: '/shopping', label: 'Shopping', icon: ShoppingBag, adminOnly: false },
  { href: '/meteo', label: 'Météo Live', icon: Sun, adminOnly: false },
  { href: '/lagon', label: 'Lagon', icon: Waves, adminOnly: false },
  { href: '/calendrier', label: 'Calendrier', icon: Calendar, adminOnly: false },
  { href: '/peche', label: 'Pêche', icon: Fish, adminOnly: false },
  { href: '/vessel-tracker', label: 'Boat Tracker', icon: Navigation, adminOnly: false },
  { href: '/fish', label: 'Fish', icon: Fish, adminOnly: false },
  { href: '/chasse', label: 'Chasse', icon: Crosshair, adminOnly: false },
  { href: '/champs', label: 'Champs', icon: Leaf, adminOnly: false },
  { href: '/semis', label: 'Guide Culture', icon: Sprout, adminOnly: false },
  { href: '/reglementation', label: 'Réglementation', icon: Scale, adminOnly: false },
  { href: '/aide/faq', label: 'FAQ & Support', icon: HelpCircle, adminOnly: false },
  { href: '/aide', label: 'Mode opératoire', icon: BookOpen, adminOnly: false },
  { href: '/compte', label: 'Compte', icon: User, adminOnly: false },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];


'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo, SoundLibraryEntry, FaqEntry, SupportTicket } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, Users, Crown, KeyRound, Trash2, Mail, 
  Palette, Save, Upload, 
  Fish, Plus, Minus, Pencil, DatabaseZap, Sparkles, UserX,
  Eye, Music, Volume2, Play, Download, HelpCircle, MessageSquare, Check, X, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import Image from 'next/image';
import { lagoonFishData } from '@/lib/fish-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FAQ_CATEGORIES = ["General", "Peche", "Boat Tracker", "Chasse", "Champs", "Compte"];

const INITIAL_FAQ_DATA = [
  // --- GENERAL (15) ---
  { categorie: "General", ordre: 1, question: "L'application remplace-t-elle les sources officielles ?", reponse: "Non. Pour votre sécurité, consultez toujours meteo.nc et les autorités maritimes (COSS). L'app est un assistant tactique." },
  { categorie: "General", ordre: 2, question: "Pourquoi la géolocalisation est-elle indispensable ?", reponse: "Elle permet de calculer les marées de la station la plus proche de VOUS et d'activer le Boat Tracker." },
  { categorie: "General", ordre: 3, question: "Comment fonctionne le mode hors-ligne ?", reponse: "Les données consultées avec internet sont mises en cache (PWA). Le GPS fonctionne sans réseau, mais pas les mises à jour live." },
  { categorie: "General", ordre: 4, question: "L'application consomme-t-elle beaucoup de batterie ?", reponse: "Le GPS en continu (Boat Tracker) est énergivore. Utilisez le 'Mode Éveil' uniquement quand nécessaire et prévoyez une batterie externe." },
  { categorie: "General", ordre: 5, question: "Quelle est la précision des marées ?", reponse: "Nous utilisons les constantes du SHOM ajustées par algorithme selon votre commune. La précision est de +/- 10 min." },
  { categorie: "General", ordre: 6, question: "Puis-je changer ma commune favorite ?", reponse: "Oui, via le sélecteur en haut de l'écran. Votre choix est mémorisé sur votre profil." },
  { categorie: "General", ordre: 7, question: "L'application est-elle gratuite ?", reponse: "Il existe un mode 'Limité' gratuit (1 min/jour) et un mode 'Premium' illimité par abonnement." },
  { categorie: "General", ordre: 8, question: "Comment installer l'app sur mon iPhone ?", reponse: "Ouvrez Safari, appuyez sur 'Partager' puis 'Sur l'écran d'accueil'. C'est une PWA." },
  { categorie: "General", ordre: 9, question: "Comment installer l'app sur Android ?", reponse: "Via Chrome, appuyez sur les 3 points puis 'Installer l'application'." },
  { categorie: "General", ordre: 10, question: "Mes données GPS sont-elles privées ?", reponse: "Oui. Elles ne sont partagées QUE si vous activez volontairement le Boat Tracker ou une session de Chasse." },
  { categorie: "General", ordre: 11, question: "L'app fonctionne-t-elle aux Îles Loyauté ?", reponse: "Oui, les stations de Lifou, Maré et Ouvéa sont intégrées." },
  { categorie: "General", ordre: 12, question: "Qui a développé cette application ?", reponse: "Une équipe de passionnés du terroir calédonien, pour les gens du pays." },
  { categorie: "General", ordre: 13, question: "Comment signaler un bug ?", reponse: "Via l'onglet 'FAQ & Support', ouvrez un ticket technique." },
  { categorie: "General", ordre: 14, question: "L'heure affichée est-elle celle de NC ?", reponse: "Oui, l'application est configurée sur le fuseau GMT+11 (Nouméa)." },
  { categorie: "General", ordre: 15, question: "Peut-on utiliser l'app sur tablette ?", reponse: "Oui, l'interface est responsive et s'adapte aux grands écrans." },

  // --- PECHE (25) ---
  { categorie: "Peche", ordre: 16, question: "Qu'est-ce qu'un indice de réussite 10/10 ?", reponse: "C'est une coïncidence parfaite entre vive-eau, phase lunaire optimale et créneau d'activité de l'espèce." },
  { categorie: "Peche", ordre: 17, question: "Comment fonctionne l'IA 'Jour Similaire' ?", reponse: "Elle compare la marée et la lune d'un succès passé pour trouver une date identique dans le futur." },
  { categorie: "Peche", ordre: 18, question: "Le scanner de poisson est-il fiable ?", reponse: "Il est très précis pour les espèces communes de NC, mais vérifiez toujours via la fiche technique pour la gratte." },
  { categorie: "Peche", ordre: 19, question: "Comment éviter la gratte (ciguatera) ?", reponse: "L'IA vous donne un risque théorique. Évitez les gros prédateurs (loches, carangues) dans les zones rouges connues." },
  { categorie: "Peche", ordre: 20, question: "Où sont mes coins de pêche secrets ?", reponse: "Dans l'onglet 'Pêche' > 'Carnet de Spots'. Ils sont strictement personnels et cryptés." },
  { categorie: "Peche", ordre: 21, question: "Puis-je partager mes spots ?", reponse: "Pour l'instant, les spots sont privés pour garantir votre tranquillité." },
  { categorie: "Peche", ordre: 22, question: "Quels poissons sont pélagiques ?", reponse: "Wahoo, Tazard, Thon, Mahi-mahi. L'app vous alerte quand ils sont en saison." },
  { categorie: "Peche", ordre: 23, question: "C'est quoi une marée montante ?", reponse: "C'est le flux. Souvent le meilleur moment car les poissons rentrent sur le platier pour manger." },
  { categorie: "Peche", ordre: 24, question: "Comment pêcher le bec de cane ?", reponse: "Cherchez les herbiers ou zones sableuses entre 2 et 10m. Utilisez du bernard-l'ermite." },
  { categorie: "Peche", ordre: 25, question: "Quelle lune pour le crabe de palétuvier ?", reponse: "Le crabe est 'plein' autour de la nouvelle et pleine lune (vives-eaux)." },
  { categorie: "Peche", ordre: 26, question: "Pourquoi mon spot a disparu ?", reponse: "Vérifiez que vous êtes connecté au même compte. Les spots sont liés à votre email." },
  { categorie: "Peche", ordre: 27, question: "Comment utiliser l'IA 'Quel spot maintenant ?' ?", reponse: "L'IA analyse vos spots enregistrés et choisit le meilleur selon votre position GPS et la marée actuelle." },
  { categorie: "Peche", ordre: 28, question: "L'indice de vent impacte-t-il la note de pêche ?", reponse: "Non, la note de l'espèce est biologique. Le vent est une contrainte de confort et sécurité pour vous." },
  { categorie: "Peche", ordre: 29, question: "Comment pêcher à la traîne ?", reponse: "Visez les cassants et les passes entre 6 et 9 nœuds pour le Tazard ou le Wahoo." },
  { categorie: "Peche", ordre: 30, question: "C'est quoi le 'Similar Day Finder' ?", reponse: "C'est notre outil IA exclusif qui prédit vos chances de succès basées sur l'historique lunaire." },
  { categorie: "Peche", ordre: 31, question: "Peut-on supprimer un spot ?", reponse: "Oui, cliquez sur l'icône poubelle dans votre carnet de spots." },
  { categorie: "Peche", ordre: 32, question: "Comment modifier le nom d'un spot ?", reponse: "Appuyez sur le bouton crayon dans les détails du spot." },
  { categorie: "Peche", ordre: 33, question: "L'app gère-t-elle les records de prises ?", reponse: "Vous pouvez noter vos records dans les 'Notes' de chaque spot." },
  { categorie: "Peche", ordre: 34, question: "Pourquoi la météo marine est payante sur d'autres sites ?", reponse: "Nous incluons une estimation de houle et vent gratuitement pour nos abonnés Premium." },
  { categorie: "Peche", ordre: 35, question: "Comment lire la flèche du vent ?", reponse: "La pointe indique où va le vent. Une flèche vers le bas signifie un vent de Nord." },
  { categorie: "Peche", ordre: 36, question: "Qu'est-ce que l'étale de marée ?", reponse: "Le moment où l'eau ne monte ni ne descend. Souvent un moment calme pour la pêche." },
  { categorie: "Peche", ordre: 37, question: "Comment pêcher la loche truite ?", reponse: "Au jig ou leurre souple près des patates de corail, entre 10 et 25m." },
  { categorie: "Peche", ordre: 38, question: "Où pêcher à Nouméa ?", reponse: "Le lagon sud regorge de spots, utilisez la carte satellite pour repérer les fonds clairs." },
  { categorie: "Peche", ordre: 39, question: "L'IA connaît-elle tous les poissons ?", reponse: "Elle connaît les 50 espèces les plus communes du lagon calédonien." },
  { categorie: "Peche", ordre: 40, question: "Le vent d'Est est-il bon pour la pêche ?", reponse: "En NC, l'Alizé d'Est est le vent dominant. Il est régulier mais peut lever de la mer." },

  // --- BOAT TRACKER (20) ---
  { categorie: "Boat Tracker", ordre: 41, question: "Comment mon contact me suit-il ?", reponse: "Il doit entrer votre ID unique dans son onglet 'Récepteur'." },
  { categorie: "Boat Tracker", ordre: 42, question: "Le SMS d'urgence est-il automatique ?", reponse: "Non, c'est une action manuelle sécurisée. Vous choisissez le type d'alerte." },
  { categorie: "Boat Tracker", ordre: 43, question: "Que signifie 'Signal perdu' ?", reponse: "L'émetteur n'a plus de réseau ou son téléphone est éteint depuis plus de 10 min." },
  { categorie: "Boat Tracker", ordre: 44, question: "Puis-je suivre plusieurs bateaux ?", reponse: "Oui, ajoutez autant d'IDs que vous voulez dans votre flotte." },
  { categorie: "Boat Tracker", ordre: 45, question: "Le mode éveil est-il risqué ?", reponse: "Il empêche l'écran de s'éteindre pour ne pas couper le GPS. Attention à la batterie." },
  { categorie: "Boat Tracker", ordre: 46, question: "Comment fonctionne la détection d'immobilité ?", reponse: "Si vous bougez de moins de 20m en 30s, l'app vous bascule en statut 'Au mouillage'." },
  { categorie: "Boat Tracker", ordre: 47, question: "Le surnom du navire est-il obligatoire ?", reponse: "Non, mais fortement recommandé pour que les secours vous identifient vite dans le SMS." },
  { categorie: "Boat Tracker", ordre: 48, question: "Puis-je personnaliser le message SOS ?", reponse: "Oui, activez l'option 'Message personnalisé' dans les réglages de l'émetteur." },
  { categorie: "Boat Tracker", ordre: 49, question: "Comment arrêter le partage ?", reponse: "Cliquez sur le gros bouton rouge 'Quitter' ou 'Arrêter le partage'." },
  { categorie: "Boat Tracker", ordre: 50, question: "L'historique est-il partagé ?", reponse: "Oui, le journal de bord est synchronisé en temps réel entre émetteur et récepteur." },
  { categorie: "Boat Tracker", ordre: 51, question: "Qui peut effacer l'historique ?", reponse: "Seul l'émetteur peut vider le journal de bord pour tout le monde." },
  { categorie: "Boat Tracker", ordre: 52, question: "Le Boat Tracker remplace-t-il la VHF ?", reponse: "ABSOLUMENT PAS. C'est un complément de confort. Gardez toujours votre VHF sur le canal 16." },
  { categorie: "Boat Tracker", ordre: 53, question: "L'app envoie-t-elle ma position aux secours directement ?", reponse: "Non, elle prépare un SMS pour votre contact d'urgence, qui devra prévenir les secours." },
  { categorie: "Boat Tracker", ordre: 54, question: "Peut-on changer l'icône du bateau ?", reponse: "Cette fonction est en cours de développement pour une future mise à jour." },
  { categorie: "Boat Tracker", ordre: 55, question: "L'ID de partage est-il définitif ?", reponse: "Vous pouvez le changer dans les réglages de l'émetteur si besoin." },
  { categorie: "Boat Tracker", ordre: 56, question: "Comment régler le volume des alertes ?", reponse: "Utilisez le curseur de volume dans l'onglet 'Récepteur'." },
  { categorie: "Boat Tracker", ordre: 57, question: "Pourquoi mon téléphone chauffe en mode émetteur ?", reponse: "Le GPS et l'écran allumé demandent beaucoup de ressources processeur." },
  { categorie: "Boat Tracker", ordre: 58, question: "Le Boat Tracker fonctionne-t-il en avion ?", reponse: "Non, les vitesses élevées perturbent l'algorithme conçu pour la mer." },
  { categorie: "Boat Tracker", ordre: 59, question: "Le SMS contient-il l'heure ?", reponse: "Oui, ainsi qu'un lien Google Maps direct vers votre position." },
  { categorie: "Boat Tracker", ordre: 60, question: "Puis-je être émetteur et récepteur à la fois ?", reponse: "Non, il faut choisir un mode par appareil." },

  // --- CHASSE (15) ---
  { categorie: "Chasse", ordre: 61, question: "Comment rejoindre une battue ?", reponse: "Entrez le code session (CH-XXXX) fourni par l'organisateur." },
  { categorie: "Chasse", ordre: 62, question: "Pourquoi signaler 'Gibier en vue' ?", reponse: "Cela envoie une notification push et un son immédiat à tous vos partenaires." },
  { categorie: "Chasse", ordre: 63, question: "La table de tir est-elle balistique ?", reponse: "C'est une simulation théorique basée sur un zérotage à 100m. Réglez toujours votre arme en réel." },
  { categorie: "Chasse", ordre: 64, question: "Comment voir le vent en brousse ?", reponse: "Consultez la carte du vent dans l'onglet Chasse pour anticiper votre approche." },
  { categorie: "Chasse", ordre: 65, question: "Puis-je changer ma couleur sur la carte ?", reponse: "Oui, dans vos préférences de profil ou dans les réglages de la session." },
  { categorie: "Chasse", ordre: 66, question: "C'est quoi la période de Brame ?", reponse: "La saison de reproduction (souvent Juillet/Août). Les cerfs sont très actifs et bruyants." },
  { categorie: "Chasse", ordre: 67, question: "L'app fonctionne-t-elle en zone blanche ?", reponse: "Le GPS oui, mais vous ne verrez pas la position de vos amis sans 3G/4G." },
  { categorie: "Chasse", ordre: 68, question: "Comment créer un code de session ?", reponse: "Dans l'onglet Chasse > Créer. Vous pouvez même choisir un code personnalisé." },
  { categorie: "Chasse", ordre: 69, question: "Qui voit ma position en chasse ?", reponse: "Uniquement les personnes ayant rejoint votre code de session spécifique." },
  { categorie: "Chasse", ordre: 70, question: "Peut-on supprimer une ancienne session ?", reponse: "Les sessions expirent automatiquement après 24 heures." },
  { categorie: "Chasse", ordre: 71, question: "Comment gérer le vent de face ?", reponse: "Approchez toujours le gibier avec le vent qui vous souffle dans le visage." },
  { categorie: "Chasse", ordre: 72, question: "L'app gère-t-elle les quotas ?", reponse: "Consultez l'onglet 'Réglementation' pour les quotas officiels par province." },
  { categorie: "Chasse", ordre: 73, question: "Quels sont les sons de gibier ?", reponse: "Vous pouvez choisir différents sons d'alerte dans vos préférences." },
  { categorie: "Chasse", ordre: 74, question: "Le mode satellite aide-t-il ?", reponse: "Oui, il permet de repérer les clairières, les points d'eau et les coulées." },
  { categorie: "Chasse", ordre: 75, question: "Comment quitter une session ?", reponse: "Cliquez sur le bouton rouge 'Quitter' en haut de l'onglet Chasse." },

  // --- CHAMPS (15) ---
  { categorie: "Champs", ordre: 76, question: "Pourquoi l'arrosage est en secondes ?", reponse: "Pour vous aider à doser précisément au jet d'eau selon les besoins de chaque plante." },
  { categorie: "Champs", ordre: 77, question: "C'est quoi un jour 'Racines' ?", reponse: "Un jour où l'influence lunaire favorise les carottes, oignons, radis, etc." },
  { categorie: "Champs", ordre: 78, question: "Le scanner diagnostique-t-il les maladies ?", reponse: "Oui, photographiez une feuille abîmée pour obtenir un conseil de traitement local." },
  { categorie: "Champs", ordre: 79, question: "Comment marche le Bilan Stratégique ?", reponse: "L'IA analyse votre inventaire jardin et la météo live pour créer votre plan d'action du jour." },
  { categorie: "Champs", ordre: 80, question: "Peut-on planter des tomates toute l'année ?", reponse: "Oui, mais elles préfèrent la saison fraîche pour éviter le mildiou excessif." },
  { categorie: "Champs", ordre: 81, question: "Quelle lune pour tailler les arbres ?", reponse: "Lune descendante (sève en bas) pour ne pas épuiser l'arbre." },
  { categorie: "Champs", ordre: 82, question: "Pourquoi l'IA me dit de ne pas arroser ?", reponse: "Elle a détecté une pluie récente ou forte prévue à votre commune via la météo live." },
  { categorie: "Champs", ordre: 83, question: "Comment identifier une graine ?", reponse: "Utilisez le scanner IA dans l'onglet 'Guide Culture'." },
  { categorie: "Champs", ordre: 84, question: "C'est quoi l'engrais vert ?", reponse: "Des plantes (trèfle, phacélie) semées pour enrichir naturellement votre terre." },
  { categorie: "Champs", ordre: 85, question: "L'IA connaît-elle les plantes de NC ?", reponse: "Oui, elle est entraînée sur la flore tropicale et les variétés spécifiques du Caillou." },
  { categorie: "Champs", ordre: 86, question: "Comment ajouter une plante au jardin ?", reponse: "Dans 'Mon Jardin', cliquez sur Ajouter et saisissez le nom ou utilisez le scanner." },
  { categorie: "Champs", ordre: 87, question: "Peut-on suivre les arbres fruitiers ?", reponse: "Oui, l'onglet Jardin permet de gérer arbres, fleurs et potager." },
  { categorie: "Champs", ordre: 88, question: "Comment marche le calendrier lunaire ?", reponse: "Il affiche visuellement les phases et le zodiaque pour chaque jour du mois." },
  { categorie: "Champs", ordre: 89, question: "Quelles sont les variétés de tomates en NC ?", reponse: "Heatmaster et Floradade sont les plus résistantes à notre chaleur." },
  { categorie: "Champs", ordre: 90, question: "L'IA corrige-t-elle les noms de plantes ?", reponse: "Oui, si vous écrivez 'mangue', elle corrigera en 'Manguier' pour un suivi correct." },

  // --- COMPTE (10) ---
  { categorie: "Compte", ordre: 91, question: "Comment activer un jeton cadeau ?", reponse: "Allez dans 'Compte', saisissez le code dans 'Activer un jeton' et validez." },
  { categorie: "Compte", ordre: 92, question: "Puis-je utiliser l'app sur 2 téléphones ?", reponse: "Oui, connectez-vous simplement avec le même email sur les deux appareils." },
  { categorie: "Compte", ordre: 93, question: "Comment résilier mon abonnement ?", reponse: "L'abonnement est géré via votre compte PayPal ou les réglages de votre store." },
  { categorie: "Compte", ordre: 94, question: "J'ai oublié mon mot de passe ?", reponse: "Sur l'écran de connexion, cliquez sur 'Mot de passe oublié' pour recevoir un mail de reset." },
  { categorie: "Compte", ordre: 95, question: "À quoi sert le mode 'Limité' ?", reponse: "À consulter rapidement une info (marée, vent) sans être abonné." },
  { categorie: "Compte", ordre: 96, question: "Comment changer mon email ?", reponse: "Pour des raisons de sécurité, contactez le support via un ticket." },
  { categorie: "Compte", ordre: 97, question: "Les notifications push sont-elles gratuites ?", reponse: "Oui, elles sont incluses pour tous les utilisateurs." },
  { categorie: "Compte", ordre: 98, question: "Comment supprimer mon compte ?", reponse: "Envoyez une demande de suppression via le support technique." },
  { categorie: "Compte", ordre: 99, question: "L'abonnement est-il remboursable ?", reponse: "Consultez nos conditions générales de vente sur le site officiel." },
  { categorie: "Compte", ordre: 100, question: "Comment devenir testeur bêta ?", reponse: "Contactez l'administrateur via la messagerie du support." },
];

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // FAQ States
  const [isFaqDialogOpen, setIsFaqDialogOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<Partial<FaqEntry>>({});
  const [isSavingFaq, setIsSavingFaq] = useState(false);

  // Tickets States
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.toLowerCase();
    const uid = user.uid;
    return email === 'f.mallet81@outlook.com' || 
           email === 'f.mallet81@gmail.com' || 
           email === 'fabrice.mallet@gmail.com' ||
           uid === 'K9cVYLVUk1NV99YV3anebkugpPp1';
  }, [user]);

  // Queries
  const faqRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'faq', 'items'), orderBy('ordre', 'asc'));
  }, [firestore, isAdmin]);
  const { data: faqs } = useCollection<FaqEntry>(faqRef);

  const ticketsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'tickets', 'items'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: tickets } = useCollection<SupportTicket>(ticketsRef);

  // Handlers FAQ
  const handleSaveFaq = async () => {
    if (!firestore || !isAdmin || !currentFaq.question) return;
    setIsSavingFaq(true);
    try {
      const faqId = currentFaq.id || Math.random().toString(36).substring(7);
      await setDoc(doc(firestore, 'cms_support', 'faq', 'items', faqId), {
        ...currentFaq,
        id: faqId,
        views: currentFaq.views || 0,
        ordre: currentFaq.ordre || 0
      }, { merge: true });
      toast({ title: "FAQ mise à jour" });
      setIsFaqDialogOpen(false);
    } finally {
      setIsSavingFaq(false);
    }
  };

  const handleClearFaq = async () => {
    if (!firestore || !isAdmin || !faqs) return;
    setIsClearing(true);
    try {
        const batch = writeBatch(firestore);
        faqs.forEach(f => {
            batch.delete(doc(firestore, 'cms_support', 'faq', 'items', f.id));
        });
        await batch.commit();
        toast({ title: "FAQ vidée avec succès." });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur lors de la suppression" });
    } finally {
        setIsClearing(false);
    }
  };

  const handleSeedFaq = async () => {
    if (!firestore || !isAdmin) return;
    if (faqs && faqs.length > 0) {
        toast({ variant: 'destructive', title: "Action annulée", description: "Videz d'abord la FAQ pour injecter les 100 nouvelles questions." });
        return;
    }
    setIsGenerating(true);
    try {
        const batch = writeBatch(firestore);
        INITIAL_FAQ_DATA.forEach(item => {
            const id = Math.random().toString(36).substring(7);
            const ref = doc(firestore, 'cms_support', 'faq', 'items', id);
            batch.set(ref, { ...item, id, views: 0 });
        });
        await batch.commit();
        toast({ title: "FAQ peuplée avec succès (100 entrées) !" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur lors de l'injection" });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!firestore || !isAdmin) return;
    await deleteDoc(doc(firestore, 'cms_support', 'faq', 'items', id));
    toast({ title: "Entrée supprimée" });
  };

  // Handlers Tickets
  const handleRespondToTicket = async () => {
    if (!firestore || !isAdmin || !currentTicket || !adminResponse) return;
    setIsResponding(true);
    try {
      await updateDoc(doc(firestore, 'cms_support', 'tickets', 'items', currentTicket.id), {
        adminResponse,
        respondedAt: serverTimestamp(),
        statut: 'ferme'
      });
      toast({ title: "Réponse envoyée" });
      setCurrentTicket(null);
      setAdminResponse('');
    } finally {
      setIsResponding(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter text-xl">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 mb-6 h-auto p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase">Stats</TabsTrigger>
          <TabsTrigger value="faq" className="text-[10px] font-black uppercase">FAQ</TabsTrigger>
          <TabsTrigger value="tickets" className="text-[10px] font-black uppercase">Tickets</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase">Users</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase">Design</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase">Fish</TabsTrigger>
          <TabsTrigger value="sounds" className="text-[10px] font-black uppercase">Sons</TabsTrigger>
          <TabsTrigger value="access" className="text-[10px] font-black uppercase">Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Button className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => { setCurrentFaq({ categorie: 'General', ordre: 0, views: 0 }); setIsFaqDialogOpen(true); }}>
                <Plus className="size-4" /> Ajouter Manuellement
            </Button>
            <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2 border-primary/20 bg-primary/5" onClick={handleSeedFaq} disabled={isGenerating || (faqs && faqs.length > 0)}>
                {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : <DatabaseZap className="size-4 text-primary" />}
                Peupler FAQ (100 Auto)
            </Button>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" disabled={isClearing || !faqs || faqs.length === 0}>
                        <Trash2 className="size-4" /> Vider la FAQ ({faqs?.length || 0})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action supprimera TOUTES les questions de la base de connaissances. Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearFaq} className="bg-destructive text-white">Confirmer la suppression</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>

          <Card className="border-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><HelpCircle className="size-4" /> Base de connaissances ({faqs?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Question</TableHead><TableHead className="text-[10px] font-black uppercase">Vues</TableHead><TableHead className="text-[10px] font-black uppercase">Catégorie</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {faqs?.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold text-xs max-w-[200px] truncate">{f.question}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[8px] font-black">{f.views || 0}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] uppercase font-black">{f.categorie}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setCurrentFaq(f); setIsFaqDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {faqs?.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 italic text-muted-foreground">Aucune entrée. Utilisez le bouton "Peupler FAQ" pour démarrer.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><MessageSquare className="size-4" /> Tickets Support</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Utilisateur</TableHead><TableHead className="text-[10px] font-black uppercase">Sujet</TableHead><TableHead className="text-[10px] font-black uppercase">Statut</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tickets?.map(t => (
                    <TableRow key={t.id} className={cn(t.statut === 'ouvert' && "bg-primary/5")}>
                      <TableCell className="text-[10px] font-bold">{t.userEmail}</TableCell>
                      <TableCell className="text-[10px] font-black uppercase">{t.sujet}</TableCell>
                      <TableCell><Badge variant={t.statut === 'ouvert' ? 'default' : 'secondary'} className="text-[8px] uppercase font-black">{t.statut}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase" onClick={() => { setCurrentTicket(t); setAdminResponse(t.adminResponse || ''); }}>Répondre</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Tickets Ouverts</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{tickets?.filter(t => t.statut === 'ouvert').length || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">FAQ Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{faqs?.length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog FAQ */}
      <Dialog open={isFaqDialogOpen} onOpenChange={setIsFaqDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Éditer FAQ</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Question</Label><Input value={currentFaq.question || ''} onChange={e => setCurrentFaq({...currentFaq, question: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Réponse</Label><Textarea value={currentFaq.reponse || ''} onChange={e => setCurrentFaq({...currentFaq, reponse: e.target.value})} className="min-h-[120px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Catégorie</Label>
                <Select value={currentFaq.categorie} onValueChange={(v:any) => setCurrentFaq({...currentFaq, categorie: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FAQ_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Ordre</Label><Input type="number" value={currentFaq.ordre || 0} onChange={e => setCurrentFaq({...currentFaq, ordre: parseInt(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveFaq} disabled={isSavingFaq} className="w-full h-12 font-black uppercase shadow-lg">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ticket Réponse */}
      <Dialog open={!!currentTicket} onOpenChange={(o) => !o && setCurrentTicket(null)}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Réponse Support</DialogTitle></DialogHeader>
          {currentTicket && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                <p className="text-[10px] font-black uppercase opacity-60">Message de l'utilisateur :</p>
                <p className="text-xs font-bold leading-relaxed">"{currentTicket.description}"</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Ma réponse</Label>
                <Textarea value={adminResponse} onChange={e => setAdminResponse(e.target.value)} className="min-h-[150px] border-2" placeholder="Tapez votre réponse ici..." />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={handleRespondToTicket} disabled={isResponding} className="w-full h-12 font-black uppercase shadow-lg bg-accent hover:bg-accent/90">Envoyer & Fermer le ticket</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

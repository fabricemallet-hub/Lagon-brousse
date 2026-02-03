'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Info, 
  Lightbulb, 
  PlayCircle,
  Waves, 
  Fish, 
  Crosshair, 
  Leaf, 
  Sprout, 
  Calendar, 
  Scale, 
  Navigation, 
  User,
  Home,
  Sparkles,
  Sun
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sectionContent: Record<string, {
  title: string;
  icon: any;
  color: string;
  role: string;
  steps: string[];
  tips: string[];
}> = {
  'accueil': {
    title: 'Accueil',
    icon: Home,
    color: 'bg-blue-500',
    role: "L'Accueil est votre centre de contrôle quotidien. Il synthétise les informations les plus importantes pour votre commune sans que vous ayez à parcourir tous les onglets.",
    steps: [
      "Visualisez la météo actuelle et les prévisions heure par heure.",
      "Consultez les prochaines marées (haute et basse) en un clin d'œil.",
      "Lisez le conseil du jardinier basé sur la lune du jour.",
      "Naviguez entre les jours grâce aux flèches en haut de page pour planifier vos sorties."
    ],
    tips: [
      "Le bandeau météo en haut de page vous indique également la tendance du vent pour les 6 prochaines heures.",
      "Le badge de statut (Abonné, Essai, Limité) est cliquable pour gérer votre compte."
    ]
  },
  'lagon': {
    title: 'Lagon & Météo',
    icon: Waves,
    color: 'bg-cyan-500',
    role: "Cet onglet fournit les données techniques pour vos activités nautiques : vent précis, état de la mer et cycles solaires/lunaires.",
    steps: [
      "Consultez les prévisions de vent (vitesse et direction) pour quatre moments clés de la journée.",
      "Analysez la houle : la hauteur est donnée à l'intérieur du lagon et à l'extérieur du récif.",
      "Vérifiez la période de la houle (en secondes) : plus elle est élevée, plus les vagues sont puissantes.",
      "Consultez les heures précises de lever et coucher du soleil et de la lune."
    ],
    tips: [
      "Cliquez sur une tranche horaire du vent pour mettre à jour les détails de la houle correspondants.",
      "Une houle de plus de 2m au récif annonce souvent une passe 'déferlante' ou dangereuse."
    ]
  },
  'meteo': {
    title: 'Météo Live',
    icon: Sun,
    color: 'bg-yellow-500',
    role: "Un outil de surveillance météo haute précision qui combine les relevés en temps réel des stations NC et une analyse prévisionnelle stratégique sur 7 jours, assistée par l'IA.",
    steps: [
      "Recherche & Proximité : Les stations sont triées automatiquement par distance GPS par rapport à votre commune favorite.",
      "Lecture Live : Visualisez instantanément le vent (force et direction exacte via la flèche), la température et l'indice UV actuel.",
      "Tableau de Bord J+7 : Accédez à une vue complète sur une semaine incluant codes météo, températures extrêmes et probabilités de pluie.",
      "Bilan Stratégique IA : L'assistant analyse la cohérence des prévisions pour rédiger une synthèse globale de l'évolution du temps.",
      "Optimisation des Activités : Recevez des conseils personnalisés pour la pêche (selon les vents/marées), la chasse (humidité) et le jardinage.",
      "Vigilance & Sécurité : L'IA identifie les dangers comme les pics d'UV extrêmes, les fortes rafales ou les passages pluvieux soudains."
    ],
    tips: [
      "L'assistant IA ne se contente pas de lire les chiffres : il vous aide à identifier la 'meilleure fenêtre' de la semaine pour vos activités.",
      "La flèche du vent indique la provenance réelle de l'air : une flèche pointant vers le bas indique un vent de Nord.",
      "Le bilan IA est régénéré à chaque consultation pour refléter les changements les plus récents de votre base de données."
    ]
  },
  'vessel-tracker': {
    title: 'Vessel Tracker',
    icon: Navigation,
    color: 'bg-blue-600',
    role: "Un système de sécurité maritime haute-fidélité conçu pour rassurer vos proches à terre en partageant votre position GPS exacte et votre statut d'activité en mer.",
    steps: [
      "Activation Émetteur : Activez 'Partager ma position'. Votre identifiant unique s'affiche instantanément.",
      "Partage de l'ID : Envoyez cet ID par SMS ou WhatsApp à votre contact de confiance resté à terre.",
      "Détection d'Immobilité : Si le système détecte une absence de mouvement (>15m) pendant 5 min, votre statut passe en 'Stationnaire' (Mouillage/Dérive).",
      "Mises à jour Auto : En mode stationnaire, le tracker rafraîchit votre position toutes les 30 min pour rassurer le récepteur sans vider votre batterie.",
      "ALERTE SMS CRITIQUE : Saisissez le numéro de votre contact. En cas de détresse, le bouton rouge génère un message complet (GPS, lien Maps, secours) et ouvre l'application SMS de votre téléphone pré-remplie. Vous n'avez plus qu'à appuyer sur envoyer.",
      "Contenu de l'Alerte : Le SMS envoyé contient vos coordonnées GPS décimales, un lien direct Google Maps, votre nom et les numéros d'urgence NC (CROSS 196)."
    ],
    tips: [
      "Configuration Préalable : Enregistrez le numéro de votre contact via l'icône 'Disquette' pour que le bouton d'alerte soit opérationnel immédiatement lors de vos prochaines sorties.",
      "Gestion de la Zone Blanche : Si vous perdez internet, le tracker stocke vos positions. Elles seront envoyées en bloc dès que vous retrouverez une barre de réseau.",
      "Conseil Batterie : Le GPS haute précision est gourmand. Prévoyez une batterie externe ou une prise 12V sur le bateau pour les longues sorties.",
      "Le récepteur peut copier vos coordonnées GPS d'un clic pour les transmettre aux secours ou les entrer dans un GPS de bord."
    ]
  },
  'peche': {
    title: 'Pêche',
    icon: Fish,
    color: 'bg-indigo-500',
    role: "Optimisez vos sorties en mer grâce aux prévisions d'activité par espèce et à la mémorisation de vos spots secrets.",
    steps: [
      "Consultez les indices de réussite (sur 10) calculés selon la marée, la lune et l'heure pour chaque poisson.",
      "Déroulez une fiche espèce pour obtenir des conseils de profondeur et de technique.",
      "Suivez l'activité des crabes, langoustes et poulpes selon le cycle lunaire.",
      "Enregistrez vos 'Coins de Pêche' par GPS sur la carte satellite interactive.",
      "Consultez l'historique détaillé de vos prises : l'application mémorise automatiquement le contexte exact (lune, marée, vent, température) au moment de l'enregistrement.",
      "Utilisez l'IA 'Chercher un jour similaire' sur un spot : elle analyse votre succès passé pour trouver la date idéale dans les 30 prochains jours.",
      "Sélectionnez plusieurs spots pour obtenir une tendance globale du meilleur jour de la semaine."
    ],
    tips: [
      "Le mode satellite de la carte est idéal pour repérer les patates de corail et les têtes de roche.",
      "Un spot enregistré avec 9/10 d'indice est un précieux indicateur pour l'IA prédictive.",
      "L'IA ignore météo et vent pour se concentrer sur les cycles immuables de la lune et des marées."
    ]
  },
  'chasse': {
    title: 'Chasse au Cerf',
    icon: Crosshair,
    color: 'bg-orange-600',
    role: "Optimisez vos sorties en brousse grâce à l'analyse du vent et au suivi de groupe en temps réel.",
    steps: [
      "Consultez la période biologique (Brame, Chute des bois) pour adapter votre stratégie.",
      "Utilisez la carte du vent pour visualiser d'où vient l'air par rapport au relief.",
      "La 'Table de Tir' vous aide à estimer la correction de visée en fonction de la distance et du vent.",
      "Session de Groupe : Créez une session ou rejoignez-en une via un code unique (ex: CH-1234) pour partager votre position GPS en temps réel avec vos partenaires sur la carte satellite.",
      "Alertes Tactiques : Informez instantanément votre groupe de votre statut ('En position', 'Battue en cours') ou signalez 'Gibier en vue' d'un clic. Une alerte visuelle et sonore préviendra immédiatement vos coéquipiers.",
      "Sécurité & Batterie : Surveillez le niveau de batterie de chaque participant sur la carte. Les informations (GPS + Batterie) sont actualisées toutes les 5 minutes pour préserver l'autonomie de vos appareils en zone isolée."
    ],
    tips: [
      "En période de Brame, l'alerte orange vous rappelle que les cerfs sont plus actifs mais aussi plus vigilants.",
      "Le mode hors-ligne de la carte de chasse permet de naviguer sans réseau si vous avez consulté la zone auparavant.",
      "Personnalisez votre icône et votre couleur dans les paramètres de la session pour être identifié au premier coup d'œil."
    ]
  },
  'champs': {
    title: 'Champs & Jardin',
    icon: Leaf,
    color: 'bg-green-600',
    role: "Jardiner selon les traditions calédoniennes et l'influence lunaire pour des récoltes plus abondantes.",
    steps: [
      "Identifiez la tendance du jour : Lune Montante (pour ce qui pousse hors de terre) ou Descendante (pour les racines).",
      "Consultez le signe du zodiaque : Jour Fruits, Racines, Fleurs ou Feuilles.",
      "Suivez les recommandations : l'application vous guide pour la taille, le bouturage ou la tonte de la pelouse selon la sève.",
      "Accédez à l'onglet 'Mes Semis' pour enregistrer vos travaux. L'application mémorise le contexte lunaire exact (phase et zodiaque), calcule les dates de récolte prévisionnelles et planifie les périodes de repiquage pour assurer la réussite de votre potager."
    ],
    tips: [
      "La spécialisation des travaux (Le Calendrier Lunaire) : Signes de Terre (Taur., Vierg., Capr.) = Racines ; Signes d'Eau (Canc., Scorp., Pois.) = Feuilles ; Signes d'Air (Gém., Bal., Vers.) = Fleurs ; Signes de Feu (Bél., Lion, Sag.) = Fruits.",
      "Le signe du zodiaque change tous les 2 à 3 jours environ.",
      "Suivre le calendrier permet de réduire naturellement l'usage d'engrais et de pesticides.",
      "L'historique 'Mes Semis' vous permet de comparer la réussite de vos cultures d'une saison à l'autre."
    ]
  },
  'semis': {
    title: 'Guide Culture & IA',
    icon: Sprout,
    color: 'bg-emerald-500',
    role: "Un assistant horticole intelligent propulsé par l'IA qui crée vos fiches de culture et occupe vos dates de semis selon les cycles de sève.",
    steps: [
      "Recherche & Identification : Tapez le nom de n'importe quelle graine. Si elle est absente du guide, l'IA créera instantanément sa fiche technique personnalisée.",
      "Calcul de Fiche IA : L'intelligence artificielle analyse la plante, définit son type (Fruit, Racine...) et génère des conseils spécifiques (arrosage, exposition).",
      "Optimisation Lunaire : L'IA vérifie votre date de semis. Si elle est déconseillée, elle scanne les 30 prochains jours pour vous suggérer la date idéale précise.",
      "Planification Dynamique : Obtenez des estimations pour la date de récolte et la période de repiquage en pleine terre basées sur les cycles biologiques.",
      "Historique : Sauvegardez vos fiches pour suivre l'évolution de vos semis dans votre session personnelle."
    ],
    tips: [
      "L'IA suggère toujours la date la plus proche respectant les 'règles d'or' (ex: Légume Fruit = Lune Montante + Jour Fruit).",
      "Une alerte visuelle rouge dans votre historique vous signalera si une plantation a été effectuée hors de la période lunaire optimale.",
      "Utilisez le bouton 'Calculer la fiche IA' avant d'enregistrer pour bénéficier du conseil lunaire."
    ]
  },
  'calendrier-peche': {
    title: 'Calendrier Pêche',
    icon: Calendar,
    color: 'bg-slate-700',
    role: "Le Calendrier Pêche est un outil de planification stratégique à long terme. Il vous permet d'anticiper les cycles biologiques marins sur tout le mois pour choisir la technique de pêche la plus adaptée à chaque coefficient de marée et phase lunaire.",
    steps: [
      "Suivi des Crustacés : Repérez les jours 'Crabe Plein' (vives-eaux) ou 'Crabe Mout' (mortes-eaux/mue). Ne perdez plus de temps à poser des casiers durant la mue.",
      "Saisons Pélagiques : Identifiez les périodes de passage des espèces comme le Tazard (pic en Nov/Déc) via les alertes de saison intégrées aux fiches journalières.",
      "Analyse des Marées : Visualisez instantanément les marées les plus hautes et les plus basses du mois (grandes marées) pour cibler les platiers ou les passes.",
      "Comportement des Espèces : Accédez aux fiches détaillées par jour pour connaître les habitudes alimentaires, les profondeurs idéales (ex: 2-10m pour le Bec de cane) et les spots stratégiques.",
      "Stratégie Langoustes : Adaptez votre sortie selon l'activité prévue. En lune noire (Nouvelle Lune), privilégiez le récif extérieur ; en lune claire, elles restent souvent à l'abri ou à l'intérieur."
    ],
    tips: [
      "Un indice de poisson de 10/10 coïncide souvent avec les jours de grandes marées (Nouvelle ou Pleine lune).",
      "Pour le Tazard, privilégiez les créneaux d'aube lors des marées montantes avec un fort courant.",
      "Cliquez sur n'importe quel jour pour ouvrir la fiche 'Expert' qui synthétise tous les facteurs (Lune + Marée + Espèce).",
      "Le calendrier affiche les hauteurs exactes pour détecter les marées 'records' du mois."
    ]
  },
  'calendrier-champs': {
    title: 'Calendrier Champs',
    icon: Calendar,
    color: 'bg-green-800',
    role: "Le calendrier lunaire complet pour organiser les travaux du jardin sur le mois.",
    steps: [
      "Repérez visuellement les jours Fruits (Pique), Racines (Carotte), etc.",
      "Les symboles de ciseaux indiquent les jours propices à la taille ou à la tonte de la pelouse.",
      "Le symbole de recyclage indique les jours de bouturage.",
      "Cliquez sur une date pour ouvrir la fiche de recommandation complète : l'IA analyse pour vous la phase lunaire précise (montante/descendante), l'influence du zodiaque et vous délivre le conseil d'expert pour réussir vos travaux ce jour-là."
    ],
    tips: [
      "La spécialisation des travaux (Le Calendrier Lunaire) : Signes de Terre (Taur., Vierg., Capr.) = Racines ; Signes d'Eau (Canc., Scorp., Pois.) = Feuilles ; Signes d'Air (Gém., Bal., Vers.) = Fleurs ; Signes de Feu (Bél., Lion, Sag.) = Fruits.",
      "Le signe du zodiaque change tous les 2 à 3 jours environ.",
      "Basculez entre Calendrier Pêche et Champs grâce au bouton en haut du calendrier.",
      "Le jour actuel est toujours entouré d'un cercle bleu."
    ]
  },
  'reglementation': {
    title: 'Réglementation',
    icon: Scale,
    color: 'bg-slate-500',
    role: "L'essentiel des règles de pêche et de chasse en Province Sud pour une pratique responsable.",
    steps: [
      "Consultez le calendrier des fermetures (Picot, Crabe, etc.).",
      "Vérifiez les tailles minimales autorisées pour les bénitiers, trocas et huîtres.",
      "Identifiez les espèces intégralement protégées (interdiction totale).",
      "Consultez les quotas de chasse pour le Notou et la Roussette."
    ],
    tips: [
      "Le marquage de la queue de la langouste est obligatoire dès la capture.",
      "Ces informations sont des résumés, consultez toujours les textes officiels en cas de doute."
    ]
  },
  'compte': {
    title: 'Compte & Abonnement',
    icon: User,
    color: 'bg-zinc-600',
    role: "Gérez vos informations personnelles et votre accès aux fonctionnalités premium.",
    steps: [
      "Consultez votre statut actuel (Essai, Actif, Limité).",
      "Si vous avez un code promo ou un jeton d'accès, saisissez-le dans le champ dédié.",
      "Activez l'abonnement mensuel pour un accès illimité."
    ],
    tips: [
      "En mode 'Limité', vous disposez d'une minute d'accès par jour pour les consultations rapides."
    ]
  }
};

export default function AideSectionPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.section as string;
  const content = sectionContent[sectionId];

  if (!content) {
    return <div className="p-8 text-center">Section non trouvée.</div>;
  }

  const Icon = content.icon;

  return (
    <div className="space-y-6 pb-12 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
          <ChevronLeft className="size-6" />
        </Button>
        <h1 className="text-xl font-bold">Retour</h1>
      </div>

      <Card className="border-2 overflow-hidden shadow-lg">
        <CardHeader className={cn("text-white p-6", content.color)}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="size-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{content.title}</CardTitle>
              <p className="text-white/80 text-sm font-medium mt-1">Guide d'utilisation</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6 space-y-8">
            {/* Rôle */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Info className="size-5" /> À quoi ça sert ?
              </h3>
              <div className="text-muted-foreground leading-relaxed italic text-sm">
                {content.role}
              </div>
            </div>

            {/* Mode d'emploi */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <PlayCircle className="size-5" /> Comment ça marche ?
              </h3>
              <ul className="space-y-4">
                {content.steps.map((step, index) => (
                  <li key={index} className="flex gap-4 items-start">
                    <div className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                      {index + 1}
                    </div>
                    <span className="text-sm text-foreground/90 font-medium">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Astuces */}
            <div className="bg-muted/50 p-5 rounded-2xl border-2 border-dashed border-muted-foreground/20 space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-accent">
                <Lightbulb className="size-5" /> Astuces & Conseils
              </h3>
              <ul className="space-y-2">
                {content.tips.map((tip, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-14 text-lg font-bold shadow-md mt-4" variant="outline" onClick={() => router.back()}>
        Compris !
      </Button>
    </div>
  );
}

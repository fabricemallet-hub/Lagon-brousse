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
  Home
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
  'vessel-tracker': {
    title: 'Vessel Tracker',
    icon: Navigation,
    color: 'bg-blue-600',
    role: "Un outil de sécurité haute-fidélité pour partager votre position GPS en temps réel avec un proche resté à terre.",
    steps: [
      "Utilisateur A (Émetteur) : Activez 'Partager ma position'. Votre ID s'affiche.",
      "Copiez et envoyez cet ID à votre contact de confiance.",
      "Surveillance d'arrêt : Si vous ne bougez plus pendant 5 min, le statut passe en 'Stationnaire'. La position se met ensuite à jour automatiquement toutes les 30 min pour rassurer le destinataire.",
      "Reprise de route : Dès que vous bougez de nouveau, le système informe instantanément le récepteur que le bateau est en mouvement.",
      "Utilisateur B (Récepteur) : Collez l'ID dans l'onglet 'Récepteur' pour suivre le navire sur la carte.",
      "En cas de problème, utilisez le bouton 'ENVOYER ALERTE SMS' pour prévenir votre contact."
    ],
    tips: [
      "Sauvegardez votre contact d'urgence dans votre profil via l'icône disquette pour ne plus avoir à le saisir.",
      "Le système fonctionne même si vous perdez internet temporairement : la position est stockée et renvoyée dès que le réseau revient.",
      "Branchez votre téléphone sur une batterie externe, le GPS en continu est gourmand."
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
      "Activez une 'Session de Groupe' pour voir vos coéquipiers sur la carte en temps réel."
    ],
    tips: [
      "En période de Brame, l'alerte orange vous rappelle que les cerfs sont plus actifs mais aussi plus vigilants.",
      "Le mode hors-ligne de la carte de chasse permet de naviguer sans réseau si vous avez consulté la zone auparavant."
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
      "Lisez les tâches recommandées : taille, bouturage, tonte de la pelouse ou plantation.",
      "Accédez à l'onglet 'Mes Semis' pour enregistrer vos travaux."
    ],
    tips: [
      "Le signe du zodiaque change tous les 2 à 3 jours environ.",
      "Suivre le calendrier permet de réduire naturellement l'usage d'engrais et de pesticides."
    ]
  },
  'semis': {
    title: 'Gestion des Semis',
    icon: Sprout,
    color: 'bg-emerald-500',
    role: "Un assistant intelligent qui valide vos plantations et vous guide jusqu'à la récolte en analysant les traditions tropicales et les cycles lunaires.",
    steps: [
      "Choisissez votre graine dans la liste prédéfinie des variétés communes (Tomate, Salade, etc.).",
      "Si votre plante est absente, sélectionnez 'Autre / Saisie manuelle' en bas de liste pour taper son nom.",
      "Sélectionnez la date prévue pour la mise en terre ou en godet.",
      "L'IA identifie le type de plante (Fruit, Racine, Feuille, Fleur) et génère des conseils spécifiques : arrosage, exposition et entretien.",
      "Validation Lunaire : L'IA vérifie si le jour choisi est propice. Si ce n'est pas le cas, elle cherche dans les 30 prochains jours la date idéale réunissant les meilleures conditions (Phase + Zodiaque) et vous la recommande.",
      "Planification : L'IA estime dynamiquement votre date de récolte et la période idéale pour le repiquage en pleine terre.",
      "Validez pour enregistrer la fiche dans votre historique de cultures."
    ],
    tips: [
      "L'IA suggère toujours la date la plus proche respectant les 'règles d'or' (ex: Fruit en lune montante + jour Fruits).",
      "Une alerte visuelle rouge apparaîtra dans votre historique si un semis a été fait hors période lunaire idéale.",
      "L'IA ignore la météo changeante pour se concentrer sur les cycles de sève fondamentaux."
    ]
  },
  'calendrier-peche': {
    title: 'Calendrier Pêche',
    icon: Calendar,
    color: 'bg-slate-700',
    role: "Une vue mensuelle pour planifier vos futures sorties en mer.",
    steps: [
      "Identifiez les phases clés : Nouvelle lune et Pleine lune (fortes marées).",
      "Les icônes de poissons indiquent le potentiel global de la journée.",
      "Les icônes de crabes, langoustes et poulpes signalent les meilleures périodes de capture.",
      "Cliquez sur un jour pour voir le détail des marées prévues."
    ],
    tips: [
      "Les jours passés sont grisés pour une meilleure lisibilité.",
      "Planifiez vos sorties 'Crabes' autour de la nouvelle lune pour maximiser vos chances."
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
      "Cliquez sur une date pour lire la recommandation complète de l'IA."
    ],
    tips: [
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
      "Activez l'abonnement mensuel pour un accès illimité.",
      "Modifiez votre nom d'affichage ou vos préférences d'icônes."
    ],
    tips: [
      "La version gratuite dure 3 mois après votre inscription.",
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
              <p className="text-muted-foreground leading-relaxed italic">
                {content.role}
              </p>
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

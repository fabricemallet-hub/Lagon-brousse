/**
 * @fileOverview Base de données initiale pour la FAQ.
 * Déportée ici pour éviter de surcharger les composants clients.
 */

export const INITIAL_FAQ_DATA = [
  // --- GENERAL (15) ---
  { categorie: "General", ordre: 1, question: "L'application remplace-t-elle les sources officielles ?", reponse: "Non. Pour votre sécurité, consultez toujours meteo.nc et les autorités maritimes (COSS). L'app est un assistant tactique." },
  { categorie: "General", ordre: 2, question: "Pourquoi la géolocalisation est-elle indispensable ?", reponse: "Elle permet de calculer les marées de la station la plus proche de VOUS, d'activer le Boat Tracker et de vous donner les risques de gratte locaux." },
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

  // --- PRO (15) ---
  { categorie: "PRO", ordre: 120, question: "Comment activer mon compte commerçant ?", reponse: "Vous devez d'abord créer un compte classique, puis transmettre votre UID (visible dans l'onglet Profil) à l'administrateur pour qu'il relie votre boutique." },
  { categorie: "PRO", ordre: 121, question: "À quoi sert l'Assistant Magicien IA Produit ?", reponse: "Il utilise la vision artificielle pour analyser vos photos de produits. En un clic, il rédige une description attractive et génère une stratégie de vente (arguments clés et conseils marketing)." },
  { categorie: "PRO", ordre: 122, question: "Comment fonctionne le Magicien de Campagne ?", reponse: "Une fois vos articles sélectionnés, l'IA rédige automatiquement 5 variantes de messages par canal (Email, SMS, Push). Elle adapte la longueur selon le format technique de chaque support." },
  { categorie: "PRO", ordre: 123, question: "Pourquoi y a-t-il 3 choix de longueur dans les campagnes ?", reponse: "Vous pouvez choisir entre Court, Moyen ou Long. L'IA adapte alors le contenu : un mail 'Court' sera plus riche qu'un SMS 'Court' pour respecter les usages de chaque média." },
  { categorie: "PRO", ordre: 124, question: "Comment est calculé le devis d'une campagne ?", reponse: "Le prix total = Frais fixes + (Nombre d'abonnés ciblés x Tarif par canal). Le 'Reach' affiche l'audience réelle atteignable selon vos rayons et votre zone géographique." },
  { categorie: "PRO", ordre: 125, question: "Comment marquer un article en rupture de stock ?", reponse: "Activez l'interrupteur 'Stock vide' dans la fiche du produit. Sélectionnez ensuite le mois et l'année du prochain arrivage prévu pour informer vos clients." },
  { categorie: "PRO", ordre: 126, question: "Qu'est-ce que l'affichage 'Rupture' côté client ?", reponse: "L'annonce apparaît en opacité réduite avec un badge rouge 'STOCK ÉPUISÉ'. Un message en gras indique la date de la prochaine commande prévue." },
  { categorie: "PRO", ordre: 127, question: "L'IA peut-elle inventer des produits dans mes messages ?", reponse: "Non. Nous avons configuré l'IA pour qu'elle respecte strictement votre catalogue. Elle n'ajoutera jamais d'articles (ex: vêtements) qui ne sont pas dans votre sélection actuelle." },
  { categorie: "PRO", ordre: 128, question: "Puis-je modifier les textes de l'IA ?", reponse: "Oui, l'étape finale du Magicien de Campagne vous permet d'éditer manuellement chaque message avant de procéder au paiement." },
  { categorie: "PRO", ordre: 129, question: "Le ciblage par commune est-il précis ?", reponse: "Oui, vous pouvez choisir jusqu'à 30 communes spécifiques. Seuls les utilisateurs ayant ces communes en 'Favori' recevront l'alerte." },
  { categorie: "PRO", ordre: 130, question: "Peut-on mettre plusieurs photos par produit ?", reponse: "Oui, vous pouvez charger jusqu'à 4 photos. L'IA les analysera toutes pour créer la meilleure description possible." },
  { categorie: "PRO", ordre: 131, question: "Pourquoi utiliser les Nouvel Arrivage sans promo ?", reponse: "Cela permet de créer de l'exclusivité et du passage en magasin sans devaluer vos marges. L'IA utilisera alors un ton centré sur la nouveauté et non sur le prix." },
  { categorie: "PRO", ordre: 132, question: "Comment savoir si ma campagne est envoyée ?", reponse: "Après le paiement, votre campagne passe en statut 'En attente'. L'administrateur valide techniquement l'envoi sous 24h et vous recevez une notification." },
  { categorie: "PRO", ordre: 133, question: "Les clients peuvent-ils me contacter ?", reponse: "Oui, via le bouton 'Contacter le magasin' sur chaque annonce. Ils peuvent vous appeler directement ou lancer un itinéraire GPS vers votre boutique." },
  { categorie: "PRO", ordre: 134, question: "Comment mettre à jour mon point GPS Boutique ?", reponse: "Allez dans l'onglet 'Profil' et cliquez sur 'Modifier mes coordonnées'. Vous pouvez alors déplacer le curseur sur la carte satellite." },

  // --- PECHE & FISH (25) ---
  { categorie: "Peche", ordre: 16, question: "Qu'est-ce qu'un indice de réussite 10/10 ?", reponse: "C'est une coïncidence parfaite entre vive-eau, phase lunaire optimale et créneau d'activité de l'espèce." },
  { categorie: "Peche", ordre: 17, question: "Comment fonctionne l'IA 'Jour Similaire' ?", reponse: "Elle compare la marée et la lune d'un succès passé pour trouver une date identique dans le futur." },
  { categorie: "Peche", ordre: 18, question: "Le scanner de poisson identifie-t-ils le risque de gratte ?", reponse: "Oui, il identifie l'espèce et affiche instantanément le profil de risque différencié par taille (Petit, Moyen, Grand)." },
  { categorie: "Peche", ordre: 19, question: "Comment éviter la gratte (ciguatera) ?", reponse: "L'app vous donne un score pondéré. Évitez les spécimens de catégorie 'Grand' dans les zones à risque et consultez toujours le lien vers le guide de la CPS présent sur chaque fiche." },
  { categorie: "Peche", ordre: 20, question: "Pourquoi le risque de gratte varie-t-ils selon la taille ?", reponse: "Les toxines s'accumulent tout au long de la vie du poisson. Un grand spécimen est statistiquement beaucoup plus dangereux qu'un petit." },
  { categorie: "Peche", ordre: 21, question: "C'est quoi le 'Risque local' (Communautaire) ?", reponse: "C'est la moyenne des signalements effectués par les pêcheurs de votre commune. Elle reflète la réalité du terrain." },
  { categorie: "Peche", ordre: 22, question: "Comment est calculé le Score Final de risque ?", reponse: "C'est la moyenne exacte entre les données scientifiques (Admin) et la moyenne des signalements citoyens de la commune." },
  { categorie: "Peche", ordre: 23, question: "Que signifient les longueurs en CM sur les fiches ?", reponse: "Ce sont des repères pour vous aider à classer votre prise (ex: < 30cm = Petit) afin de consulter le bon taux de risque." },
  { categorie: "Peche", ordre: 24, question: "Comment contribuer à l'indice de risque ?", reponse: "Cliquez sur 'Ajuster le % de gratte', choisissez la taille du poisson et indiquez votre ressenti ou constatation. Votre vote met à jour la commune." },
  { categorie: "Peche", ordre: 25, question: "Quelle lune pour le crabe de palétuvier ?", reponse: "Le crabe est 'plein' autour de la nouvelle et pleine lune (vives-eaux)." },
  { categorie: "Peche", ordre: 26, question: "Pourquoi mon spot a disparu ?", reponse: "Vérifiez que vous êtes connecté au même compte. Les spots sont liés à votre email." },
  { categorie: "Peche", ordre: 27, question: "Comment utiliser l'IA 'Quel spot maintenant ?' ?", reponse: "L'IA analyse vos spots enregistrés et choisit le meilleur selon votre position GPS et la marée actuelle." },
  { categorie: "Peche", ordre: 28, question: "Mon signalement de gratte est-il anonyme ?", reponse: "Oui, il est utilisé uniquement pour mettre à jour les statistiques de sécurité collectives de la commune." },
  { categorie: "Peche", ordre: 29, question: "Comment partager un coin de pêche avec un ami ?", reponse: "Dans votre carnet de pêche, ouvrez les détails du spot et cliquez sur l'icône 'Partager' (avion en papier). Saisissez l'e-mail de votre ami et validez l'envoi." },
  { categorie: "Peche", ordre: 30, question: "L'importation d'un spot partagé est-elle automatique ?", reponse: "Oui. Dès que le destinataire ouvre son carnet de pêche, une notification s'affiche et le spot est automatiquement ajouté à sa liste personnelle." },

  // --- BOAT TRACKER (25) ---
  { categorie: "Boat Tracker", ordre: 41, question: "Comment fonctionne le statut 'Dérive' ?", reponse: "L'app compare votre position chaque minute. Si vous vous déplacez lentement (entre 20m et 100m en 1 min), le statut 'À la dérive' s'active automatiquement pour prévenir vos contacts." },
  { categorie: "Boat Tracker", ordre: 42, question: "Comment marche le Mode Fantôme ?", reponse: "Il masque votre position GPS pour les membres de la Flotte (C) uniquement. Vous restez totalement visible pour votre Récepteur (B) privilégié." },
  { categorie: "Boat Tracker", ordre: 43, question: "Puis-je partager des photos de mes prises ?", reponse: "Oui, utilisez le bouton 'PRISE' dans la grille tactique. La photo sera épinglée sur la carte à votre position exacte et visible par toute votre flotte." },
  { categorie: "Boat Tracker", ordre: 44, question: "Le Mode Fantôme me protège-t-il en cas d'urgence ?", reponse: "Oui ! En cas de 'Demande d'Assistance', votre anonymat est levé pour permettre aux secours et à la flotte de vous localiser immédiatement." },
  { categorie: "Boat Tracker", ordre: 45, question: "Pourquoi mon navire est-il mis à jour chaque minute ?", reponse: "C'est une sécurité forcer pour garantir une détection immédiate des anomalies (dérive, immobilité prolongée) et un calcul précis de votre temps d'activité." },
  { categorie: "Boat Tracker", ordre: 46, question: "À quoi sert la 'Veille Stratégique' ?", reponse: "C'est une alarme sonore chez le récepteur. Si le navire suivi reste immobile (mouillage) plus longtemps que le délai défini (ex: 1h), une alerte retentit." },
  { categorie: "Boat Tracker", ordre: 47, question: "Que signifie l'icône de vagues 'Sardines' ?", reponse: "Elle permet de signaler un banc de sardines ou de friture en surface, différenciant ainsi les zones de chasse des prises individuelles (Marlin, Thon)." },
  { categorie: "Boat Tracker", ordre: 48, question: "Comment effacer les traces tactiques ?", reponse: "Seul l'Émetteur (A) peut vider le journal tactique pour tout le groupe via le bouton 'Effacer'. Le récepteur ne vide que sa propre vue locale." },
  { categorie: "Boat Tracker", ordre: 49, question: "Peut-on mettre des sons en boucle ?", reponse: "Oui, dans les réglages sons, l'option 'Boucle' permet de faire sonner l'alerte en continu jusqu'à l'arrêt manuel via le bouton rouge en haut de l'écran." },
  { categorie: "Boat Tracker", ordre: 50, question: "L'app prévient-elle si la batterie du bateau faiblit ?", reponse: "L'app surveille la batterie du smartphone émetteur. Une notification sonore (configurable) est envoyée dès qu'elle descend sous votre seuil de sécurité (ex: 20%)." },

  // --- CHASSE (15) ---
  { categorie: "Chasse", ordre: 61, question: "Comment rejoindre une battue ?", reponse: "Entrez le code session (CH-XXXX) fourni par l'organisateur." },
  { categorie: "Chasse", ordre: 62, question: "Pourquoi signaler 'Gibier en vue' ?", reponse: "Cela envoie une notification push et un son immédiat à tous vos partenaires." },
  { categorie: "Chasse", ordre: 63, question: "La table de tir est-elle balistique ?", reponse: "C'est une simulation théorique basée sur un zérotage à 100m. Réglez toujours votre arme en réel." },
  { categorie: "Chasse", ordre: 64, question: "Comment fonctionne la détection de collision ?", reponse: "Si vous réglez votre angle de tir (cône bleu) et qu'un coéquipier y pénètre, une alerte sonore retentit chez vous deux pour éviter tout accident." },
  { categorie: "Chasse", ordre: 65, question: "Puis-je changer ma couleur sur la carte ?", reponse: "Oui, dans vos préférences de profil ou dans les réglages de la session." },
  { categorie: "Chasse", ordre: 66, question: "Comment utiliser 'Mon Râtelier' ?", reponse: "Enregistrez vos carabines avec leur calibre et munition. Dans la Table de Tir, 'Chargez' l'arme pour obtenir instantanément les clics de correction selon la distance." },

  // --- CHAMPS (15) ---
  { categorie: "Champs", ordre: 76, question: "Pourquoi l'arrosage est en secondes ?", reponse: "Pour vous aider à doser précisément au jet d'eau selon les besoins de chaque plante." },
  { categorie: "Champs", ordre: 77, question: "C'est quoi un jour 'Racines' ?", reponse: "Un jour où l'influence lunaire favorise les carottes, oignons, radis, etc." },
  { categorie: "Champs", ordre: 78, question: "Le scanner diagnostique-t-ils les maladies ?", reponse: "Oui, photographiez une feuille abîmée pour obtenir un conseil de traitement local." },
  { categorie: "Champs", ordre: 79, question: "Comment marche le Bilan Stratégique ?", reponse: "L'IA analyse votre inventaire jardin et la météo live pour créer votre plan d'action du jour (priorités, taille, arrosage)." },

  // --- COMPTE (10) ---
  { categorie: "Compte", ordre: 91, question: "Comment activer un jeton cadeau ?", reponse: "Allez dans 'Compte', saisissez le code dans 'Activer un jeton' et validez." },
  { categorie: "Compte", ordre: 92, question: "Comment résilier mon abonnement ?", reponse: "L'abonnement est géré via votre compte PayPal ou les réglages de votre store mobile." },
  { categorie: "Compte", ordre: 93, question: "J'ai oublié mon mot de passe ?", reponse: "Sur l'écran de connexion, cliquez sur 'Mot de passe oublié' pour recevoir un mail de réinitialisation." },
];

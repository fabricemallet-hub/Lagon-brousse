# **App Name**: Marées et Terroir Calédonien

## Core Features:

- Informations sur les marées: Afficher les horaires des marées pour la commune sélectionnée en Nouvelle-Calédonie, à partir des données de l'API World Tides.
- Prévisions météorologiques: Afficher les prévisions météorologiques pour la commune sélectionnée à l'aide de l'API Open-Meteo, en indiquant la vitesse et la direction du vent, ainsi que les détails de la houle.
- Analyse de la houle: Afficher la hauteur et la période de la houle (fréquence des vagues) à l'intérieur et à l'extérieur du lagon à l'aide de l'API Stormglass.
- Outil de prédiction de la pêche: Fournir une prédiction de succès de la pêche basée sur les conditions de marée, l'heure de la journée (aube/crépuscule) et la phase lunaire. Le LLM raisonne si ces facteurs rendent la pêche plus ou moins favorable. Cet outil utilise une approche d'IA générative.
- Données du soleil et de la lune: Afficher les heures de lever et de coucher du soleil, de lever et de coucher de la lune, ainsi que la phase lunaire, à l'aide de l'API Astronomy.
- Force du courant de marée: Afficher la force du courant de marée à l'aide d'un indicateur de jauge, le plus fort à mi-marée.
- Calendrier agricole: Fournir un calendrier de jardinage basé sur les phases lunaires, indiquant les moments optimaux pour la plantation, la taille et le greffage selon les traditions néo-calédoniennes. Affiche des recommandations pour les fruits, les fleurs et les légumes.
- Abonnement: L'accès à cette application nécessitera un enregistrement par e-mail avec une version gratuite de 3 mois, puis un abonnement payant de 500 francs par mois.

## Style Guidelines:

- Couleur primaire : Bleu océan profond (#3498db), évoquant la mer et le ciel.
- Couleur de fond : Gris-bleu très clair (#ecf0f1), offrant une toile de fond apaisante.
- Couleur d'accent : Orange coucher de soleil (#e67e22) pour mettre en évidence les informations clés et les appels à l'action.
- Police du corps et des titres : 'PT Sans' pour une expérience utilisateur moderne et lisible.
- Utiliser des icônes claires et intuitives pour les conditions météorologiques, les états de marée et les tâches agricoles. Les icônes changeront subtilement en fonction des prédictions pertinentes (par exemple, une icône de poisson brillant pour de bonnes conditions de pêche).
- Mettre en œuvre une barre de navigation inférieure avec les sections 'Accueil', 'Lagon' et 'Champs' pour un accès facile aux fonctionnalités de base de l'application.
- Employer des transitions fluides et des animations de chargement pour améliorer l'expérience utilisateur. Ajouter un effet de scintillement subtil à l'icône de pêche lorsque l'indice de pêche est élevé.
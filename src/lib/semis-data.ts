export type Vegetable = {
  name: string;
  icon: string;
  sowingSeasonWarm: string;
  sowingSeasonCool: string;
  harvestWarm: string;
  harvestCool: string;
  advice: {
    plantingLocation: string;
    sunlight: string;
    watering: string;
    soilFertilizer: string;
    pests: string;
    grandmaRecipe: string;
  };
};

export const semisData: Vegetable[] = [
  {
    name: 'Carotte',
    icon: '🥕',
    sowingSeasonWarm: 'Mars à Mai (préfère la fraîcheur)',
    sowingSeasonCool: 'Février à Juin',
    harvestWarm: 'Juin à Août',
    harvestCool: 'Mai à Septembre',
    advice: {
      plantingLocation: 'Semis direct en pleine terre, dans des sillons peu profonds. Éclaircir pour laisser de l\'espace.',
      sunlight: 'Plein soleil à mi-ombre légère.',
      watering: 'Arrosage régulier pour maintenir un sol frais. Un manque d\'eau peut rendre les carottes fibreuses.',
      soilFertilizer: 'Sol très léger, sableux et profond, sans cailloux. Éviter le fumier frais qui fait fourcher les racines.',
      pests: 'Mouche de la carotte.',
      grandmaRecipe: 'Associer la culture avec des poireaux, oignons ou de la ciboulette : leur odeur forte repousse la mouche de la carotte. Les radis et les laitues, à cycle court, peuvent être plantés entre les rangs pour optimiser l\'espace.'
    }
  },
  {
    name: 'Chou de Chine (Pak Choi)',
    icon: '🥬',
    sowingSeasonWarm: 'Toute l\'année, mais préfère la fraîcheur',
    sowingSeasonCool: 'Février à Juin',
    harvestWarm: '30-45 jours après le semis',
    harvestCool: '30-45 jours après le semis',
    advice: {
      plantingLocation: 'En ligne, directement en place. Culture très rapide.',
      sunlight: 'Mi-ombre, surtout en saison chaude pour éviter une montée en graine rapide.',
      watering: 'Arrosage très régulier pour garder le sol frais.',
      soilFertilizer: 'Sol riche en humus.',
      pests: 'Altises (petits coléoptères qui font des trous dans les feuilles), limaces.',
      grandmaRecipe: 'Plantez-le à côté de la menthe, du romarin ou de l\'aneth pour aider à repousser les insectes. Sa croissance rapide en fait un bon choix pour occuper l\'espace entre des cultures plus lentes comme les tomates ou les aubergines.'
    }
  },
  {
    name: 'Chouchoute (Chayote)',
    icon: '🍈',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: 'Mars à Mai',
    harvestWarm: 'Janvier à Mai (récolte continue)',
    harvestCool: 'Juin à Septembre (récolte continue)',
    advice: {
      plantingLocation:
        'Planter le fruit entier, pointe vers le bas, à moitié enterré. Prévoir un support très solide (grillage, treille, pergola) car la plante est une liane vigoureuse.',
      sunlight: 'Plein soleil à mi-ombre légère.',
      watering:
        'Arrosage régulier et abondant, surtout pendant les périodes sèches. Le paillage est fortement recommandé pour conserver l\'humidité.',
      soilFertilizer:
        'Sol riche en matière organique et bien drainé. Un bon apport de compost à la plantation est idéal.',
      pests: 'Les mouches des fruits peuvent piquer les jeunes chouchoutes. Peu de maladies si bien aérée.',
      grandmaRecipe:
        'Sa croissance est très vigoureuse, elle peut servir d\'ombrage à des cultures craignant le soleil direct. Le maïs peut lui servir de tuteur naturel et les haricots plantés à son pied enrichiront le sol en azote.',
    },
  },
  {
    name: 'Ciboule / Oignon vert',
    icon: '🌿',
    sowingSeasonWarm: 'Toute l\'année',
    sowingSeasonCool: 'Toute l\'année',
    harvestWarm: 'Toute l\'année, au besoin',
    harvestCool: 'Toute l\'année, au besoin',
    advice: {
      plantingLocation: 'Semis en ligne, culture très facile. Peut se multiplier par division des touffes.',
      sunlight: 'Plein soleil à mi-ombre.',
      watering: 'Arrosage régulier pour une croissance rapide et des tiges tendres.',
      soilFertilizer: 'Sol frais et riche en humus.',
      pests: 'Généralement très résistant.',
      grandmaRecipe: 'Excellent voisin pour les carottes, tomates et salades, il aide à éloigner certains nuisibles. Éviter de le planter près des haricots et des pois, car il peut inhiber leur croissance.'
    }
  },
  {
    name: 'Concombre',
    icon: '🥒',
    sowingSeasonWarm: 'Septembre à Janvier',
    sowingSeasonCool: 'Mars à Avril',
    harvestWarm: 'Novembre à Mars',
    harvestCool: 'Mai à Juin',
    advice: {
      plantingLocation: 'Faire grimper sur un treillis ou un grillage pour un gain de place et une meilleure aération.',
      sunlight: 'Plein soleil.',
      watering: 'Arrosage très régulier au pied, le concombre est gourmand en eau. Pailler généreusement.',
      soilFertilizer: 'Sol riche, frais et bien fumé.',
      pests: 'Oïdium, mildiou, araignées rouges.',
      grandmaRecipe: 'La fameuse association des "trois sœurs" avec le maïs (qui sert de tuteur) et les haricots (qui fixent l\'azote) est parfaite. Les soucis (tagètes) à proximité peuvent repousser les nématodes du sol.'
    }
  },
  {
    name: 'Courgette',
    icon: '🥒',
    sowingSeasonWarm: 'Septembre à Janvier',
    sowingSeasonCool: 'Mars à Avril',
    harvestWarm: 'Novembre à Mars',
    harvestCool: 'Mai à Juin',
    advice: {
      plantingLocation:
        'Prévoir de l\'espace, la plante est coureuse. Planter en poquets de 2-3 graines.',
      sunlight: 'Plein soleil.',
      watering:
        'Arrosage régulier et abondant au pied. Un bon paillage est très bénéfique.',
      soilFertilizer:
        'Sol très riche en matière organique. Incorporer du compost ou du fumier bien décomposé à la plantation.',
      pests: 'Oïdium (poudre blanche sur les feuilles), pucerons.',
      grandmaRecipe:
        'Plantez des capucines à proximité comme "plante piège", elles attireront les pucerons. L\'association "trois sœurs" (courge, maïs, haricot) est excellente : le maïs sert de tuteur au haricot qui fixe l\'azote pour la courgette qui couvre le sol.',
    },
  },
  {
    name: 'Haricot Vert',
    icon: '🫛',
    sowingSeasonWarm: 'Septembre à Décembre',
    sowingSeasonCool: 'Mars à Mai',
    harvestWarm: 'Novembre à Février',
    harvestCool: 'Mai à Juillet',
    advice: {
      plantingLocation: 'Semis direct en ligne. Variétés naines ou à rames (prévoir un support).',
      sunlight: 'Plein soleil.',
      watering: 'Arrosage régulier au pied sans mouiller le feuillage, surtout pendant la floraison et la formation des gousses.',
      soilFertilizer: 'Sol léger et bien réchauffé. Le haricot fixe l\'azote, donc pas besoin d\'un engrais trop riche en azote.',
      pests: 'Pucerons, araignées rouges, rouille.',
      grandmaRecipe: 'En tant que légumineuse, il fixe l\'azote de l\'air dans le sol, ce qui en fait un excellent "engrais vert" pour les cultures gourmandes plantées après, ou à côté comme le maïs, les courges, et les fraises. Évitez l\'ail, l\'oignon et le fenouil.'
    }
  },
  {
    name: 'Herbes Aromatiques',
    icon: '🌿',
    sowingSeasonWarm: 'Persil: toute l\'année. Thym: semis au frais ou bouturage.',
    sowingSeasonCool: 'Persil: toute l\'année. Thym: semis au frais ou bouturage.',
    harvestWarm: 'Au besoin',
    harvestCool: 'Au besoin',
    advice: {
      plantingLocation: 'En pot, en jardinière ou en bordure de potager. Facile à cultiver.',
      sunlight: 'Persil: mi-ombre. Thym: plein soleil.',
      watering: 'Persil: sol toujours frais. Thym: supporte la sécheresse, arrosage modéré.',
      soilFertilizer: 'Sol léger et bien drainé. Pas trop d\'engrais pour ne pas diluer les arômes.',
      pests: 'Pucerons sur le persil.',
      grandmaRecipe: 'Utilisez-les comme des gardes du corps ! Le basilic près des tomates repousse les pucerons, la menthe près des choux éloigne la piéride, et le romarin près des haricots dissuade la mouche du haricot. Un véritable jardin protecteur.'
    }
  },
  {
    name: 'Igname',
    icon: '🍠',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Mai à Septembre (après 8-10 mois)',
    harvestCool: 'Mai à Septembre (après 8-10 mois)',
    advice: {
      plantingLocation: 'Planter les tubercules (ou morceaux) sur des buttes de terre meuble et riche. Prévoir un tuteur solide pour la liane.',
      sunlight: 'Plein soleil indispensable.',
      watering: 'Besoins en eau réguliers, surtout en début de croissance. Le paillage est crucial pour maintenir l\'humidité.',
      soilFertilizer: 'Sol très riche en humus, profond et bien drainé. Un apport de compost à la préparation des buttes est essentiel.',
      pests: 'Nématodes, cochenilles. Pourriture si le sol est mal drainé.',
      grandmaRecipe: 'La culture de l\'igname est un pilier de la culture Kanak. Elle peut être associée à des haricots grimpants qui utiliseront les tuteurs et enrichiront le sol en azote. La rotation des cultures reste la meilleure "recette" pour un sol sain.'
    }
  },
  {
    name: 'Manioc',
    icon: '🪵',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Toute l\'année (après 9-12 mois)',
    harvestCool: 'Toute l\'année (après 9-12 mois)',
    advice: {
      plantingLocation:
        'Planter des boutures de 20-30 cm, enterrées de moitié, inclinées ou à plat.',
      sunlight: 'Plein soleil.',
      watering:
        'Très résistant à la sécheresse une fois établi. Arroser les premières semaines après la plantation.',
      soilFertilizer:
        'S\'adapte à tous types de sols pauvres, mais préfère un sol léger et bien drainé. Pas d\'engrais nécessaire en général.',
      pests: 'Cochenilles, acariens.',
      grandmaRecipe:
        'Associez-le avec des légumineuses à croissance rapide comme le haricot d\'Espagne ou le pois d\'Angole. Elles couvriront le sol pour limiter les mauvaises herbes et l\'enrichiront en azote, un engrais naturel gratuit.',
    },
  },
  {
    name: 'Oignon',
    icon: '🧅',
    sowingSeasonWarm: 'Avril à Juin (pour récolte en sec)',
    sowingSeasonCool: 'Mars à Mai',
    harvestWarm: 'Septembre à Novembre',
    harvestCool: 'Août à Octobre',
    advice: {
      plantingLocation: 'Semis direct ou plantation de bulbilles. Espacer les rangs pour faciliter le désherbage.',
      sunlight: 'Plein soleil.',
      watering: 'Arrosage modéré au début. Cesser l\'arrosage quand les feuilles commencent à jaunir pour permettre aux bulbes de sécher.',
      soilFertilizer: 'Sol bien drainé, sans fumure fraîche. Apprécie les sols ayant porté une culture gourmande l\'année précédente.',
      pests: 'Mildiou de l\'oignon, mouche de l\'oignon.',
      grandmaRecipe: 'L\'association avec la carotte est classique : l\'un repousse la mouche de l\'autre. Les salades et les fraises sont aussi de bons compagnons. À l\'inverse, tenez-le éloigné des haricots, pois et fèves.'
    }
  },
  {
    name: 'Pastèque',
    icon: '🍉',
    sowingSeasonWarm: 'Septembre à Décembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Décembre à Mars',
    harvestCool: '-',
    advice: {
      plantingLocation: 'Nécessite beaucoup d\'espace pour courir. Planter sur une butte enrichie en compost.',
      sunlight: 'Plein soleil et chaleur indispensables.',
      watering: 'Arrosage abondant et régulier au pied. Cesser l\'arrosage 1 à 2 semaines avant la récolte pour concentrer les sucres dans le fruit.',
      soilFertilizer: 'Sol très riche et bien drainé.',
      pests: 'Mildiou, oïdium.',
      grandmaRecipe: 'Les soucis (tagètes) et les capucines plantés à proximité attirent les pollinisateurs et peuvent repousser certains nuisibles. Elle apprécie la compagnie de l\'origan qui aide à éloigner les insectes.'
    }
  },
  {
    name: 'Patate douce',
    icon: '🍠',
    sowingSeasonWarm: 'Octobre à Décembre',
    sowingSeasonCool: '-',
    harvestWarm: 'Mars à Mai',
    harvestCool: '-',
    advice: {
      plantingLocation:
        'En buttes ou planches surélevées pour favoriser le développement des tubercules et le drainage.',
      sunlight: 'Beaucoup de soleil et de chaleur.',
      watering:
        'Arrosage régulier, surtout pendant les premières semaines. Diminuer l\'arrosage un mois avant la récolte pour favoriser la tubérisation.',
      soilFertilizer: 'Sol léger, sableux et bien drainé. N\'aime pas les excès d\'azote qui favorisent le feuillage au détriment des tubercules.',
      pests: 'Charançons de la patate douce, rats.',
      grandmaRecipe:
        'Son feuillage dense est un excellent couvre-sol qui limite les mauvaises herbes. Plantez-la avec des haricots nains ou de l\'origan. Évitez la proximité des courges qui peuvent entrer en compétition avec elle.',
    },
  },
  {
    name: 'Piment',
    icon: '🌶️',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: 'Mars à Mai (en zone abritée)',
    harvestWarm: 'Toute l\'année si bien entretenu',
    harvestCool: 'Toute l\'année si bien entretenu',
    advice: {
      plantingLocation: 'En pot ou en pleine terre dans un endroit chaud et abrité du vent.',
      sunlight: 'Plein soleil et chaleur.',
      watering: 'Arrosage modéré mais régulier. Laisser la terre sécher légèrement entre deux arrosages.',
      soilFertilizer: 'Sol bien drainé, pas trop riche. Un excès d\'engrais favorise le feuillage au détriment des fruits.',
      pests: 'Pucerons et aleurodes.',
      grandmaRecipe: 'Le basilic planté à proximité peut améliorer la croissance et la saveur des piments, tout en repoussant pucerons et acariens. La consoude utilisée en paillage se décompose en un excellent fertilisant naturel, riche en potasse.'
    }
  },
  {
    name: 'Pomme de terre',
    icon: '🥔',
    sowingSeasonWarm: 'Août à Octobre (saison fraîche arrivant)',
    sowingSeasonCool: 'Février à Avril',
    harvestWarm: 'Novembre à Janvier',
    harvestCool: 'Mai à Juillet',
    advice: {
      plantingLocation: 'Planter les tubercules germés dans des sillons, puis butter les plants au fur et à mesure de leur croissance pour protéger les nouvelles pommes de terre de la lumière.',
      sunlight: 'Plein soleil.',
      watering: 'Arrosage régulier lors de la formation des tubercules, mais sans excès pour éviter les maladies.',
      soilFertilizer: 'Sol riche et bien ameubli. Apprécie un bon apport de compost.',
      pests: 'Mildiou, doryphores (moins présents en NC).',
      grandmaRecipe: 'Les haricots nains plantés entre les rangs enrichissent le sol en azote. L\'œillet d\'Inde (tagète) est réputé pour éloigner les nématodes et doryphores. Évitez la proximité des tomates et des courges.'
    }
  },
  {
    name: 'Salade (Laitue)',
    icon: '🥬',
    sowingSeasonWarm: 'Toute l\'année (privilégier les variétés résistantes à la chaleur)',
    sowingSeasonCool: 'Toute l\'année',
    harvestWarm: '30 à 50 jours après le semis',
    harvestCool: '40 à 60 jours après le semis',
    advice: {
      plantingLocation:
        'Mi-ombre en saison chaude pour éviter qu\'elle ne monte en graines trop vite. Plein soleil en saison fraîche.',
      sunlight: 'Soleil doux le matin, ombre pendant les heures les plus chaudes.',
      watering:
        'Arrosages légers mais très fréquents pour maintenir un sol frais mais pas détrempé. Le goutte-à-goutte est idéal.',
      soilFertilizer: 'Sol léger, humifère et frais. Un bon compost suffit.',
      pests: 'Limaces et escargots.',
      grandmaRecipe:
        'Les radis semés à proximité ont un cycle court et seront récoltés avant que la salade ne prenne toute la place. Le souci et le basilic aident à éloigner les nuisibles, tandis que les haricots à proximité lui fourniront de l\'azote. Évitez le persil.',
    },
  },
  {
    name: 'Taro',
    icon: '🌿',
    sowingSeasonWarm: 'Septembre à Février',
    sowingSeasonCool: 'Toute l\'année dans les zones humides',
    harvestWarm: 'Après 8-12 mois',
    harvestCool: 'Après 8-12 mois',
    advice: {
      plantingLocation: 'Dans un sol très humide, voire marécageux. Idéal en bord de "creek" (ruisseau).',
      sunlight: 'Mi-ombre à ensoleillé, mais apprécie l\'humidité constante.',
      watering: 'Nécessite beaucoup d\'eau, le sol ne doit jamais sécher. L\'irrigation par inondation est parfois pratiquée.',
      soilFertilizer: 'Sol très riche en matière organique, vaseux. Apprécie un bon paillage de feuilles.',
      pests: 'Doryphores du taro, pourriture des tubercules en cas de mauvais drainage.',
      grandmaRecipe: 'Le taro prospère dans un écosystème riche. Les plantes de berge comme les fougères aident à maintenir l\'humidité. La jacinthe d\'eau, si elle est contrôlée, peut servir d\'engrais vert en surface.'
    }
  },
  {
    name: 'Tomate',
    icon: '🍅',
    sowingSeasonWarm: 'Septembre à Novembre',
    sowingSeasonCool: 'Mars à Mai',
    harvestWarm: 'Décembre à Mars',
    harvestCool: 'Juin à Août',
    advice: {
      plantingLocation:
        'En pleine terre, dans un endroit abrité des vents dominants. Tuteurer solidement.',
      sunlight: 'Plein soleil indispensable (minimum 6-8 heures par jour).',
      watering:
        'Arrosage régulier et copieux au pied, jamais sur le feuillage pour éviter le mildiou. Pailler le sol pour garder l\'humidité.',
      soilFertilizer:
        'Sol riche, profond et bien drainé. Enrichir avec du compost bien mûr et un engrais spécial tomates.',
      pests: 'Mildiou, pucerons, aleurodes (mouches blanches), vers.',
      grandmaRecipe:
        'L\'association avec le basilic et l\'œillet d\'Inde (tagète) est un classique pour repousser les nuisibles (pucerons, nématodes). Plantez des carottes ou du céleri à proximité, mais évitez les pommes de terre qui partagent les mêmes maladies (mildiou).',
    },
  },
];

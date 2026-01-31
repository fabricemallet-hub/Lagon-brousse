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
    name: 'Basilic',
    icon: '🌿',
    sowingSeasonWarm: 'Toute l\'année',
    sowingSeasonCool: 'Toute l\'année, à l\'abri des coups de frais',
    harvestWarm: 'Toute l\'année, feuille par feuille au besoin',
    harvestCool: 'Toute l\'année, feuille par feuille au besoin',
    advice: {
      plantingLocation: 'En pot, jardinière ou en pleine terre. Idéal en bordure de potager, près des tomates.',
      sunlight: 'Plein soleil à mi-ombre légère. Aime la chaleur.',
      watering: 'Arrosage régulier à la base, sans mouiller le feuillage. Le sol doit rester frais mais bien drainé.',
      soilFertilizer: 'Sol léger, riche en humus et bien drainé. Un bon compost est suffisant.',
      pests: 'Pucerons, limaces. Attention au mildiou si le feuillage est trop humide.',
      grandmaRecipe: 'Le meilleur ami de la tomate ! Plantez-le à proximité pour repousser les pucerons et améliorer leur croissance. Pincez régulièrement les têtes (les bouquets de fleurs) pour l\'empêcher de fleurir et l\'inciter à produire plus de feuilles. Étant annuel, vous pouvez simplement l\'arracher en fin de saison et enrichir le sol avec du compost avant la culture suivante.'
    }
  },
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
      grandmaRecipe: 'Associez-la avec des poireaux, oignons ou de la ciboulette : leur odeur forte repousse la mouche de la carotte. Après la récolte, enrichissez le sol en plantant des légumineuses (haricots, pois) qui fixeront l\'azote pour la culture suivante.'
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
      grandmaRecipe: 'Plantez-le à côté de la menthe ou du romarin pour aider à repousser les insectes. Sa croissance rapide en fait un bon choix pour occuper l\'espace entre des cultures plus lentes. Après récolte, aérez le sol et incorporez du compost avant de planter des légumes-racines.'
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
        'Le maïs peut lui servir de tuteur naturel et les haricots plantés à son pied enrichiront le sol en azote. Après la fin de sa production, coupez les tiges et laissez-les au sol comme paillis pour la saison suivante, après avoir bien amendé avec du compost car c\'est une plante gourmande.',
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
      grandmaRecipe: 'Excellent voisin pour les carottes et tomates, il aide à éloigner certains nuisibles. Comme c\'est une culture pérenne, il n\'est pas nécessaire de le remplacer, mais vous pouvez le diviser pour le replanter ailleurs et aérer le sol.'
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
      grandmaRecipe: 'Plantez des soucis (tagètes) à proximité pour repousser les nématodes. Le maïs peut lui servir de tuteur. Après cette culture gourmande, plantez un engrais vert comme la moutarde ou des légumineuses (pois, fèves) pour régénérer le sol.'
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
        'Plantez des capucines à proximité comme "plante piège" pour les pucerons. L\'association avec le maïs et le haricot est excellente. Étant gourmande, il est bon de planter un engrais vert (phacélie, moutarde) après la culture pour reposer et nourrir la terre.',
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
      grandmaRecipe: 'Compagnon idéal des maïs, courges, et fraises. Après la récolte, coupez les pieds mais laissez les racines en terre. Elles se décomposeront et libéreront l\'azote qu\'elles ont stocké, un vrai cadeau pour votre prochaine culture de légumes-feuilles (salades, choux).'
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
      grandmaRecipe: 'Utilisez-les comme des gardes du corps ! Le basilic près des tomates repousse les pucerons, la menthe près des choux éloigne la piéride. La plupart étant des vivaces, elles structurent le jardin d\'année en année.'
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
      grandmaRecipe: 'La culture de l\'igname est un pilier de la culture Kanak. Pour ne pas épuiser le sol, pratiquez la rotation : après l\'igname, plantez des légumineuses comme le pois d\'Angole ou laissez la parcelle en jachère avec un couvert végétal.'
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
        'Associez-le avec des légumineuses qui couvriront le sol et l\'enrichiront en azote. Le manioc peut rester en terre plusieurs années, mais lorsque vous changez de parcelle, plantez un engrais vert (comme le crotalaire) pour régénérer le sol qu\'il a occupé.',
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
      grandmaRecipe: 'L\'association avec la carotte est classique. Après la récolte des oignons, le sol est propre. C\'est un bon emplacement pour semer des salades ou des épinards pour l\'hiver.'
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
      grandmaRecipe: 'Elle apprécie la compagnie de l\'origan. C\'est une culture très gourmande, ne replantez pas de cucurbitacées (melon, courgette) au même endroit. Préférez des haricots ou des fèves pour la saison suivante afin de nourrir la terre.'
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
        'Son feuillage dense est un excellent couvre-sol. Après la récolte, le sol est propre et ameubli. C\'est l\'occasion de planter des légumes-feuilles comme des salades ou des brèdes qui profiteront de la terre légère.',
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
      grandmaRecipe: 'Le basilic près des piments peut améliorer leur saveur. Comme le piment peut rester en place plusieurs années, il n\'est pas nécessaire de faire une rotation immédiate, mais pensez à nourrir le sol avec du compost chaque année.'
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
      grandmaRecipe: 'Associez-la avec des haricots nains. Après avoir récolté les pommes de terre, le sol est bien meuble. C\'est parfait pour semer ensuite des carottes, des radis ou des salades. Ne replantez pas de tomates ou d\'aubergines (même famille).'
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
        'Les radis semés à proximité ont un cycle court et seront récoltés avant que la salade ne prenne toute la place. La salade est une culture "légère", elle peut être suivie par presque n\'importe quel légume. C\'est une bonne culture pour commencer un cycle de rotation.',
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
      grandmaRecipe: 'Le taro est une culture exigeante qui structure son environnement humide. Après une culture de taro, la parcelle est très riche en matière organique. Il est bon de laisser le sol se reposer ou de planter d\'autres plantes de milieu humide qui ne sont pas des tubercules.'
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
        'L\'association avec le basilic et l\'œillet d\'Inde (tagète) est un classique. La tomate est très gourmande. Après la récolte, il est indispensable de nourrir le sol. Le mieux est de planter un engrais vert (légumineuses, phacélie) que vous faucherez avant qu\'il ne monte en graines.',
    },
  },
];

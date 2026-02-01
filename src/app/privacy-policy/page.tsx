'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Règles de Confidentialité</CardTitle>
          <CardDescription>Dernière mise à jour : 24 Mai 2024</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-muted-foreground">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">Introduction</h2>
            <p>
              Bienvenue sur Lagon & Brousse NC. Votre vie privée est importante pour nous. Cette politique de confidentialité a pour but de vous informer sur la manière dont nous collectons, utilisons et protégeons vos informations lorsque vous utilisez notre application.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">1. Collecte des informations</h2>
            <p>
              Lorsque vous créez un compte sur notre application, nous collectons les informations suivantes :
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Votre adresse e-mail.</li>
              <li>Un identifiant utilisateur unique généré automatiquement par notre système d'authentification (Firebase).</li>
            </ul>
            <p>
              Ces informations sont indispensables pour sécuriser votre accès, gérer votre compte, et sauvegarder vos préférences (comme votre commune favorite).
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">2. Utilisation des informations</h2>
            <p>
              Les informations que nous collectons sont utilisées exclusivement pour :
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Fournir, maintenir et améliorer les fonctionnalités de l'application.</li>
              <li>Gérer votre abonnement (période d'essai, statut actif).</li>
              <li>Personnaliser votre expérience au sein de l'application.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">3. Sécurité et stockage des données</h2>
            <p>
              Nous utilisons les services d'authentification et de base de données de Firebase, une plateforme de Google. Vos données, y compris votre e-mail et votre identifiant, sont stockées de manière sécurisée sur les serveurs de Firebase. Nous appliquons les règles de sécurité recommandées par Firebase pour protéger vos données contre tout accès, altération ou destruction non autorisés.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">4. Partage des informations</h2>
            <p>
              Nous nous engageons à ne jamais vendre, échanger, louer ou transférer vos informations personnelles identifiables à des tiers. Elles restent strictement confidentielles et ne sont utilisées que dans le cadre du fonctionnement de l'application Lagon & Brousse NC.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">5. Vos droits</h2>
            <p>
              Conformément à la réglementation, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles. Vous pouvez à tout moment demander la suppression complète de votre compte et des données associées en nous contactant via l'adresse e-mail de support indiquée sur notre fiche Play Store.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-card-foreground">6. Modifications de cette politique</h2>
            <p>
              Nous nous réservons le droit de modifier cette politique de confidentialité si nécessaire. Toute modification sera publiée sur cette même page avec une date de mise à jour.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

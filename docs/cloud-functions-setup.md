# Guide de déploiement des Cloud Functions (Notifications)

Pour activer l'envoi automatique d'emails lors de la création d'un ticket, suivez ces instructions sur votre ordinateur local.

## 1. Installation du CLI Firebase
Si vous ne l'avez pas encore, installez l'outil Firebase :
```bash
npm install -g firebase-tools
```

## 2. Connexion et Initialisation
Placez-vous à la racine de votre projet local, puis :
```bash
firebase login
firebase use studio-2943478321-f746e
```

## 3. Configuration de Gmail (App Password)
Pour que Google autorise l'envoi de mails depuis le serveur :
1. Allez sur votre compte Google (Sécurité).
2. Activez la **validation en deux étapes**.
3. Recherchez **"Mots de passe d'application"**.
4. Générez un code pour une application "Autre" (nommez-le "L&B Support").
5. Copiez le code de 16 caractères.

## 4. Définir le Secret et Déployer
Exécutez ces commandes pour configurer le mot de passe de manière sécurisée et déployer :

```bash
# Enregistrez le mot de passe de 16 caractères ici
firebase functions:secrets:set EMAIL_APP_PASSWORD

# Déployez la fonction vers le Cloud
firebase deploy --only functions
```

## 5. Vérification
Une fois le message "Deploy complete!" affiché, créez un ticket dans l'application. Vous recevrez instantanément une notification sur `f.mallet81@gmail.com`.

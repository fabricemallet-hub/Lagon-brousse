
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

/**
 * ATTRIBUTION AUTOMATIQUE DES ROLES
 * Écoute la création d'un document utilisateur.
 * Si le champ role est présent, on l'ajoute aux Custom Claims.
 */
exports.syncUserRoleToClaims = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const userData = change.after.exists ? change.after.data() : null;

    if (!userData || !userData.role) {
      // Nettoyer les claims si le doc est supprimé ou le rôle retiré
      return admin.auth().setCustomUserClaims(userId, null);
    }

    try {
      await admin.auth().setCustomUserClaims(userId, { role: userData.role });
      console.log(`Role ${userData.role} attribué à l'utilisateur ${userId}`);
    } catch (error) {
      console.error('Erreur lors de l\'attribution du claim:', error);
    }
  });

/**
 * NOTIFICATION ADMIN SUR TICKET
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'f.mallet81@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD 
  }
});

exports.notifyAdminOnTicket = functions.firestore
  .document('cms_support/tickets/items/{ticketId}')
  .onCreate(async (snap, context) => {
    const ticket = snap.data();
    const mailOptions = {
      from: '"Support Lagon & Brousse" <noreply@lagonbrousse.nc>',
      to: 'f.mallet81@gmail.com',
      subject: `[SUPPORT] Nouveau Ticket : ${ticket.sujet}`,
      html: `<h2>Nouveau ticket</h2><p><strong>De:</strong> ${ticket.userEmail}</p><p>${ticket.description}</p>`
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Erreur email:', error);
    }
  });

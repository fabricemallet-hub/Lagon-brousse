const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

/**
 * CONFIGURATION DU TRANSPORTEUR MAIL
 * Pour Gmail : Utilisez un "Mot de passe d'application" (App Password)
 * https://myaccount.google.com/apppasswords
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'f.mallet81@gmail.com',
    // Utilise Firebase Secrets pour le mot de passe (configuré via CLI)
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
      html: `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #3498db; margin-top: 0;">Nouveau ticket de support</h2>
          <p><strong>Utilisateur :</strong> ${ticket.userEmail}</p>
          <p><strong>Sujet :</strong> ${ticket.sujet}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p><strong>Message :</strong></p>
          <p style="background: #f9f9f9; padding: 15px; border-radius: 5px; font-style: italic;">"${ticket.description}"</p>
          <br>
          <a href="https://studio-2943478321-f746e.firebaseapp.com/admin" 
             style="display: inline-block; padding: 12px 25px; background: #3498db; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Répondre sur le Dashboard
          </a>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email envoyé pour le ticket ${context.params.ticketId}`);
    } catch (error) {
      console.error('Erreur d\'envoi email:', error);
    }
  });

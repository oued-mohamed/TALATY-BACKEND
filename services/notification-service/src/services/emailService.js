const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });

    console.log('Email service initialized');
  }

  async sendEmail(notification) {
    try {
      const { recipient, title, message, data } = notification;
      
      if (!recipient.email) {
        throw new Error('No email recipient specified');
      }

      const htmlContent = this.generateEmailHTML(title, message, data);

      const mailOptions = {
        from: `"Business eKYC" <${process.env.SMTP_EMAIL}>`,
        to: recipient.email,
        subject: title,
        text: message,
        html: htmlContent
      };

      if (process.env.NODE_ENV === 'production') {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
      } else {
        console.log('Email simulation - To:', recipient.email, 'Subject:', title);
        return { success: true, messageId: `sim_${Date.now()}`, simulated: true };
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  generateEmailHTML(title, message, data = {}) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a3a52; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #87ceeb; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Business eKYC</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>${message}</p>
            ${data.actionUrl ? `<p><a href="${data.actionUrl}" class="button">Voir les détails</a></p>` : ''}
          </div>
          <div class="footer">
            <p>Ceci est un email automatique, merci de ne pas répondre.</p>
            <p>© 2024 Business eKYC. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Pre-defined email templates
  async sendKYCStatusEmail(email, status, userName) {
    const templates = {
      completed: {
        title: 'Vérification KYC terminée avec succès',
        message: `Bonjour ${userName}, votre vérification d'identité a été complétée avec succès. Vous pouvez maintenant procéder à votre demande de crédit.`
      },
      rejected: {
        title: 'Vérification KYC nécessite votre attention',
        message: `Bonjour ${userName}, votre vérification d'identité nécessite des informations supplémentaires. Veuillez vous connecter pour plus de détails.`
      }
    };

    const template = templates[status];
    if (!template) return;

    const notification = {
      recipient: { email },
      title: template.title,
      message: template.message,
      data: { actionUrl: process.env.APP_URL }
    };

    return this.sendEmail(notification);
  }

  async sendApplicationStatusEmail(email, status, applicationNumber, userName) {
    const templates = {
      submitted: {
        title: 'Demande de crédit soumise',
        message: `Bonjour ${userName}, votre demande de crédit ${applicationNumber} a été soumise avec succès et est en cours d'examen.`
      },
      approved: {
        title: 'Demande de crédit approuvée',
        message: `Excellente nouvelle ${userName}! Votre demande de crédit ${applicationNumber} a été approuvée.`
      },
      rejected: {
        title: 'Demande de crédit non approuvée',
        message: `Bonjour ${userName}, malheureusement votre demande de crédit ${applicationNumber} n'a pas pu être approuvée à ce moment.`
      }
    };

    const template = templates[status];
    if (!template) return;

    const notification = {
      recipient: { email },
      title: template.title,
      message: template.message,
      data: { actionUrl: `${process.env.APP_URL}/applications/${applicationNumber}` }
    };

    return this.sendEmail(notification);
  }
}

const emailService = new EmailService();

const sendEmail = (notification) => {
  return emailService.sendEmail(notification);
};

module.exports = { sendEmail, emailService };
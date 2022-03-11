const nodemailer = require("nodemailer");

const sendMail = async (receiver, title, msg) => {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: process.env.HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.USER,
      pass: process.env.PASS,
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"Energia Powered" <energiapowered22@gmail.com>', // sender address
    to: receiver, // list of receivers
    subject: title, // Subject line
    text: msg, // plain text body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
};

module.exports = sendMail;

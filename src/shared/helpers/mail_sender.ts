import { readFileSync } from "fs";
import { compile } from "handlebars";
import mjml2html from "mjml";
import { resolve } from "path";

import * as nodemailer from "nodemailer";

export const sendMail = (
  to: string,
  subject: string,
  html: string
): Promise<nodemailer.SentMessageInfo> => {
  const transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || "gmail",
    // host: process.env.SMTP_SERVICE_PROD,
    port: 587,
    auth: {
      user: process.env.SMTP_USERNAME_DEV,
      pass: process.env.SMTP_PASSWORD_DEV,
      type: "Login",
    },
  });

  const mailOptions = {
    from: "info@etibe.xyz",
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
};

const convertFromMjmlToHtml = (path: string) => {
  const pathToMail = readFileSync(resolve(__dirname, path)).toString();
  return compile(mjml2html(pathToMail).html);
};

export const sendVerifyEmail = async (to: string, otp: string) => {
  return sendMail(
    to,
    "Verify Email",
    convertFromMjmlToHtml("../../templates/verify_email.mjml")({
      otp,
    })
  );
};

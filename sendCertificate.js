import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, name } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER, // your gmail
        pass: process.env.EMAIL_PASS  // app password
      }
    });

    const certificateUrl = "https://your-vercel-app.vercel.app/certificate.png";

    await transporter.sendMail({
      from: `"Pio Museo Quest" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your E-Certificate 🎉",
      html: `
        <h2>Congratulations, ${name}!</h2>
        <p>You have completed the Pio Museo Quest.</p>
        <p>Your certificate is attached below.</p>
      `,
      attachments: [
        {
          filename: "certificate.png",
          path: certificateUrl
        }
      ]
    });

    res.status(200).json({ message: "Email sent successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending email" });
  }
}

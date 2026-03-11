import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_EMAIL, SMTP_PASSWORD

def send_reminder_email(to_email: str, student_name: str, event_title: str, event_time: str):
    """Send an HTML reminder email using Gmail SMTP."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("SMTP credentials missing. Skipping email.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Reminder: {event_title} in 30 minutes"
    msg["From"] = f"StudyBuddy <{SMTP_EMAIL}>"
    msg["To"] = to_email

    html = f"""
    <html>
      <body style="font-family: sans-serif; background: #0a0a0c; color: #ffffff; padding: 20px;">
        <div style="max-width: 500px; margin: auto; background: #141418; border: 1px solid #2a2a30; border-radius: 12px; padding: 30px;">
          <h1 style="color: #6366f1; margin-top: 0;">Hi {student_name}!</h1>
          <p style="font-size: 16px; color: #d1d5db;">You have a scheduled study session coming up soon.</p>
          <div style="background: #1e1e24; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
            <strong style="display: block; font-size: 18px;">{event_title}</strong>
            <span style="color: #9ca3af;">Starts at {event_time}</span>
          </div>
          <p style="color: #9ca3af; font-size: 14px;">Keep up the great work! You've got this.</p>
          <hr style="border: none; border-top: 1px solid #2a2a30; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280; text-align: center;">Sent by your AI study companion, StudyBuddy.</p>
        </div>
      </body>
    </html>
    """
    msg.attach(MIMEText(html, "html"))

    try:
      # Gmail SMTP typically requires an App Password (not the account password).
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

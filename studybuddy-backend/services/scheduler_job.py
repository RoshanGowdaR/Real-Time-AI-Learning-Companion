import asyncio
import datetime

from services.email_service import send_reminder_email
from services.supabase_service import supabase

_scheduler_task: asyncio.Task | None = None


def _extract_student_contact(event: dict) -> tuple[str | None, str]:
    student_data = event.get("students")
    if isinstance(student_data, list):
        student_data = student_data[0] if student_data else {}

    if not isinstance(student_data, dict):
        return None, "Student"

    email = student_data.get("email")
    name = student_data.get("name") or "Student"
    return email, name


def _to_event_datetime(date_text: str, time_text: str) -> datetime.datetime:
    event_date = datetime.date.fromisoformat(str(date_text))
    time_parts = str(time_text).split(":")
    hour = int(time_parts[0])
    minute = int(time_parts[1])
    return datetime.datetime.combine(event_date, datetime.time(hour=hour, minute=minute))


async def check_and_send_reminders():
    """Persistent background task to check for upcoming schedule events and send reminders."""
    print("Email scheduler started...")

    sent_cache: set[str] = set()
    cache_day = datetime.date.today()

    while True:
        try:
            now = datetime.datetime.now()
            if now.date() != cache_day:
                sent_cache.clear()
                cache_day = now.date()

            target_time = now + datetime.timedelta(minutes=30)
            target_date = target_time.strftime("%Y-%m-%d")

            res = (
                supabase.table("schedule_events")
                .select("id, title, date, start_time, students(name, email)")
                .eq("date", target_date)
                .execute()
            )
            events = res.data or []

            for event in events:
                event_id = str(event.get("id", ""))
                start_time_str = str(event.get("start_time", ""))
                if not event_id or not start_time_str:
                    continue

                cache_key = f"{event_id}:{event.get('date')}:{start_time_str}"
                if cache_key in sent_cache:
                    continue

                try:
                    event_dt = _to_event_datetime(event.get("date"), start_time_str)
                except Exception as e:
                    print(f"Error parsing time for event {event_id}: {e}")
                    continue

                diff_minutes = (event_dt - now).total_seconds() / 60
                # Trigger only for events approximately 30 minutes away.
                if not (25 <= diff_minutes <= 31):
                    continue

                email, name = _extract_student_contact(event)
                if not email:
                    continue

                success = send_reminder_email(
                    to_email=email,
                    student_name=name,
                    event_title=event.get("title", "Study Session"),
                    event_time=start_time_str[:5],
                )
                if success:
                    sent_cache.add(cache_key)
                    print(f"Sent reminder to {email} for {event.get('title', 'Study Session')}")

        except Exception as e:
            print(f"Scheduler error: {e}")

        # Poll every 5 minutes.
        await asyncio.sleep(300)


def start_scheduler():
    global _scheduler_task

    if _scheduler_task and not _scheduler_task.done():
        return

    loop = asyncio.get_running_loop()
    _scheduler_task = loop.create_task(check_and_send_reminders())

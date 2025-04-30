import os, requests, datetime as dt
from django.core.management.base import BaseCommand
from core.models import Assignment
from decouple import config

class Command(BaseCommand):
    help = "Sync assignments from Canvas API"

    def handle(self, *args, **kwargs):
        token   = config("CANVAS_TOKEN")
        base    = "https://canvas.instructure.com/api/v1"
        headers = {"Authorization": f"Bearer {token}"}

        # Example: fetch all upcoming assignments for the logged-in user
        resp = requests.get(f"{base}/users/self/upcoming_events", headers=headers)
        resp.raise_for_status()

        for item in resp.json():
            if item["type"] != "assignment":
                continue

            Assignment.objects.update_or_create(
                canvas_id   = item["assignment"]["id"],
                defaults    = {
                    "course_name": item["context_name"],
                    "title"      : item["title"],
                    "due_at"     : item.get("due_at"),
                    "url"        : item["html_url"],
                },
            )
        self.stdout.write(self.style.SUCCESS("Canvas sync complete"))

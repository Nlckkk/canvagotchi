from django.db import models


class Assignment(models.Model):
    canvas_id   = models.BigIntegerField(unique=True)
    course_name = models.CharField(max_length=120)
    title       = models.CharField(max_length=255)
    due_at      = models.DateTimeField(null=True, blank=True)
    url         = models.URLField()
    updated_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.course_name}: {self.title}"


class UISettings(models.Model):
    assignment_text_color       = models.CharField(max_length=7, default="#92d4a7")
    assignment_border_color     = models.CharField(max_length=7, default="#92d4a7")
    assignment_background_color = models.CharField(max_length=7, default="#1a1a1a")
    progress_bar_color          = models.CharField(max_length=7, default="#6b8cff")

    def __str__(self):
        return "Global UI Settings"

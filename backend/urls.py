"""
URL configuration for backend project.
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import UISettingsViewSet          # currently implemented
# from core.views import AssignmentList, BulkUpsertAssignments   # ← add when ready
from django.views.generic import TemplateView

router = DefaultRouter()
router.register(r"ui-settings", UISettingsViewSet, basename="ui-settings")

urlpatterns = [
    path("admin/", admin.site.urls),

    # ----- assignment endpoints (enable once their views exist) -----
    # path("api/assignments/", AssignmentList.as_view()),
    # path("api/assignments/bulk_upsert/", BulkUpsertAssignments.as_view()),

    # REST-framework routes
    path("api/", include(router.urls)),

    # simple front-end page for colour pickers
    path(
        "settings/",
        TemplateView.as_view(template_name="settings.html"),
        name="settings-page",
    ),
]

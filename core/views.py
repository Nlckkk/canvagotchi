from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from .models import UISettings
from .serializers import UISettingsSerializer

class UISettingsViewSet(viewsets.ModelViewSet):
    queryset         = UISettings.objects.all()
    serializer_class = UISettingsSerializer

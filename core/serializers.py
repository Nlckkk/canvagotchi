from rest_framework import serializers
from .models import UISettings, Assignment  # keep existing import

class UISettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UISettings
        fields = "__all__"

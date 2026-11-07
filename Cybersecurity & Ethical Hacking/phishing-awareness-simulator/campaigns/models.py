"""
Database models for the campaigns app.
"""
import secrets
from django.db import models

class Campaign(models.Model):
    """
    Represents a phishing campaign.
    """
    name = models.CharField(max_length=255)
    sender_email = models.EmailField()
    sender_display_name = models.CharField(max_length=255, blank=True)
    html_content = models.TextField(
        help_text="Use {{tracking_link}} where the phishing link should go"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Recipient(models.Model):
    """
    Represents a recipient of a phishing campaign.
    """
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='recipients')
    email = models.EmailField()
    token = models.CharField(max_length=64, unique=True, editable=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    @property
    def clicked(self):
        return self.clicked_at is not None

    def __str__(self):
        return self.email

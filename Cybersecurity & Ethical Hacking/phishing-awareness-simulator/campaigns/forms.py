"""
Forms for the campaigns app.
"""
from django import forms
from .models import Campaign

class CampaignForm(forms.ModelForm):
    receiver_emails = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 6}),
        help_text="Enter one email per line."
    )

    class Meta:
        model = Campaign
        fields = ['name', 'sender_email', 'sender_display_name', 'html_content', 'receiver_emails']
        widgets = {
            'html_content': forms.Textarea(attrs={'rows': 15}),
        }
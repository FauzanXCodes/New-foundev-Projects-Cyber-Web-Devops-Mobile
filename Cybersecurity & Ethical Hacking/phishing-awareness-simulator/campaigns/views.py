from email.utils import formataddr

from django.core.mail import EmailMultiAlternatives
from django.shortcuts import get_object_or_404, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views import View
from django.views.generic import CreateView, DetailView

from .forms import CampaignForm
from .models import Campaign, Recipient


class CampaignCreateView(CreateView):
    model = Campaign
    form_class = CampaignForm
    template_name = 'campaigns/create.html'

    def form_valid(self, form):
        response = super().form_valid(form)  # saves self.object = campaign

        emails = [
            e.strip()
            for e in form.cleaned_data['receiver_emails'].splitlines()
            if e.strip()
        ]
        for email in emails:
            recipient = Recipient.objects.create(campaign=self.object, email=email)
            self.send_phishing_email(self.object, recipient)

        return response

    def send_phishing_email(self, campaign, recipient):
        tracking_url = self.request.build_absolute_uri(
            reverse('track_click', args=[recipient.token])
        )
        html_body = campaign.html_content.replace('{{tracking_link}}', tracking_url)

        msg = EmailMultiAlternatives(
            subject=campaign.name,
            body='Please view this email in an HTML-capable client.',
            from_email=formataddr((campaign.sender_display_name, campaign.sender_email)),
            to=[recipient.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()

        recipient.sent_at = timezone.now()
        recipient.save()

    def get_success_url(self):
        return reverse_lazy('campaign_results', kwargs={'pk': self.object.pk})


class CampaignResultsView(DetailView):
    model = Campaign
    template_name = 'campaigns/results.html'
    context_object_name = 'campaign'


class TrackClickView(View):
    def get(self, request, token):
        recipient = get_object_or_404(Recipient, token=token)
        if recipient.clicked_at is None:
            recipient.clicked_at = timezone.now()
            recipient.ip_address = request.META.get('REMOTE_ADDR')
            recipient.save()
        return render(request, 'campaigns/caught.html')
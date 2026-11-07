from django.urls import path
from . import views

urlpatterns = [
    path('', views.CampaignCreateView.as_view(), name='create_campaign'),
    path('results/<int:pk>/', views.CampaignResultsView.as_view(), name='campaign_results'),
    path('t/<str:token>/', views.TrackClickView.as_view(), name='track_click'),
]
from django.urls import path

from tenant.views.PublicView import PublicView
from tenant.views.CsatSurveyPublicView import CsatSurveyPublicView

urlpatterns = [
    path('validate/', PublicView.as_view({"post": "validate"}), name='load_business'),
    path('create/', PublicView.as_view({"post": "create"}), name='create_ticket'),
    path('request/new/', PublicView.as_view({"post": "new_request"}), name='new_request'),
    path('search/ticket/<str:ticket_id>', PublicView.as_view({"post": "search_ticket"}), name='search_ticket_ticket'),
    path('csat/s/<str:token>/', CsatSurveyPublicView.as_view(), name='public_csat_survey'),
    path('csat/s/<str:token>/submit/', CsatSurveyPublicView.as_view(), name='public_csat_submit'),
]

from django.urls import path, include
from .assets import urlpatterns as assets_urls

urlpatterns = [
    path('assets/', include(assets_urls)),
]

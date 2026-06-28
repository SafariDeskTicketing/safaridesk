"""
Custom Domain Routes
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from users.views.CustomDomainView import CustomDomainViewSet

router = DefaultRouter()
router.register(r'', CustomDomainViewSet, basename='custom-domain')

urlpatterns = [
    path('', include(router.urls)),
]


from rest_framework import routers
from tenant.views import RequestViewSet

router = routers.DefaultRouter()
router.register(r'', RequestViewSet, basename='requests')

urlpatterns = router.urls

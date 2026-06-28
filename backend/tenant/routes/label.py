from django.urls import path

from tenant.views.LabelView import LabelViewSet


urlpatterns = [
    path("", LabelViewSet.as_view({"get": "list", "post": "create"}), name="label_list_create"),
    path(
        "<int:pk>/",
        LabelViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="label_detail_actions",
    ),
]

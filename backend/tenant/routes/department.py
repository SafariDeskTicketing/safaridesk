from django.urls import path
from tenant.views.DepartmentViewSet import DepartmentViewSet

urlpatterns = [
    path(
        "create/",
        DepartmentViewSet.as_view({"post": "create"}),
        name="department_create",
    ),
    path(
        "update/<int:pk>/",
        DepartmentViewSet.as_view({"put": "update"}),
        name="department_update",
    ),
    path(
        "status/<int:pk>/",
        DepartmentViewSet.as_view({"put": "activate_deactivate_department"}),
        name="activate_deactivate_department",
    ),
    path(
        "delete/<int:pk>/",
        DepartmentViewSet.as_view({"delete": "destroy"}),
        name="department_delete",
    ),
    path("list/", DepartmentViewSet.as_view({"get": "list"}), name="department_list"),
    path(
        "get/<int:pk>/",
        DepartmentViewSet.as_view({"get": "retrieve"}),
        name="department_retrieve",
    ),
]

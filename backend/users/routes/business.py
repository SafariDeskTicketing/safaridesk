from django.urls import path, include

from users.views.BusinessView import BusinessRegistrationView

urlpatterns = [
    path('create/', BusinessRegistrationView.as_view({'post': 'create'}), name='property_create'),

]

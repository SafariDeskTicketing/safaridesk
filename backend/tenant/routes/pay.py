from django.urls import path

from tenant.views.SettingView import SMTPSettingsView, PaymentView

urlpatterns = [
    path('notification/', PaymentView.as_view({'post': 'mpesa_confirmation'}), name='received'),
    path('verify/', PaymentView.as_view({'post': 'mpesa_validation'}), name='verify'),

]

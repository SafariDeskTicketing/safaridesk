from django.urls import include, path
from rest_framework.routers import DefaultRouter
from tenant.views.MailIntegrationOAuthCallbackView import (
    GoogleOAuthCallbackView,
    MicrosoftOAuthCallbackView,
)
from tenant.views.MailIntegrationView import MailIntegrationViewSet
from tenant.views.SettingView import SMTPSettingsView, EmailTemplateCategoryView, EmailTemplateView, \
    EmailPlaceholdersView, TemplateTest, DepartmentEmailView, DepartmentEmailUpdateView, EmailConfigView, \
    EmailSignatureView, CsatConfigurationView
from tenant.views.EmailFilterView import EmailFilterListView, EmailFilterResetView, EmailFilterLogView

router = DefaultRouter()
router.register(r'email-template-categories', EmailTemplateCategoryView)
router.register(r'email-templates', EmailTemplateView)
router.register(r'mail/integrations', MailIntegrationViewSet, basename='mail-integration')


urlpatterns = [
    path('smtp/create/', SMTPSettingsView.as_view({'post': 'create_smtp'}), name='smtp_create'),
    path('smtp/get/', SMTPSettingsView.as_view({'get': 'retrieve'}), name='smtp_retrieve'),
    path('smtp/test/', SMTPSettingsView.as_view({'post': 'test'}), name='smtp_test'),
    path('general/update/', SMTPSettingsView.as_view({'put': 'update_general'}), name='update_general'),
    path('general/info/', SMTPSettingsView.as_view({'get': 'get_business_info'}), name='get_business_info'),
    path('email/placeholders/', EmailPlaceholdersView.as_view(), name='email_placeholders'),
    path('email/template/test', TemplateTest.as_view(), name='email_template_test'),
    path('department/emails/', DepartmentEmailView.as_view(), name='department_emails'),
    path('department/emails/<int:pk>/', DepartmentEmailUpdateView.as_view(), name='department_email_update'),
    path('email/config/', EmailConfigView.as_view(), name='email_config'),
    path('email/signature/', EmailSignatureView.as_view(), name='email_signature'),
    path('csat/config/', CsatConfigurationView.as_view(), name='csat_config'),
    path('email/filters/', EmailFilterListView.as_view(), name='email_filter_list'),
    path('email/filters/reset/', EmailFilterResetView.as_view(), name='email_filter_reset'),
    path('email/filters/log/', EmailFilterLogView.as_view(), name='email_filter_log'),
    path('mail/integrations/google/callback/', GoogleOAuthCallbackView.as_view(), name='mail_google_callback'),
    path('mail/integrations/microsoft/callback/', MicrosoftOAuthCallbackView.as_view(), name='mail_microsoft_callback'),
    path('', include(router.urls)),

]

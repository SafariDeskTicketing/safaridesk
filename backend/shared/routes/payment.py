from django.urls import path
from shared.views.PaymentView import (
    CreatePaymentIntentView,
    PaymentStatusView,
    StripeConfigView,
    PaymentReturnView,
    PaymentListView,
    PaymentDetailView,
)

urlpatterns = [
    path('create-intent/', CreatePaymentIntentView.as_view(), name='create-payment-intent'),
    path('status/', PaymentStatusView.as_view(), name='payment-status'),
    path('config/', StripeConfigView.as_view(), name='stripe-config'),
    path('return/', PaymentReturnView.as_view(), name='payment-return'),
    path('list/', PaymentListView.as_view(), name='payment-list'),
    path('<int:payment_id>/', PaymentDetailView.as_view(), name='payment-detail'),
]

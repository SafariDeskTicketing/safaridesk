import stripe
from django.conf import settings
from typing import Dict, Optional


class StripePaymentService:
    """
    Service class for handling Stripe payment operations.
    """

    def __init__(self):
        stripe.api_key = settings.STRIPE_SECRET_KEY

    def create_payment_intent(
        self,
        amount: int,
        currency: str = 'usd',
        metadata: Optional[Dict] = None,
        return_url: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict:
        """
        Create a Stripe Payment Intent.

        Args:
            amount: Amount in smallest currency unit (e.g., cents for USD)
            currency: Three-letter ISO currency code (default: 'usd')
            metadata: Optional metadata dictionary
            return_url: URL to redirect after payment completion
            description: Optional payment description

        Returns:
            Dictionary containing payment intent details including client_secret and url
        """
        try:
            payment_intent_data = {
                'amount': amount,
                'currency': currency,
                'automatic_payment_methods': {
                    'enabled': True,
                },
            }

            if metadata:
                payment_intent_data['metadata'] = metadata

            if description:
                payment_intent_data['description'] = description

            # Create the payment intent
            payment_intent = stripe.PaymentIntent.create(**payment_intent_data)

            # Prepare response with payment URL
            response_data = {
                'payment_intent_id': payment_intent.id,
                'client_secret': payment_intent.client_secret,
                'amount': payment_intent.amount,
                'currency': payment_intent.currency,
                'status': payment_intent.status,
            }

            # If return_url is provided, create a checkout session instead
            if return_url:
                checkout_session = self.create_checkout_session(
                    amount=amount,
                    currency=currency,
                    return_url=return_url,
                    metadata=metadata,
                    description=description
                )
                response_data['checkout_url'] = checkout_session['url']
                response_data['session_id'] = checkout_session['session_id']

            return response_data

        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")

    def create_checkout_session(
        self,
        amount: int,
        currency: str = 'usd',
        return_url: Optional[str] = None,
        metadata: Optional[Dict] = None,
        description: Optional[str] = None,
    ) -> Dict:
        """
        Create a Stripe Checkout Session for hosted payment page.

        Args:
            amount: Amount in smallest currency unit
            currency: Three-letter ISO currency code
            return_url: URL to redirect after payment
            metadata: Optional metadata dictionary
            description: Optional payment description

        Returns:
            Dictionary containing session_id and checkout URL
        """
        try:
            session_data = {
                'payment_method_types': ['card'],
                'line_items': [{
                    'price_data': {
                        'currency': currency,
                        'product_data': {
                            'name': description or 'Payment',
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                'mode': 'payment',
            }

            if return_url:
                session_data['success_url'] = return_url + '?session_id={CHECKOUT_SESSION_ID}&status=success'
                session_data['cancel_url'] = return_url + '?status=cancelled'

            if metadata:
                session_data['metadata'] = metadata

            session = stripe.checkout.Session.create(**session_data)

            return {
                'session_id': session.id,
                'url': session.url,
            }

        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")

    def retrieve_payment_intent(self, payment_intent_id: str) -> Dict:
        """
        Retrieve a payment intent by ID.

        Args:
            payment_intent_id: The Stripe payment intent ID

        Returns:
            Dictionary containing payment intent details
        """
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                'id': payment_intent.id,
                'amount': payment_intent.amount,
                'currency': payment_intent.currency,
                'status': payment_intent.status,
                'metadata': payment_intent.metadata,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")

    def retrieve_checkout_session(self, session_id: str) -> Dict:
        """
        Retrieve a checkout session by ID.

        Args:
            session_id: The Stripe checkout session ID

        Returns:
            Dictionary containing session details
        """
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return {
                'id': session.id,
                'payment_status': session.payment_status,
                'amount_total': session.amount_total,
                'currency': session.currency,
                'customer_email': session.customer_email,
                'metadata': session.metadata,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")

    def get_publishable_key(self) -> str:
        """
        Get the Stripe publishable key.

        Returns:
            Stripe publishable key
        """
        return settings.STRIPE_PUBLISHABLE_KEY

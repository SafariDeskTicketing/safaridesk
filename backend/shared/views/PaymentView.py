from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import render
from django.conf import settings
from shared.services.StripePaymentService import StripePaymentService
from shared.models.Payment import Payment
from shared.serializers.PaymentSerializer import PaymentSerializer, PaymentListSerializer

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.utils import timezone
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class CreatePaymentIntentView(APIView):
    """
    API endpoint to create a Stripe payment intent with return URL.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Create a payment intent and get checkout URL",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['amount'],
            properties={
                'amount': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Amount in smallest currency unit (e.g., cents for USD)'
                ),
                'currency': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Three-letter ISO currency code (e.g., usd, eur)',
                    default='usd'
                ),
                'description': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Payment description'
                ),
                'metadata': openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    description='Additional metadata for the payment'
                ),
            }
        ),
        responses={
            200: openapi.Response(
                description="Payment intent created successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'payment_intent_id': openapi.Schema(type=openapi.TYPE_STRING),
                        'client_secret': openapi.Schema(type=openapi.TYPE_STRING),
                        'checkout_url': openapi.Schema(type=openapi.TYPE_STRING),
                        'session_id': openapi.Schema(type=openapi.TYPE_STRING),
                        'amount': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'currency': openapi.Schema(type=openapi.TYPE_STRING),
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                    }
                )
            ),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """
        Create a payment intent with checkout URL.
        """
        try:
            # Extract request data
            amount = request.data.get('amount')
            currency = request.data.get('currency', 'usd')
            description = request.data.get('description')
            frontend_metadata = request.data.get('metadata', {})
            
            # Get return URL from settings (static configuration)
            return_url = getattr(settings, 'STRIPE_RETURN_URL', 'http://localhost:8100/api/v1/payment/return/')

            # Validation
            if not amount:
                return Response(
                    {'error': 'Amount is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                amount = int(amount)
                if amount <= 0:
                    raise ValueError("Amount must be positive")
            except ValueError:
                return Response(
                    {'error': 'Invalid amount. Must be a positive integer'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Build metadata from backend only (ignore frontend metadata for security)
            metadata = {
                'user_id': str(request.user.id),
                'user_email': request.user.email,
            }
            
            # Add business_id if user has a business
            if hasattr(request.user, 'business') and request.user.business:
                metadata['business_id'] = str(request.user.business.id)
                metadata['business_name'] = request.user.business.name
            
            # Optionally merge safe frontend metadata (like plan, description, etc.)
            # Only add non-sensitive fields from frontend
            safe_fields = ['plan', 'order_id', 'subscription_type', 'notes']
            for field in safe_fields:
                if field in frontend_metadata:
                    metadata[field] = frontend_metadata[field]

            # Create payment intent
            payment_service = StripePaymentService()
            result = payment_service.create_payment_intent(
                amount=amount,
                currency=currency,
                metadata=metadata,
                return_url=return_url,
                description=description
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentStatusView(APIView):
    """
    API endpoint to check payment status by session ID.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Retrieve payment status by checkout session ID",
        manual_parameters=[
            openapi.Parameter(
                'session_id',
                openapi.IN_QUERY,
                description="Stripe checkout session ID",
                type=openapi.TYPE_STRING,
                required=True
            )
        ],
        responses={
            200: openapi.Response(
                description="Payment status retrieved successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'id': openapi.Schema(type=openapi.TYPE_STRING),
                        'payment_status': openapi.Schema(type=openapi.TYPE_STRING),
                        'amount_total': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'currency': openapi.Schema(type=openapi.TYPE_STRING),
                        'customer_email': openapi.Schema(type=openapi.TYPE_STRING),
                        'metadata': openapi.Schema(type=openapi.TYPE_OBJECT),
                    }
                )
            ),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def get(self, request):
        """
        Get payment status by session ID.
        """
        try:
            session_id = request.query_params.get('session_id')

            if not session_id:
                return Response(
                    {'error': 'Session ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Retrieve session details
            payment_service = StripePaymentService()
            result = payment_service.retrieve_checkout_session(session_id)

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StripeConfigView(APIView):
    """
    API endpoint to get Stripe publishable key.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Get Stripe publishable key for client-side integration",
        responses={
            200: openapi.Response(
                description="Stripe config retrieved successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'publishable_key': openapi.Schema(type=openapi.TYPE_STRING),
                    }
                )
            )
        }
    )
    def get(self, request):
        """
        Get Stripe publishable key.
        """
        try:
            payment_service = StripePaymentService()
            publishable_key = payment_service.get_publishable_key()

            return Response(
                {'publishable_key': publishable_key},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentReturnView(APIView):
    """
    API endpoint to handle return from Stripe payment.
    This endpoint logs all query parameters received from Stripe.
    """
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_description="Handle return from Stripe payment and log response",
        manual_parameters=[
            openapi.Parameter(
                'session_id',
                openapi.IN_QUERY,
                description="Stripe checkout session ID (returned on success)",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'status',
                openapi.IN_QUERY,
                description="Payment status (success or cancelled)",
                type=openapi.TYPE_STRING,
                required=False
            )
        ],
        responses={
            200: openapi.Response(
                description="Return URL processed successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'session_id': openapi.Schema(type=openapi.TYPE_STRING),
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                        'payment_details': openapi.Schema(type=openapi.TYPE_OBJECT),
                    }
                )
            )
        }
    )
    def get(self, request):
        """
        Handle the return from Stripe payment.
        Logs all query parameters, saves payment to database, and renders HTML template.
        """
        try:
            # Get all query parameters
            session_id = request.query_params.get('session_id')
            payment_status = request.query_params.get('status')
            
            # Log all query parameters
            logger.info("=" * 80)
            logger.info("STRIPE PAYMENT RETURN URL HIT")
            logger.info("=" * 80)
            logger.info(f"Session ID: {session_id}")
            logger.info(f"Status: {payment_status}")
            logger.info(f"All Query Parameters: {dict(request.query_params)}")
            logger.info(f"Full URL: {request.build_absolute_uri()}")
            logger.info(f"Headers: {dict(request.headers)}")
            logger.info("=" * 80)

            # Prepare template context
            context = {
                'session_id': session_id,
                'status': payment_status or 'unknown',
                'status_class': payment_status if payment_status in ['success', 'cancelled', 'failed'] else 'cancelled',
                'payment_status': 'unknown',
                'amount_total': 0,
                'amount_in_dollars': '0.00',
                'currency': 'usd',
                'customer_email': None,
                'metadata': {},
                'payment_details': None,
                'transaction_date': datetime.now().strftime('%B %d, %Y at %I:%M %p'),
                'frontend_url': getattr(settings, 'FRONTEND_URL_BASE', 'http://localhost:3600'),
            }

            # If session_id is provided and status is success, fetch payment details and save
            if session_id and payment_status == 'success':
                try:
                    payment_service = StripePaymentService()
                    payment_details = payment_service.retrieve_checkout_session(session_id)
                    
                    logger.info("STRIPE PAYMENT DETAILS:")
                    logger.info(f"Payment Status: {payment_details.get('payment_status')}")
                    logger.info(f"Amount: {payment_details.get('amount_total')} {payment_details.get('currency')}")
                    logger.info(f"Customer Email: {payment_details.get('customer_email')}")
                    logger.info(f"Metadata: {payment_details.get('metadata')}")
                    logger.info("=" * 80)
                    
                    # Update context with payment details
                    amount_total = payment_details.get('amount_total', 0)
                    context.update({
                        'payment_details': payment_details,
                        'payment_status': payment_details.get('payment_status', 'paid'),
                        'amount_total': amount_total,
                        'amount_in_dollars': f"{amount_total / 100:.2f}",
                        'currency': payment_details.get('currency', 'usd'),
                        'customer_email': payment_details.get('customer_email'),
                        'metadata': payment_details.get('metadata', {}),
                    })
                    
                    # Save payment to database
                    metadata = payment_details.get('metadata', {})
                    
                    # Extract user_id and business_id from metadata
                    user_id = metadata.get('user_id')
                    business_id = metadata.get('business_id')
                    
                    # Prepare defaults for save
                    payment_defaults = {
                        'payment_status': payment_details.get('payment_status', 'paid'),
                        'amount_total': payment_details.get('amount_total', 0),
                        'currency': payment_details.get('currency', 'usd'),
                        'customer_email': payment_details.get('customer_email'),
                        'metadata': metadata,
                        'stripe_response': {
                            'session_id': session_id,
                            'status': payment_status,
                            'query_params': dict(request.query_params),
                            'payment_details': payment_details,
                        },
                        'return_url_hit_at': timezone.now(),
                    }
                    
                    # Fetch and add business if business_id exists
                    if business_id:
                        try:
                            from users.models import Business
                            business = Business.objects.get(id=business_id)
                            payment_defaults['business'] = business
                            logger.info(f"Business found: {business.name}")
                        except Business.DoesNotExist:
                            logger.warning(f"Business with ID {business_id} not found")
                        except Exception as e:
                            logger.error(f"Error fetching business: {str(e)}")
                    
                    # Fetch and add user if user_id exists
                    user_obj = None
                    if user_id:
                        try:
                            from users.models import Users
                            user_obj = Users.objects.get(id=user_id)
                            payment_defaults['created_by'] = user_obj
                            payment_defaults['updated_by'] = user_obj
                            logger.info(f"User found: {user_obj.email}")
                        except Users.DoesNotExist:
                            logger.warning(f"User with ID {user_id} not found")
                        except Exception as e:
                            logger.error(f"Error fetching user: {str(e)}")
                    
                    # Check if payment already exists
                    payment, created = Payment.objects.update_or_create(
                        session_id=session_id,
                        defaults=payment_defaults
                    )
                    
                    logger.info(f"Payment {'created' if created else 'updated'}: {payment.id}")
                    
                except Exception as e:
                    logger.error(f"Error fetching/saving payment details: {str(e)}")
                    context['error'] = str(e)
            
            elif session_id and payment_status == 'cancelled':
                # Update context for cancelled payment
                context.update({
                    'payment_status': 'cancelled',
                })
                
                # Save cancelled payment
                try:
                    payment, created = Payment.objects.update_or_create(
                        session_id=session_id,
                        defaults={
                            'payment_status': 'cancelled',
                            'stripe_response': {
                                'session_id': session_id,
                                'status': payment_status,
                                'query_params': dict(request.query_params),
                            },
                            'return_url_hit_at': timezone.now(),
                        }
                    )
                    logger.info(f"Cancelled payment {'created' if created else 'updated'}: {payment.id}")
                except Exception as e:
                    logger.error(f"Error saving cancelled payment: {str(e)}")

            # Render the template
            return render(request, 'payment-result.html', context)

        except Exception as e:
            logger.error(f"Error processing payment return: {str(e)}")
            # Render error template
            context = {
                'status': 'failed',
                'status_class': 'failed',
                'payment_status': 'error',
                'error': str(e),
                'frontend_url': getattr(settings, 'FRONTEND_URL_BASE', 'http://localhost:3600'),
                'transaction_date': datetime.now().strftime('%B %d, %Y at %I:%M %p'),
            }
            return render(request, 'payment-result.html', context)


class PaymentListView(APIView):
    """
    API endpoint to list all payments with pagination.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Get paginated list of all payments",
        manual_parameters=[
            openapi.Parameter(
                'page',
                openapi.IN_QUERY,
                description="Page number",
                type=openapi.TYPE_INTEGER,
                required=False
            ),
            openapi.Parameter(
                'page_size',
                openapi.IN_QUERY,
                description="Number of items per page (default: 10, max: 100)",
                type=openapi.TYPE_INTEGER,
                required=False
            ),
            openapi.Parameter(
                'payment_status',
                openapi.IN_QUERY,
                description="Filter by payment status (paid, unpaid, cancelled, etc.)",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'search',
                openapi.IN_QUERY,
                description="Search by session_id, customer_email, or metadata",
                type=openapi.TYPE_STRING,
                required=False
            ),
        ],
        responses={
            200: openapi.Response(
                description="Payments retrieved successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'count': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'next': openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
                        'previous': openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
                        'results': openapi.Schema(
                            type=openapi.TYPE_ARRAY,
                            items=openapi.Schema(type=openapi.TYPE_OBJECT)
                        ),
                    }
                )
            ),
            400: 'Bad Request',
            401: 'Unauthorized'
        }
    )
    def get(self, request):
        """
        Get paginated list of payments.
        """
        try:
            # Get queryset - filter by user's business if available
            queryset = Payment.objects.all()
            
            # Filter by business if user has one
            if hasattr(request.user, 'business') and request.user.business:
                queryset = queryset.filter(business=request.user.business)
            
            # Filter by payment status
            payment_status = request.query_params.get('payment_status')
            if payment_status:
                queryset = queryset.filter(payment_status=payment_status)
            
            # Search functionality
            search = request.query_params.get('search')
            if search:
                from django.db.models import Q
                queryset = queryset.filter(
                    Q(session_id__icontains=search) |
                    Q(customer_email__icontains=search) |
                    Q(metadata__icontains=search)
                )
            
            # Order by created_at descending
            queryset = queryset.order_by('-created_at')
            
            # Pagination
            paginator = PageNumberPagination()
            paginator.page_size = request.query_params.get('page_size', 10)
            paginator.max_page_size = 100
            
            paginated_queryset = paginator.paginate_queryset(queryset, request)
            serializer = PaymentListSerializer(paginated_queryset, many=True)
            
            return paginator.get_paginated_response(serializer.data)

        except Exception as e:
            logger.error(f"Error listing payments: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentDetailView(APIView):
    """
    API endpoint to get a single payment by ID.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Get payment details by ID",
        responses={
            200: openapi.Response(
                description="Payment retrieved successfully",
                schema=openapi.Schema(type=openapi.TYPE_OBJECT)
            ),
            404: 'Payment not found',
            403: 'Forbidden'
        }
    )
    def get(self, request, payment_id):
        """
        Get single payment by ID.
        """
        try:
            # Get payment
            queryset = Payment.objects.all()
            
            # Filter by business if user has one
            if hasattr(request.user, 'business') and request.user.business:
                queryset = queryset.filter(business=request.user.business)
            
            payment = queryset.filter(id=payment_id).first()
            
            if not payment:
                return Response(
                    {'error': 'Payment not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = PaymentSerializer(payment)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error retrieving payment: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

from functools import wraps
from django.contrib.auth.models import Group
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.response import Response


#
# def allowed_permissions(allowed_permissions=[]):
#     def decorator(view_func):
#         @wraps(view_func)
#         def wrapper_func(self, request, *args, **kwargs):
#             if request.user.is_anonymous:
#                 return Response({"message": "Unauthorized", "status": 403}, status=403)
#             user_category_name = request.user.user_category.name
#             try:
#                 group = Group.objects.get(name=user_category_name)
#                 user_permissions = group.permissions.values_list('codename', flat=True)
#                 for permission in allowed_permissions:
#                     if permission in user_permissions:
#                         return view_func(self, request, *args, **kwargs)
#             except Group.DoesNotExist:
#                 pass
#             return Response({"message": "Unauthorized", "status": 403}, status=403)
#         return wrapper_func
#     return decorator
#
#
# def allowed_groups(allowed_groups=[]):
#     def decorator(view_func):
#         @wraps(view_func)
#         def wrapper_func(self, request, *args, **kwargs):
#             print(request.user)
#             if request.user.is_anonymous:
#                 return Response({"message": "Not authorized to perform this action. Contact your admin", "status": 403}, status=403)
#             user_category_name = request.user.user_category.name
#             if user_category_name in allowed_groups:
#                 return view_func(self, request, *args, **kwargs)
#             return Response({"message": "Not authorized to perform this action. Contact your admin", "status": 403}, status=403)
#         return wrapper_func
#     return decorator
#
#
# def superuser_required(view_func):
#     @wraps(view_func)
#     def wrapper_func(self, request, *args, **kwargs):
#         if request.user.is_anonymous:
#             return Response({"message": "Not authorized to perform this action. Contact your admin", "status": 403},
#                             status=403)
#
#         # Check if user is in BUSINESS category
#         if request.user.category != "BUSINESS":
#             return Response({"message": "Not permitted", "status": 403}, status=403)
#
#         return view_func(self, request, *args, **kwargs)
#
#     return wrapper_func
#
# def business_required(view_func):
#     @wraps(view_func)
#     def wrapper_func(self, request, *args, **kwargs):
#         if request.user.is_anonymous:
#             return Response({"message": "Not authorized to perform this action. Contact your admin", "status": 403},
#                             status=403)
#
#         # check sub domin
#         if not request.sub_domain:
#             return Response({"message": "Business domain is missing or incorrect"}, status=400)
#
#         # print("Checking the user ====> ", request.user.business.domain)
#
#         if request.sub_domain != request.user.business.domain:
#             return Response({
#                 "message": "Access denied: You are using an incorrect subdomain. Please verify your subdomain and try again."
#             }, status=400)
#
#         # Check if user is in BUSINESS category
#         if request.user.category != "CUSTOMER":
#             return Response({"message": "Not permitted", "status": 403}, status=403)
#
#         # check subscription
#         try:
#             subscription = Subscriptions.objects.get(business=request.user.business)
#
#             if not subscription.is_subscription_active():
#                 return JsonResponse({"message": "Your subscription has expired. Please renew to continue."}, status=403)
#
#         except Subscriptions.DoesNotExist:
#             return JsonResponse({"message": "No active subscription found. Please subscribe to continue."}, status=403)
#
#         except Exception as e:
#             return JsonResponse({"message": "Internal server error."}, status=500)
#
#         return view_func(self, request, *args, **kwargs)
#
#     return wrapper_func
#
# def has_properties(view_func):
#     @wraps(view_func)
#     def wrapper_func(self, request, *args, **kwargs):
#         if request.user.is_anonymous:
#             return Response({"message": "Not authorized to perform this action. Contact your admin", "status": 403},
#                             status=403)
#
#         # Check if user is in BUSINESS category
#         subscription = Subscriptions.objects.get(business=request.user.business)
#         if not subscription.has_properties_available():
#             return JsonResponse({
#                 "message": "You have reached the limit of all your available properties, upgrade to add more properties."},
#                 status=403)
#
#         return view_func(self, request, *args, **kwargs)
#
#     return wrapper_func
#
# def has_units(view_func):
#     @wraps(view_func)
#     def wrapper_func(self, request, *args, **kwargs):
#         if request.user.is_anonymous:
#             return Response({"message": "Not authorized to perform this action. Contact your admin", "status": 403},
#                             status=403)
#
#         # Check if user is in BUSINESS category
#         subscription = Subscriptions.objects.get(business=request.user.business)
#         if not subscription.has_units_available():
#             return JsonResponse({
#                 "message": "You have reached the limit of all your available units, upgrade to add more units."},
#                 status=403)
#
#         return view_func(self, request, *args, **kwargs)
#
#     return wrapper_func
#
#
# def tenantx(view_func):
#     @wraps(view_func)
#     def _wrapped_view(self, request, *args, **kwargs):
#         tenant_id = request.parser_context["kwargs"].get("id") if hasattr(request, "parser_context") else kwargs.get(
#             "id")
#
#         if not tenant_id:
#             return JsonResponse({"message": "Tenant ID is required"}, status=400)
#
#         try:
#             # Fetch tenant
#             tenantObj = get_object_or_404(Tenant, uuid=tenant_id)
#             request.tenant = tenantObj
#             return view_func(self, request, *args, **kwargs)
#         except Tenant.DoesNotExist:
#             return JsonResponse({"message": "Tenant not found"}, status=404)
#         except Exception as e:
#             return JsonResponse({"message": f"Tenant not found"}, status=500)
#
#     return _wrapped_view
#
# def tenant(view_func):
#     @wraps(view_func)
#     def _wrapped_view(self, request, *args, **kwargs):
#         # Extract tenant UUID from Authorization header
#         auth_header = request.headers.get("Authorization")
#
#         if not auth_header:
#             return JsonResponse({"message": "Authorization token is required"}, status=401)
#
#
#
#         try:
#             # Fetch tenant using UUID
#             tenant_obj = get_object_or_404(Tenant, uuid=auth_header)
#
#             # Attach tenant to request
#             request.tenant = tenant_obj
#
#             return view_func(self, request, *args, **kwargs)
#         except Tenant.DoesNotExist:
#             return JsonResponse({"message": "Tenant not found"}, status=404)
#         except Exception as e:
#             return JsonResponse({"message": f"An error occurred: {str(e)}"}, status=500)
#
#     return _wrapped_view
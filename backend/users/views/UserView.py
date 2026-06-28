import os
import uuid

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import FileResponse, Http404

from RNSafarideskBack import settings
from RNSafarideskBack.settings import FILE_URL, AVATARS_URL
from users.models import Customer
from users.serializers.CustomerSerializer import CustomerSerializer
from users.serializers.UserDtoSerializer import UserUpdateSerializer


class UserView(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list_customers':
            return CustomerSerializer
        return UserUpdateSerializer

    def list_customers(self, request, *args, **kwargs):
        """List all ticket categories, with optional pagination"""
        queryset = Customer.objects.filter(business=request.user.business)

        # Check for optional pagination override
        pagination = request.query_params.get('pagination', 'yes').lower()

        if pagination != 'no':
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

        # Unpaginated fallback
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        f_name = data.get('first_name')
        l_name = data.get('last_name')
        email = data.get('email')
        phone_number = data.get('phone_number')

        # if not all([f_name, l_name, email, phone_number]):
        #     return Response({'message': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Update and save
        user.first_name = f_name
        user.last_name = l_name
        user.email = email
        user.phone_number = phone_number

        # Check avatar

        if request.FILES:
            print("File found in request, processing...")

            uploaded_file = request.FILES.get('avatar')  # Expecting file with key 'avatar'
            if not uploaded_file:
                return Response({
                    "message": "No file found with key 'avatar'"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                file_extension = os.path.splitext(uploaded_file.name)[1].lower()

                # Generate unique filename
                unique_filename = f"{uuid.uuid4()}{file_extension}"

                # Create directory
                avatars_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
                os.makedirs(avatars_dir, exist_ok=True)

                # Full file path
                file_path = os.path.join(avatars_dir, unique_filename)

                # Save file
                with open(file_path, 'wb+') as destination:
                    for chunk in uploaded_file.chunks():
                        destination.write(chunk)

                # Generate URL
                file_url = f"{AVATARS_URL}/{unique_filename}"

                user.avatar_url = file_url

            except Exception as file_error:
                return Response({
                    "message": "Failed to save file",
                    "details": str(file_error)
                }, status=status.HTTP_400_BAD_REQUEST)


        user.save()

        # Return updated user info
        user_data = {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'avatar_url': user.avatar_url,
            'phone_number': user.phone_number,
        }

        return Response({'message': 'User updated successfully', 'user': user_data}, status=status.HTTP_200_OK)

    def current_user(self, request):
        """Retrieve current logged-in user's profile data"""
        try:
            user = request.user
            
            user_data = {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'avatar_url': user.avatar_url,
                'phone_number': user.phone_number,
            }
            
            return Response(user_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'message': 'Failed to retrieve current user',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve_avatar(self, request, pk=None):
        """Retrieve user avatar file - authenticated endpoint"""
        try:
            user = request.user
            
            if not user.avatar_url:
                raise Http404("No avatar found for this user")
            
            # Extract filename from avatar_url
            # avatar_url format: "http://localhost:8000/uploads/avatars/filename.ext"
            filename = user.avatar_url.split('/')[-1]
            
            # Build full file path
            file_path = os.path.join(settings.MEDIA_ROOT, 'avatars', filename)
            
            # Verify file exists
            if not os.path.exists(file_path):
                raise Http404("Avatar file not found")
            
            # Return file with appropriate headers for caching
            response = FileResponse(
                open(file_path, 'rb'),
                content_type='image/jpeg',
                status=status.HTTP_200_OK
            )
            response['Cache-Control'] = 'public, max-age=86400'  # Cache for 24 hours
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            
            return response
            
        except Exception as e:
            return Response({
                'message': 'Failed to retrieve avatar',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    ALLOWED_PREF_KEYS = {'theme', 'colorTheme', 'darkVariant', 'appScale'}

    def get_preferences(self, request):
        prefs = getattr(request.user, 'ui_preferences', {}) or {}
        return Response(prefs, status=status.HTTP_200_OK)

    def update_preferences(self, request):
        incoming = {k: v for k, v in request.data.items() if k in self.ALLOWED_PREF_KEYS}
        user = request.user
        if not hasattr(user, 'ui_preferences'):
            return Response({}, status=status.HTTP_200_OK)

        current = user.ui_preferences or {}
        current.update(incoming)
        user.ui_preferences = current
        user.save(update_fields=['ui_preferences'])
        return Response(current, status=status.HTTP_200_OK)
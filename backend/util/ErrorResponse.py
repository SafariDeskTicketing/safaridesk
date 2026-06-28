from django.http import JsonResponse
from rest_framework.response import Response


def custom_404(request, exception=None):
    response_data = {
        "message": "Endpoint requested does not exist.",
        "status": 404
    }
    return Response(response_data, status=500)

def custom_500(request):
    response_data = {
        "message": "An internal server error occurred. Please try again later.",
        "status": 500
    }
    return Response(response_data, status=500)
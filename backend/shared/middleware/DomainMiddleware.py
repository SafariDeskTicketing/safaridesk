from django.http import JsonResponse


class DomainMiddleware:
    EXEMPT_PATHS = [
        "/swagger/",
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        # Skip processing if the path starts with any of the exempted paths
        if any(path.startswith(exempt_path) for exempt_path in self.EXEMPT_PATHS):
            return self.get_response(request)

        # Retrieve the custom header
        client_domain = request.META.get("HTTP_X_CLIENT_DOMAIN")

        if client_domain:
            request.sub_domain = client_domain
        else:
            return JsonResponse(
                {"message": "Business domain is missing or incorrect"}, status=400
            )

        return self.get_response(request)

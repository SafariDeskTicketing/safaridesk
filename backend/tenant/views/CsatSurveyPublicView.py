from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant.models.SettingModel import CsatConfiguration, CsatSurveyDispatch
from tenant.serializers.SettingSerializer import CsatSurveySubmissionSerializer
from tenant.services.csat import apply_csat_score


class CsatSurveyPublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def _get_dispatch(self, token: str) -> CsatSurveyDispatch | None:
        return (
            CsatSurveyDispatch.objects.select_related('ticket', 'ticket__business')
            .filter(token=token, is_active=True)
            .first()
        )

    def _get_config(self, dispatch: CsatSurveyDispatch) -> CsatConfiguration:
        config_obj, _ = CsatConfiguration.objects.get_or_create(
            business=dispatch.ticket.business,
            defaults={
                'send_on_status': ['closed'],
                'created_by': dispatch.created_by,
                'updated_by': dispatch.updated_by,
            },
        )
        return config_obj

    def _validate_dispatch(self, dispatch: CsatSurveyDispatch) -> Response | None:
        if dispatch.expires_at and dispatch.expires_at < timezone.now():
            return Response(
                {"message": "This survey link has expired."},
                status=status.HTTP_410_GONE,
            )
        return None

    def get(self, request, token: str, *args, **kwargs) -> Response:
        dispatch = self._get_dispatch(token)
        if not dispatch:
            return Response({"message": "Survey link is invalid."}, status=status.HTTP_404_NOT_FOUND)

        validation_error = self._validate_dispatch(dispatch)
        if validation_error:
            return validation_error

        config_obj = self._get_config(dispatch)
        already_submitted = dispatch.responded_at is not None

        return Response(
            {
                "token": dispatch.token,
                "ticket_id": dispatch.ticket.ticket_id,
                "business_name": dispatch.ticket.business.name if dispatch.ticket.business else "SafariDesk",
                "business_logo_url": dispatch.ticket.business.logo_url if dispatch.ticket.business else None,
                "survey_title": config_obj.survey_title,
                "intro_text": config_obj.intro_text,
                "thank_you_title": config_obj.thank_you_title,
                "thank_you_message": config_obj.thank_you_message,
                "questions": {
                    "star_label": config_obj.star_label,
                    "emotion_label": config_obj.emotion_label,
                    "comment_label": config_obj.comment_label,
                    "star_required": config_obj.star_required,
                    "emotion_required": config_obj.emotion_required,
                    "comment_required": config_obj.comment_required,
                    "comment_max_length": config_obj.comment_max_length,
                },
                "allow_multiple_submissions": config_obj.allow_multiple_submissions,
                "already_submitted": already_submitted,
                "submitted_at": dispatch.responded_at,
                "submitted_response": {
                    "star_rating": dispatch.star_rating,
                    "emotion": dispatch.emotion,
                    "comment": dispatch.comment,
                    "normalized_score": dispatch.normalized_score,
                }
                if already_submitted
                else None,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, token: str, *args, **kwargs) -> Response:
        dispatch = self._get_dispatch(token)
        if not dispatch:
            return Response({"message": "Survey link is invalid."}, status=status.HTTP_404_NOT_FOUND)

        validation_error = self._validate_dispatch(dispatch)
        if validation_error:
            return validation_error

        config_obj = self._get_config(dispatch)

        if dispatch.responded_at and not config_obj.allow_multiple_submissions:
            return Response(
                {"message": "This survey has already been submitted."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = CsatSurveySubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        errors: dict[str, str] = {}

        star_rating = payload.get('star_rating')
        emotion = payload.get('emotion')
        comment = payload.get('comment', '')

        if config_obj.star_required and star_rating is None:
            errors['star_rating'] = "Star rating is required."

        if config_obj.emotion_required and not emotion:
            errors['emotion'] = "Emotion selection is required."

        cleaned_comment = comment.strip()
        if config_obj.comment_required and not cleaned_comment:
            errors['comment'] = "Comment is required."
        if len(cleaned_comment) > config_obj.comment_max_length:
            errors['comment'] = f"Comment cannot exceed {config_obj.comment_max_length} characters."
        comment = cleaned_comment

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        normalized_score = int(star_rating) * 2 if star_rating is not None else None

        dispatch.star_rating = star_rating
        dispatch.emotion = emotion
        dispatch.comment = comment
        dispatch.normalized_score = normalized_score
        dispatch.responded_at = timezone.now()
        dispatch.raw_payload = dict(request.data) if hasattr(request.data, 'items') else {}
        dispatch.save(
            update_fields=[
                'star_rating',
                'emotion',
                'comment',
                'normalized_score',
                'responded_at',
                'raw_payload',
                'date_updated',
            ]
        )

        if normalized_score is not None:
            apply_csat_score(ticket=dispatch.ticket, normalized_score=normalized_score)

        return Response(
            {"message": "Survey submitted successfully.", "csat_score": normalized_score},
            status=status.HTTP_200_OK,
        )

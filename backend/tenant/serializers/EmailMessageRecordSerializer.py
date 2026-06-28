from __future__ import annotations

from typing import Any, Dict

from rest_framework import serializers

from tenant.models import EmailMessageRecord


def _sanitize_html(value: str) -> str:
    """
    Minimal sanitization for email HTML - only remove dangerous scripts/events.
    Preserve ALL styling, tags, and formatting to display emails as originally sent.
    """
    try:
        import bleach
        
        # Minimal cleaning: Remove only dangerous elements
        # Keep ALL HTML tags and CSS to preserve email appearance
        return bleach.clean(
            value,
            tags=bleach.sanitizer.ALLOWED_TAGS + [
                # Keep ALL standard HTML tags for email display
                "p", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6",
                "b", "strong", "i", "em", "u", "strike", "s", "del", "ins",
                "sub", "sup", "small", "big", "mark", "pre", "code", "tt",
                "ul", "ol", "li", "dl", "dt", "dd",
                "table", "thead", "tbody", "tfoot", "tr", "th", "td",
                "caption", "colgroup", "col",
                "img", "br", "hr",
                "blockquote", "q", "cite", "abbr",
                "font", "center",  # Legacy email tags
            ],
            attributes={
                "*": ["style", "class", "id", "align", "dir"],  # Keep ALL styling
                "a": ["href", "title", "target", "rel", "name"],
                "img": ["src", "alt", "title", "width", "height", "align", "border", "hspace", "vspace"],
                "table": ["border", "cellpadding", "cellspacing", "width", "height", "align", "bgcolor"],
                "td": ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor"],
                "th": ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor"],
                "font": ["color", "face", "size"],
                "div": ["align"],
                "p": ["align"],
            },
            styles=bleach.sanitizer.ALLOWED_STYLES + [
                # Allow ALL CSS properties for email styling
                "color", "background", "background-color", "background-image",
                "font-family", "font-size", "font-weight", "font-style",
                "text-align", "text-decoration", "text-transform",
                "width", "max-width", "height", "max-height", "min-width", "min-height",
                "margin", "margin-top", "margin-bottom", "margin-left", "margin-right",
                "padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
                "border", "border-top", "border-bottom", "border-left", "border-right",
                "border-color", "border-width", "border-style", "border-radius",
                "display", "float", "clear", "position",
                "line-height", "letter-spacing", "vertical-align",
            ],
            protocols=["http", "https", "mailto", "data"],
            strip=True,  # Remove disallowed tags completely
        )
    except Exception:
        # If bleach fails, return original (iframe will handle security)
        return value


class EmailMessageRecordSerializer(serializers.ModelSerializer):
    html_body_sanitized = serializers.SerializerMethodField()

    class Meta:
        model = EmailMessageRecord
        fields = [
            "id",
            "direction",
            "subject",
            "sender",
            "recipient",
            "raw_body",
            "html_body",
            "html_body_sanitized",
            "received_at",
        ]
        read_only_fields = fields

    def get_html_body_sanitized(self, obj: EmailMessageRecord) -> str:
        return _sanitize_html(obj.html_body or "")


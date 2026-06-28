import re

from django.db.models import Count, Q


LABEL_COLOR_PALETTE = [
    "#B60205",
    "#D93F0B",
    "#FBCA04",
    "#0E8A16",
    "#1D76DB",
    "#5319E7",
    "#C5DEF5",
    "#FEF2C0",
    "#BFDADC",
    "#D4C5F9",
    "#FFDCE0",
    "#F9D0C4",
]

HEX_COLOR_RE = re.compile(r"^#?[0-9a-fA-F]{6}$")


def normalize_label_color(value: str | None) -> str:
    if not value:
        return LABEL_COLOR_PALETTE[0]

    normalized = value.strip()
    if not HEX_COLOR_RE.match(normalized):
        return LABEL_COLOR_PALETTE[0]

    if not normalized.startswith("#"):
        normalized = f"#{normalized}"

    return normalized.upper()


def pick_label_color(name: str | None) -> str:
    normalized = (name or "").strip().lower()
    if not normalized:
        return LABEL_COLOR_PALETTE[0]

    seed = sum((index + 1) * ord(char) for index, char in enumerate(normalized))
    return LABEL_COLOR_PALETTE[seed % len(LABEL_COLOR_PALETTE)]


def get_label_text_color(color: str | None) -> str:
    normalized = normalize_label_color(color)
    red = int(normalized[1:3], 16)
    green = int(normalized[3:5], 16)
    blue = int(normalized[5:7], 16)
    luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
    return "#000000" if luminance >= 160 else "#FFFFFF"


def parse_label_ids(raw_value) -> list[int]:
    if raw_value in [None, "", []]:
        return []

    if isinstance(raw_value, (list, tuple)):
        raw_items = raw_value
    else:
        raw_items = str(raw_value).split(",")

    label_ids: list[int] = []
    seen: set[int] = set()

    for raw_item in raw_items:
        try:
            value = int(str(raw_item).strip())
        except (TypeError, ValueError):
            continue

        if value <= 0 or value in seen:
            continue

        seen.add(value)
        label_ids.append(value)

    return label_ids


def apply_label_filter(queryset, label_ids: list[int]):
    if not label_ids:
        return queryset

    unique_ids = list(dict.fromkeys(label_ids))
    return queryset.annotate(
        matched_label_count=Count(
            "labels",
            filter=Q(labels__id__in=unique_ids),
            distinct=True,
        )
    ).filter(matched_label_count=len(unique_ids))


def sync_legacy_tag_field(instance) -> None:
    if not hasattr(instance, "tags"):
        return

    instance.tags = ",".join(
        instance.labels.order_by("name").values_list("name", flat=True)
    )

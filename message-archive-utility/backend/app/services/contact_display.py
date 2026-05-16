import re


UNKNOWN_CONTACT_LABEL = "Unknown sender"


def format_contact_display_name(value: str | None) -> str:
    if not value:
        return UNKNOWN_CONTACT_LABEL

    name = str(value).strip()
    if not name:
        return UNKNOWN_CONTACT_LABEL
    if is_unknown_iphone_handle(name):
        return UNKNOWN_CONTACT_LABEL

    formatted_phone = format_phone_number(name)
    return formatted_phone or name


def format_phone_number(value: str | None) -> str | None:
    if not value:
        return None

    raw_value = str(value).strip()
    if "@" in raw_value:
        return None

    has_leading_plus = raw_value.startswith("+")
    digits = re.sub(r"\D", "", raw_value)
    if len(digits) == 11 and digits.startswith("1"):
        return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    if len(digits) == 10 and not has_leading_plus:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    if len(digits) == 10 and has_leading_plus:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    if has_leading_plus and len(digits) > 4:
        return f"+{digits}"
    return None


def is_unknown_iphone_handle(value: str | None) -> bool:
    if not value:
        return False
    normalized = str(value).strip().lower()
    return normalized.startswith("iphone:unknown-handle:") or normalized.startswith("iphone:handle:")


def clean_participant_names(participants: list[str]) -> list[str]:
    cleaned = []
    seen = set()
    for participant in participants:
        display_name = format_contact_display_name(participant)
        if display_name == UNKNOWN_CONTACT_LABEL and any(name != UNKNOWN_CONTACT_LABEL for name in cleaned):
            continue
        if display_name in seen:
            continue
        cleaned.append(display_name)
        seen.add(display_name)
    return cleaned


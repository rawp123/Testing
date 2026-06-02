from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedMessage:
    conversation_source_id: str
    sender_name: str
    sender_handle: str
    direction: str
    sent_at: str
    body: str
    service: str = "sample"


def normalize_body(body: str | None) -> str:
    return " ".join((body or "").split())


def normalize_direction(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"incoming", "outgoing"}:
        raise ValueError("Message direction must be incoming or outgoing.")
    return normalized

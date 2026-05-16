from app.main import build_conversation_display_title, split_participants
from app.services.contact_display import clean_participant_names, format_contact_display_name


def test_generated_chat_title_uses_participants_without_me():
    title = build_conversation_display_title(
        "chat548688234782397620",
        clean_participant_names(["+14348412583", "+14349412636", "Me"]),
    )

    assert title == "(434) 841-2583, (434) 941-2636"


def test_generated_group_title_summarizes_long_participant_list():
    title = build_conversation_display_title(
        "iPhone chat 12",
        ["Alice", "Bob", "Chris", "Dana", "Me"],
    )

    assert title == "Alice, Bob, Chris +1 more"


def test_generated_title_ignores_unknown_handle_noise():
    title = build_conversation_display_title(
        "iPhone chat 12",
        clean_participant_names(["iphone:unknown-handle:missing", "+15550001111", "Me"]),
    )

    assert title == "(555) 000-1111"


def test_generated_title_falls_back_to_unknown_sender_when_needed():
    title = build_conversation_display_title(
        "iPhone chat 12",
        clean_participant_names(["iphone:unknown-handle:missing", "Me"]),
    )

    assert title == "Unknown sender"


def test_custom_conversation_title_is_preserved():
    title = build_conversation_display_title(
        "Family",
        ["+1", "Me"],
    )

    assert title == "Family"


def test_split_participants_trims_blank_values():
    assert split_participants("Alice, Bob,, Me") == ["Alice", "Bob", "Me"]


def test_format_contact_display_name_formats_us_phone_numbers():
    assert format_contact_display_name("+15550001111") == "(555) 000-1111"
    assert format_contact_display_name("5550002222") == "(555) 000-2222"


def test_format_contact_display_name_hides_unknown_handles():
    assert format_contact_display_name("iphone:unknown-handle:7") == "Unknown sender"

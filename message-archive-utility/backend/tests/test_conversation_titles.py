from app.main import build_conversation_display_title, split_participants


def test_generated_chat_title_uses_participants_without_me():
    title = build_conversation_display_title(
        "chat548688234782397620",
        ["+14348412583", "+14349412636", "Me"],
    )

    assert title == "+14348412583, +14349412636"


def test_generated_group_title_summarizes_long_participant_list():
    title = build_conversation_display_title(
        "iPhone chat 12",
        ["+1", "+2", "+3", "+4", "Me"],
    )

    assert title == "+1, +2, +3 +1 more"


def test_custom_conversation_title_is_preserved():
    title = build_conversation_display_title(
        "Family",
        ["+1", "Me"],
    )

    assert title == "Family"


def test_split_participants_trims_blank_values():
    assert split_participants("Alice, Bob,, Me") == ["Alice", "Bob", "Me"]

# Data Schema

The SQLite schema is normalized around conversations and messages.

## Tables

- `contacts`: People or handles that appear in messages.
- `conversations`: Threads or chats.
- `conversation_participants`: Contacts attached to conversations.
- `messages`: Individual message records.
- `attachments`: Local attachment metadata. Real attachment files should stay outside Git.
- `message_attachments`: Join table between messages and attachments.
- `tags`: User-defined labels.
- `message_tags`: Join table between messages and tags.
- `saved_searches`: Named queries and filter state.

The canonical schema lives in `backend/app/db/schema.sql`.

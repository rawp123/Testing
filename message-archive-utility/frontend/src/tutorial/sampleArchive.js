export const TUTORIAL_ARCHIVE = {
  sourceName: "Sample local iPhone backup",
  importedAt: "2026-06-02T14:30:00Z",
  conversations: [
    {
      id: "tutorial-family-trip",
      title: "Family trip plans",
      participants: ["You", "Maya Patel", "Sam Patel"],
      messages: [
        {
          id: "family-001",
          sender_name: "Maya Patel",
          direction: "incoming",
          sent_at: "2025-10-02T15:12:00Z",
          body: "Can you export the hotel confirmation before dinner? I want a clean copy for the trip folder.",
          attachments: [],
        },
        {
          id: "family-002",
          sender_name: "You",
          direction: "outgoing",
          sent_at: "2025-10-02T15:18:00Z",
          body: "Yes. I found it by searching hotel, then saved the conversation as a PDF.",
          attachments: [],
        },
        {
          id: "family-003",
          sender_name: "Sam Patel",
          direction: "incoming",
          sent_at: "2025-10-03T00:45:00Z",
          body: "Adding the museum tickets here too. They have the entry time and receipt number.",
          attachments: [
            {
              id: "attachment-ticket-pdf",
              label: "PDF attachment",
              availability_status: "metadata_only",
              mime_type: "application/pdf",
            },
          ],
        },
        {
          id: "family-004",
          sender_name: "You",
          direction: "outgoing",
          sent_at: "2025-10-03T01:02:00Z",
          body: "Good. I will filter this thread and export the final version after the plan is settled.",
          attachments: [],
        },
      ],
    },
    {
      id: "tutorial-coffee-receipts",
      title: "Coffee receipts",
      participants: ["You", "Jordan Lee"],
      messages: [
        {
          id: "coffee-001",
          sender_name: "Jordan Lee",
          direction: "incoming",
          sent_at: "2025-10-04T13:05:00Z",
          body: "Coffee receipt is in this thread. We paid 18.42 and split it after the meeting.",
          attachments: [],
        },
        {
          id: "coffee-002",
          sender_name: "You",
          direction: "outgoing",
          sent_at: "2025-10-04T13:07:00Z",
          body: "Thanks. I am searching coffee so I can export the matching messages.",
          attachments: [],
        },
        {
          id: "coffee-003",
          sender_name: "Jordan Lee",
          direction: "incoming",
          sent_at: "2025-10-11T14:20:00Z",
          body: "Second coffee receipt from today was 12.10. Same project, different cafe.",
          attachments: [
            {
              id: "attachment-coffee-photo",
              label: "Photo attachment",
              availability_status: "missing",
              mime_type: "image/jpeg",
            },
          ],
        },
      ],
    },
    {
      id: "tutorial-local-privacy",
      title: "Local archive notes",
      participants: ["You", "Alex Rivera"],
      messages: [
        {
          id: "privacy-001",
          sender_name: "Alex Rivera",
          direction: "incoming",
          sent_at: "2025-10-06T16:35:00Z",
          body: "Does this tool upload messages anywhere?",
          attachments: [],
        },
        {
          id: "privacy-002",
          sender_name: "You",
          direction: "outgoing",
          sent_at: "2025-10-06T16:37:00Z",
          body: "No. The real app talks to a local API on this Mac and stores the archive in local app storage.",
          attachments: [],
        },
        {
          id: "privacy-003",
          sender_name: "You",
          direction: "outgoing",
          sent_at: "2025-10-06T16:39:00Z",
          body: "This tutorial is even lighter: the sample messages are browser state only. Reset clears them from the lesson.",
          attachments: [],
        },
      ],
    },
  ],
};


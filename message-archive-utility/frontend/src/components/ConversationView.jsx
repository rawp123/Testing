import { Download } from "lucide-react";
import React, { useEffect, useState } from "react";
import LoadingStatus from "./LoadingStatus.jsx";
import { API_BASE_URL, apiFetch } from "../utils/apiAuth.js";
import { downloadFile } from "../utils/downloadFile.js";

const CONVERSATION_FORMATS = [
  { id: "pdf", label: "PDF" },
  { id: "excel", label: "Excel" },
  { id: "csv", label: "CSV" },
];
const INITIAL_VISIBLE_MESSAGE_COUNT = 200;

export default function ConversationView({
  conversation,
  isLoading,
  apiBaseUrl = API_BASE_URL,
  loadingConversation = null,
}) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [exportState, setExportState] = useState({ status: "idle", message: "" });
  const isExporting = exportState.status === "loading";

  useEffect(() => {
    setExportState({ status: "idle", message: "" });
  }, [conversation?.id, selectedFormat]);

  if (isLoading) {
    const loadingTitle = loadingConversation?.title || "Selected conversation";
    const participantText = loadingConversation?.participants?.join(", ") || "";

    return (
      <section
        className="conversation-view conversation-loading-panel"
        aria-label="Loading conversation"
        aria-live="polite"
      >
        <div className="conversation-loading-copy">
          <p className="eyebrow">Loading messages</p>
          <h2>{loadingTitle}</h2>
          {participantText && <p>{participantText}</p>}
          <span>Opening this conversation...</span>
        </div>
        <div
          className="conversation-loading-bar"
          role="progressbar"
          aria-label="Loading messages"
          aria-valuetext="Loading"
        >
          <span />
        </div>
      </section>
    );
  }

  if (!conversation) {
    return (
      <section className="conversation-view empty-transcript">
        <div className="empty-state empty-panel">
          <strong>Select a conversation</strong>
          <span>Import messages or choose a thread from the sidebar.</span>
        </div>
      </section>
    );
  }

  const messages = conversation.messages || [];
  const dateRange = formatDateRange(messages);
  const messageCount = messages.length;
  const canExportConversation = Boolean(conversation.id && messageCount > 0);
  const exportUrl = canExportConversation
    ? buildConversationExportUrl(apiBaseUrl, conversation.id, selectedFormat)
    : "";

  async function handleExportConversation() {
    if (!canExportConversation || isExporting) return;
    setExportState({ status: "loading", message: "" });
    try {
      const filename = await downloadFile(exportUrl);
      setExportState({ status: "done", message: `Saved ${filename}.` });
    } catch {
      setExportState({ status: "error", message: "Conversation export could not be created. Try again." });
    }
  }

  return (
    <section className="conversation-view" aria-label={`${conversation.title} timeline`}>
      <header className="conversation-header">
        <div>
          <p className="eyebrow">Selected thread</p>
          <h2>{conversation.title}</h2>
          <p>{conversation.participants.join(", ")}</p>
        </div>
        <dl className="conversation-facts">
          <div>
            <dt>Messages</dt>
            <dd>{messageCount}</dd>
          </div>
          <div>
            <dt>Date range</dt>
            <dd>{dateRange}</dd>
          </div>
        </dl>
        <div className="conversation-export-control">
          <button
            className={`conversation-export-main ${canExportConversation ? "" : "is-disabled"}`}
            type="button"
            aria-disabled={!canExportConversation}
            disabled={!canExportConversation || isExporting}
            onClick={handleExportConversation}
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? "Preparing export" : "Export conversation"}
          </button>
          <label className="conversation-export-format">
            <span className="sr-only">Conversation export format</span>
            <select
              value={selectedFormat}
              onChange={(event) => setSelectedFormat(event.target.value)}
              disabled={!canExportConversation}
            >
              {CONVERSATION_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>{format.label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <p className="conversation-export-note">
        Conversation exports include message text and attachment references.
      </p>
      {isExporting && (
        <LoadingStatus
          label="Preparing conversation export"
          detail="Creating the selected conversation file."
          className="conversation-export-status"
        />
      )}
      {exportState.status === "error" && <p className="inline-error-state">{exportState.message}</p>}
      {exportState.status === "done" && <p className="inline-success-state">{exportState.message}</p>}
    </section>
  );
}

export function ConversationMessages({ conversation, isLoading, apiBaseUrl = API_BASE_URL }) {
  const [visibleMessageCount, setVisibleMessageCount] = useState(INITIAL_VISIBLE_MESSAGE_COUNT);

  useEffect(() => {
    setVisibleMessageCount(INITIAL_VISIBLE_MESSAGE_COUNT);
  }, [conversation?.id]);

  if (isLoading || !conversation) return null;

  const messages = conversation.messages || [];
  const sortedMessages = sortMessagesNewestFirst(messages);
  const displayMessages = sortedMessages.slice(0, visibleMessageCount);
  const hasHiddenOlderMessages = sortedMessages.length > displayMessages.length;

  return (
    <section className="conversation-messages-section" aria-label={`${conversation.title} messages`}>
      <header className="messages-section-header">
        <div>
          <p className="eyebrow">Messages</p>
          <h2>Conversation messages</h2>
        </div>
        {messages.length > 0 && <span>{messages.length} message{messages.length === 1 ? "" : "s"}</span>}
      </header>

      <div className="timeline">
        {messages.length === 0 ? (
          <div className="empty-state empty-panel">
            <strong>No messages found</strong>
            <span>No messages were imported for this conversation.</span>
          </div>
        ) : (
          <>
            <p className="timeline-note">
              {hasHiddenOlderMessages
                ? `Showing newest ${displayMessages.length} of ${messages.length} messages.`
                : "Latest messages are shown first."}
            </p>
            {renderMessagesWithDateDividers(displayMessages, apiBaseUrl)}
            {hasHiddenOlderMessages && (
              <button
                className="load-older-messages-button"
                type="button"
                onClick={() => setVisibleMessageCount((current) => current + INITIAL_VISIBLE_MESSAGE_COUNT)}
              >
                Show 200 older messages
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function buildConversationExportUrl(apiBaseUrl, conversationId, format) {
  const extension = format === "excel" ? "xlsx" : format;
  const params = new URLSearchParams({ conversation_id: conversationId });
  if (format === "pdf") params.set("style", "conversation");
  return `${apiBaseUrl}/export/messages.${extension}?${params.toString()}`;
}

function renderMessagesWithDateDividers(messages, apiBaseUrl) {
  let previousDateKey = "";
  let previousSender = "";
  let previousDirection = "";
  return messages.flatMap((message) => {
    const dateKey = getDateKey(message.sent_at);
    const items = [];
    if (dateKey && dateKey !== previousDateKey) {
      previousDateKey = dateKey;
      previousSender = "";
      previousDirection = "";
      items.push(
        <div className="date-divider" key={`date-${dateKey}`}>
          <span>{formatDateDivider(message.sent_at)}</span>
        </div>,
      );
    }
    const startsGroup =
      message.sender_name !== previousSender || message.direction !== previousDirection;
    previousSender = message.sender_name;
    previousDirection = message.direction;
    items.push(<MessageBubble apiBaseUrl={apiBaseUrl} message={message} startsGroup={startsGroup} key={message.id} />);
    return items;
  });
}

function sortMessagesNewestFirst(messages) {
  return [...messages].sort((left, right) => getTimestamp(right.sent_at) - getTimestamp(left.sent_at));
}

function MessageBubble({ message, startsGroup, apiBaseUrl }) {
  const displayBody = getDisplayMessageBody(message);
  const emptyBodyLabel = message.attachments?.length > 0 ? "Attachment only" : "No message text";
  const attachments = message.attachments || [];
  const attachmentSummary = summarizeAttachments(attachments);
  const imageAttachments = getRenderableImageAttachments(attachments);
  const shouldShowAttachmentSummary = attachmentSummary && imageAttachments.length !== attachments.length;

  return (
    <article className={`message ${message.direction} ${startsGroup ? "is-group-start" : ""}`}>
      <div className="message-meta">
        <strong>{message.sender_name}</strong>
        <time>{formatTime(message.sent_at)}</time>
      </div>
      {displayBody ? <p>{displayBody}</p> : <p className="empty-message-body">{emptyBodyLabel}</p>}
      {imageAttachments.length > 0 && (
        <div className="message-attachments" aria-label="Message attachments">
          {imageAttachments.map((attachment) => (
            <ImageAttachmentPreview apiBaseUrl={apiBaseUrl} attachment={attachment} key={attachment.render_url} />
          ))}
        </div>
      )}
      {shouldShowAttachmentSummary && (
        <div
          className={`attachment-indicator ${attachmentSummary.className}`}
          aria-label={attachmentSummary.accessibleLabel}
        >
          <span>{attachmentSummary.label}</span>
          <small>{attachmentSummary.detail}</small>
        </div>
      )}
    </article>
  );
}

function ImageAttachmentPreview({ attachment, apiBaseUrl }) {
  const [didFail, setDidFail] = useState(false);
  const [objectUrl, setObjectUrl] = useState("");
  const attachmentUrl = buildAttachmentRenderUrl(apiBaseUrl, attachment.render_url);

  useEffect(() => {
    let isCurrent = true;
    let nextObjectUrl = "";

    async function loadAttachmentPreview() {
      setDidFail(false);
      setObjectUrl("");
      try {
        const response = await apiFetch(attachmentUrl);
        if (!response.ok) throw new Error("Attachment preview failed");
        const blob = await response.blob();
        nextObjectUrl = URL.createObjectURL(blob);
        if (isCurrent) {
          setObjectUrl(nextObjectUrl);
        } else {
          URL.revokeObjectURL(nextObjectUrl);
        }
      } catch {
        if (isCurrent) setDidFail(true);
      }
    }

    loadAttachmentPreview();
    return () => {
      isCurrent = false;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [attachmentUrl]);

  if (didFail) {
    return (
      <div className="attachment-preview-fallback" role="status">
        Photo attachment could not be previewed.
      </div>
    );
  }

  return (
    <figure className="message-image-attachment">
      {objectUrl ? (
        <img
          alt="Photo attachment"
          decoding="async"
          loading="lazy"
          onError={() => setDidFail(true)}
          src={objectUrl}
        />
      ) : (
        <div className="attachment-preview-loading" role="status">
          Loading photo preview...
        </div>
      )}
    </figure>
  );
}

function buildAttachmentRenderUrl(apiBaseUrl, renderUrl) {
  if (renderUrl.startsWith("http://") || renderUrl.startsWith("https://")) {
    return renderUrl;
  }
  const normalizedBaseUrl = String(apiBaseUrl || "").replace(/\/$/, "");
  return `${normalizedBaseUrl}${renderUrl}`;
}

export function getDisplayMessageBody(message) {
  const body = message.body || "";
  if (looksLikeDecodedBinaryNoise(body)) {
    return "";
  }
  return body;
}

function looksLikeDecodedBinaryNoise(value) {
  const normalized = (value || "").split(/\s+/).filter(Boolean).join(" ");
  if (normalized.length < 40) return false;
  if (hasRepeatedSingleCharacterShape(normalized)) return true;
  if (hasHighSymbolDensity(normalized)) return true;
  if (hasHumanTextShape(normalized)) return false;
  if (hasCoherentNonLatinTextShape(normalized)) return false;
  if (hasMixedScriptNoiseShape(normalized)) return true;
  return false;
}

function hasRepeatedSingleCharacterShape(value) {
  return new Set([...value]).size / value.length <= 0.12;
}

function hasHighSymbolDensity(value) {
  const counts = countTextCharacterGroups(value);
  return counts.symbols / value.length >= 0.04;
}

function hasMixedScriptNoiseShape(value) {
  const counts = countTextCharacterGroups(value);
  if (counts.space || counts.commonPunctuation) return false;

  const cjkRatio = counts.cjk / value.length;
  const latinRatio = counts.latin / value.length;
  const symbolRatio = counts.symbols / value.length;
  const otherScriptRatio = (counts.hangul + counts.kana + counts.otherLetters) / value.length;

  return cjkRatio >= 0.5
    && (latinRatio >= 0.035 || symbolRatio >= 0.03 || otherScriptRatio >= 0.03);
}

function hasCoherentNonLatinTextShape(value) {
  const counts = countTextCharacterGroups(value);
  const symbolRatio = counts.symbols / value.length;
  const latinRatio = counts.latin / value.length;
  const otherScriptRatio = (counts.hangul + counts.kana + counts.otherLetters) / value.length;
  const cjkRatio = counts.cjk / value.length;
  const hangulRatio = counts.hangul / value.length;
  const kanaCjkRatio = (counts.kana + counts.cjk) / value.length;

  if (symbolRatio > 0.015 || latinRatio > 0.02) return false;
  if (cjkRatio >= 0.92 && otherScriptRatio <= 0.02) return true;
  if (hangulRatio >= 0.85 && (counts.cjk + counts.kana + counts.otherLetters) / value.length <= 0.05) return true;
  if (kanaCjkRatio >= 0.85 && counts.kana > 0 && (counts.hangul + counts.otherLetters) / value.length <= 0.03) return true;
  return false;
}

function countTextCharacterGroups(value) {
  const commonPunctuation = new Set([".", ",", "!", "?", ";", ":", "'", "\"", "(", ")", "-", "，", "。", "！", "？", "、"]);
  const counts = {
    latin: 0,
    cjk: 0,
    hangul: 0,
    kana: 0,
    digits: 0,
    space: 0,
    commonPunctuation: 0,
    symbols: 0,
    otherLetters: 0,
  };
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (/[A-Za-z]/.test(char)) counts.latin += 1;
    else if (/[0-9]/.test(char)) counts.digits += 1;
    else if (/\s/.test(char)) counts.space += 1;
    else if (commonPunctuation.has(char)) counts.commonPunctuation += 1;
    else if (
      (codePoint >= 0x3400 && codePoint <= 0x4dbf)
      || (codePoint >= 0x4e00 && codePoint <= 0x9fff)
      || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    ) counts.cjk += 1;
    else if (
      (codePoint >= 0x1100 && codePoint <= 0x11ff)
      || (codePoint >= 0x3130 && codePoint <= 0x318f)
      || (codePoint >= 0xac00 && codePoint <= 0xd7af)
    ) counts.hangul += 1;
    else if (codePoint >= 0x3040 && codePoint <= 0x30ff) counts.kana += 1;
    else if (/\p{Letter}/u.test(char)) counts.otherLetters += 1;
    else counts.symbols += 1;
  }
  return counts;
}

function hasHumanTextShape(value) {
  const hasWordSeparator = /\s/.test(value);
  const hasSentencePunctuation = /[.,!?;:，。！？、]/.test(value);
  const latinLetters = (value.match(/[A-Za-z]/g) || []).length;
  const asciiDigits = (value.match(/[0-9]/g) || []).length;

  if (latinLetters >= 3 && (hasWordSeparator || hasSentencePunctuation)) return true;
  if (asciiDigits >= 3 && (hasWordSeparator || hasSentencePunctuation)) return true;
  return false;
}

function getRenderableImageAttachments(attachments) {
  return attachments.filter((attachment) => (
    attachment.available === true
    && attachment.availability_status === "available"
    && typeof attachment.render_url === "string"
    && attachment.render_url.startsWith("/attachments/")
    && isImageMimeType(attachment.mime_type)
  ));
}

function summarizeAttachments(attachments) {
  if (!attachments.length) return null;

  const availableCount = attachments.filter((attachment) => attachment.availability_status === "available").length;
  const missingCount = attachments.filter((attachment) => attachment.availability_status === "missing").length;
  const metadataOnlyCount = attachments.filter((attachment) => attachment.availability_status === "metadata_only").length;
  const totalCount = attachments.length;
  const attachmentLabel = totalCount === 1
    ? formatAttachmentKind(attachments[0].mime_type)
    : `${totalCount} attachments`;

  if (availableCount === totalCount) {
    return {
      label: attachmentLabel,
      detail: "Saved in archive",
      accessibleLabel: `${attachmentLabel}. Saved in this archive.`,
      className: "is-available",
    };
  }

  if (missingCount === totalCount) {
    const label = totalCount === 1
      ? formatUnavailableAttachmentLabel(attachments[0].mime_type)
      : `${totalCount} attachments not in backup`;
    const detail = "The file was referenced by Messages but was not included in this backup.";
    return {
      label,
      detail,
      accessibleLabel: `${label}. ${detail}`,
      className: "is-missing",
    };
  }

  if (metadataOnlyCount === totalCount) {
    const label = totalCount === 1 ? "Attachment reference only" : `${totalCount} attachment references`;
    const detail = "The archive has the message reference, but not the file.";
    return {
      label,
      detail,
      accessibleLabel: `${label}. ${detail}`,
      className: "is-referenced",
    };
  }

  return {
    label: `${totalCount} attachments`,
    detail: buildMixedAttachmentDetail({ availableCount, missingCount, metadataOnlyCount }),
    accessibleLabel: `${totalCount} attachments. ${buildMixedAttachmentDetail({ availableCount, missingCount, metadataOnlyCount })}`,
    className: "is-mixed",
  };
}

function buildMixedAttachmentDetail({ availableCount, missingCount, metadataOnlyCount }) {
  return [
    availableCount ? `${availableCount} available` : null,
    missingCount ? `${missingCount} not in backup` : null,
    metadataOnlyCount ? `${metadataOnlyCount} reference only` : null,
  ].filter(Boolean).join(" · ");
}

function formatUnavailableAttachmentLabel(value) {
  if (!value) return "Attachment not in backup";
  if (value.startsWith("image/")) return "Photo not in backup";
  if (value === "application/pdf") return "PDF not in backup";
  if (value.startsWith("video/")) return "Video not in backup";
  if (value.startsWith("audio/")) return "Audio not in backup";
  return "Attachment not in backup";
}

function formatAttachmentKind(value) {
  if (!value) return "Attachment";
  if (isImageMimeType(value)) return "Photo attachment";
  if (value === "application/pdf") return "PDF attachment";
  if (value.startsWith("video/")) return "Video attachment";
  if (value.startsWith("audio/")) return "Audio attachment";
  return "Attachment";
}

function isImageMimeType(value) {
  return Boolean(value && value.toLowerCase().startsWith("image/"));
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getTimestamp(value) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateDivider(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateRange(messages) {
  if (!messages.length) return "No messages";
  const timestamps = messages
    .map((message) => new Date(message.sent_at).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((left, right) => left - right);
  if (!timestamps.length) return "Unknown";

  const first = formatShortDate(timestamps[0]);
  const last = formatShortDate(timestamps[timestamps.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}

function formatShortDate(timestamp) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

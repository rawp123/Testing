import React, { useEffect, useMemo, useState } from "react";
import ArchiveStatsPanel from "./components/ArchiveStatsPanel.jsx";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView from "./components/ConversationView.jsx";
import ExportPanel from "./components/ExportPanel.jsx";
import IPhoneImportPanel from "./components/IPhoneImportPanel.jsx";
import SearchBar from "./components/SearchBar.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const SHOW_SAMPLE_ARCHIVE = import.meta.env.VITE_ENABLE_SAMPLE_ARCHIVE === "true";

export default function App() {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [archiveStats, setArchiveStats] = useState(null);
  const [conversationSort, setConversationSort] = useState("lastMessageDesc");
  const [isLoading, setIsLoading] = useState(true);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadConversations({ keepSelection = true } = {}) {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request("/conversations");
      const loadedConversations = data.conversations || [];
      setConversations(loadedConversations);
      setSelectedId((currentId) => {
        if (keepSelection && loadedConversations.some((conversation) => conversation.id === currentId)) {
          return currentId;
        }
        return loadedConversations[0]?.id || null;
      });
    } catch (requestError) {
      setError(toUserFacingError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
    loadArchiveStats();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null);
      return;
    }

    let isCurrent = true;

    async function loadConversation() {
      setIsConversationLoading(true);
      setError(null);
      try {
        const data = await request(`/conversations/${selectedId}/messages`);
        if (!isCurrent) return;
        setSelectedConversation({
          ...data.conversation,
          messages: data.messages || [],
        });
      } catch (requestError) {
        if (isCurrent) setError(toUserFacingError(requestError));
      } finally {
        if (isCurrent) setIsConversationLoading(false);
      }
    }

    loadConversation();
    return () => {
      isCurrent = false;
    };
  }, [selectedId]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data = await request(
          `/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        setSearchResults(data.results || []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(toUserFacingError(requestError));
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const visibleConversations = useMemo(() => {
    const matchingIds = new Set(searchResults.map((result) => result.conversation_id));
    const filteredConversations = query.trim()
      ? conversations.filter((conversation) => matchingIds.has(conversation.id))
      : conversations;

    return sortConversations(filteredConversations, conversationSort);
  }, [conversations, conversationSort, query, searchResults]);

  const searchMatchCounts = useMemo(() => {
    return searchResults.reduce((counts, result) => {
      counts[result.conversation_id] = (counts[result.conversation_id] || 0) + 1;
      return counts;
    }, {});
  }, [searchResults]);

  const visibleConversationCount = visibleConversations.length;

  useEffect(() => {
    if (visibleConversations.length === 0) return;
    if (!visibleConversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(visibleConversations[0].id);
    }
  }, [selectedId, visibleConversations]);

  const hasArchiveData = conversations.length > 0 || (archiveStats?.messages?.total || 0) > 0;
  const isSearching = query.trim().length > 0;
  const sidebarError = getVisibleSidebarError(error, hasArchiveData);
  const searchStatus = getSearchStatus({
    hasArchiveData,
    isSearching,
    matchCount: searchResults.length,
    conversationCount: visibleConversationCount,
  });

  return (
    <main className="app-shell">
      <section className="sidebar" aria-label="Conversation browser">
        <div className="sidebar-top">
          <div className="brand-block">
            <p className="eyebrow">Local archive</p>
            <h1>Messages</h1>
            <div className="trust-row" aria-label="Privacy safeguards">
              <span>Local only</span>
              <span>Private storage</span>
              <span>No cloud sync</span>
            </div>
          </div>
          <SidebarArchiveSummary stats={archiveStats} isLoading={isStatsLoading} />
          <div className="sidebar-actions">
            <button className="secondary-button" type="button" onClick={() => loadConversations()}>
              Refresh
            </button>
            {!hasArchiveData && SHOW_SAMPLE_ARCHIVE && (
              <button className="ghost-button" type="button" onClick={loadSampleArchive}>
                Demo archive
              </button>
            )}
          </div>
          <SearchBar value={query} onChange={setQuery} disabled={!hasArchiveData} />
          <div className="list-toolbar">
            <p>
              {isSearching
                ? `${visibleConversationCount} conversation${visibleConversationCount === 1 ? "" : "s"} with matches`
                : `${visibleConversationCount} conversation${visibleConversationCount === 1 ? "" : "s"}`}
            </p>
            <label>
              <span>Sort</span>
              <select
                value={conversationSort}
                onChange={(event) => setConversationSort(event.target.value)}
                aria-label="Sort conversations"
              >
                <option value="lastMessageDesc">Newest first</option>
                <option value="lastMessageAsc">Oldest first</option>
                <option value="titleAsc">Title</option>
              </select>
            </label>
          </div>
          <SearchStatusMessage status={searchStatus} />
          {sidebarError && <SidebarErrorState error={sidebarError} />}
        </div>
        <ConversationList
          conversations={visibleConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          isLoading={isLoading}
          isSearching={isSearching}
          hasArchiveData={hasArchiveData}
          searchMatchCounts={searchMatchCounts}
        />
      </section>
      <section className="workspace" aria-label="Message archive workspace">
        <div className={`archive-management ${hasArchiveData ? "is-compact" : ""}`}>
          <IPhoneImportPanel
            request={request}
            onArchiveChanged={refreshArchive}
            hasArchiveData={hasArchiveData}
            archiveStats={archiveStats}
            isArchiveStatsLoading={isStatsLoading}
          />
          {hasArchiveData && (
            <ExportPanel
              apiBaseUrl={API_BASE_URL}
              conversation={selectedConversation}
              hasArchiveData={hasArchiveData}
            />
          )}
        </div>
        <ConversationView
          conversation={selectedConversation}
          isLoading={isConversationLoading}
        />
        {!hasArchiveData && (
          <ExportPanel
            apiBaseUrl={API_BASE_URL}
            conversation={selectedConversation}
            hasArchiveData={hasArchiveData}
          />
        )}
        <ArchiveStatsPanel stats={archiveStats} isLoading={isStatsLoading} />
      </section>
    </main>
  );

  async function loadSampleArchive() {
    setIsLoading(true);
    setError(null);
    try {
      await request("/import/dummy-csv", { method: "POST" });
      await refreshArchive();
    } catch (requestError) {
      setError(toUserFacingError(requestError));
      setIsLoading(false);
    }
  }

  async function loadArchiveStats() {
    setIsStatsLoading(true);
    try {
      const data = await request("/archive/stats");
      setArchiveStats(data);
    } catch (requestError) {
      setError(toUserFacingError(requestError));
    } finally {
      setIsStatsLoading(false);
    }
  }

  async function refreshArchive() {
    await Promise.all([
      loadConversations({ keepSelection: false }),
      loadArchiveStats(),
    ]);
  }
}

function SearchStatusMessage({ status }) {
  return (
    <div className={`search-status ${status.tone}`} role={status.tone === "empty" ? "status" : undefined}>
      <strong>{status.title}</strong>
      <span>{status.detail}</span>
    </div>
  );
}

function sortConversations(conversations, sortKey) {
  return [...conversations].sort((left, right) => {
    if (sortKey === "titleAsc") {
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    }

    const leftTime = getConversationTimestamp(left);
    const rightTime = getConversationTimestamp(right);
    const dateComparison = leftTime - rightTime;

    if (dateComparison === 0) {
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    }

    return sortKey === "lastMessageAsc" ? dateComparison : -dateComparison;
  });
}

function getSearchStatus({ hasArchiveData, isSearching, matchCount, conversationCount }) {
  if (!hasArchiveData) {
    return {
      tone: "empty",
      title: "Search your local archive",
      detail: "Import messages first, then search names, phone numbers, and message text on this device.",
    };
  }

  if (!isSearching) {
    return {
      tone: "ready",
      title: "Search stays local",
      detail: "Look across message text, names, and phone numbers without sending your archive anywhere.",
    };
  }

  if (matchCount === 0) {
    return {
      tone: "empty",
      title: "No messages matched",
      detail: "Try a different name, phone number, word, or phrase.",
    };
  }

  return {
    tone: "matches",
    title: `${formatSidebarNumber(matchCount)} message ${matchCount === 1 ? "match" : "matches"}`,
    detail: `Found in ${formatSidebarNumber(conversationCount)} conversation${conversationCount === 1 ? "" : "s"}.`,
  };
}

function getConversationTimestamp(conversation) {
  const value = conversation.last_message_at;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function SidebarArchiveSummary({ stats, isLoading }) {
  const messages = stats?.messages?.total || 0;
  const conversations = stats?.conversations?.total || 0;
  const latest = stats?.messages?.latest_sent_at;

  return (
    <section className="sidebar-summary" aria-label="Archive summary">
      <div>
        <span>Messages</span>
        <strong>{formatSidebarNumber(messages)}</strong>
      </div>
      <div>
        <span>Threads</span>
        <strong>{formatSidebarNumber(conversations)}</strong>
      </div>
      <p>{isLoading ? "Updating archive summary..." : `Latest ${formatSidebarDate(latest)}`}</p>
    </section>
  );
}

function SidebarErrorState({ error }) {
  return (
    <div className="sidebar-error-state" role="status">
      <strong>{error.title}</strong>
      <span>{error.detail}</span>
      {error.technicalDetail && (
        <details className="technical-details">
          <summary>Technical details</summary>
          <p>{error.technicalDetail}</p>
        </details>
      )}
    </div>
  );
}

function formatSidebarNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatSidebarDate(value) {
  if (!value) return "No messages yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getVisibleSidebarError(error, hasArchiveData) {
  if (!error) return null;
  if (error.kind === "service-unavailable") return error;
  if (!hasArchiveData) return null;
  return error;
}

function toUserFacingError(error) {
  const technicalDetail = sanitizeTechnicalDetail(error);
  if (error?.kind === "service-unavailable" || error?.name === "TypeError") {
    return {
      kind: "service-unavailable",
      title: "Local app service is not responding",
      detail: "Restart the app and try again.",
      technicalDetail,
    };
  }

  return {
    kind: "backend-error",
    title: "Messages could not be loaded",
    detail: "Refresh and try again.",
    technicalDetail,
  };
}

function sanitizeTechnicalDetail(error) {
  if (!error) return "";
  if (error.status) return `Local service returned HTTP ${error.status}.`;
  if (error.name === "TypeError") return "The local service request could not be completed.";
  return "";
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw requestError;
    throw createRequestError("Local service request failed.", {
      kind: "service-unavailable",
      cause: requestError,
    });
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof data === "object" && data !== null ? data.detail : data;
    if (response.status === 404 && detail === "Not Found") {
      throw createRequestError("Local service route was not found.", { status: response.status });
    }
    throw createRequestError(detail || "Local service request failed.", { status: response.status });
  }

  return data;
}

function createRequestError(message, metadata = {}) {
  const error = new Error(message);
  Object.assign(error, metadata);
  return error;
}

import React, { useEffect, useMemo, useState } from "react";
import ArchiveStatsPanel from "./components/ArchiveStatsPanel.jsx";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView from "./components/ConversationView.jsx";
import Filters from "./components/Filters.jsx";
import IPhoneImportPanel from "./components/IPhoneImportPanel.jsx";
import SearchBar from "./components/SearchBar.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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
  const [error, setError] = useState("");

  async function loadConversations({ keepSelection = true } = {}) {
    setIsLoading(true);
    setError("");
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
      setError(requestError.message);
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
      setError("");
      try {
        const data = await request(`/conversations/${selectedId}/messages`);
        if (!isCurrent) return;
        setSelectedConversation({
          ...data.conversation,
          messages: data.messages || [],
        });
      } catch (requestError) {
        if (isCurrent) setError(requestError.message);
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
        if (requestError.name !== "AbortError") setError(requestError.message);
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

  const visibleConversationCount = visibleConversations.length;

  useEffect(() => {
    if (visibleConversations.length === 0) return;
    if (!visibleConversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(visibleConversations[0].id);
    }
  }, [selectedId, visibleConversations]);

  return (
    <main className="app-shell">
      <section className="sidebar" aria-label="Conversation browser">
        <div className="brand-block">
          <p className="eyebrow">Local iPhone archive</p>
          <h1>Messages</h1>
        </div>
        <div className="sidebar-actions">
          <button className="secondary-button" type="button" onClick={() => loadConversations()}>
            Refresh
          </button>
          <button className="secondary-button" type="button" onClick={loadSampleArchive}>
            Load sample
          </button>
        </div>
        <SearchBar value={query} onChange={setQuery} />
        <Filters />
        <div className="list-toolbar">
          <p>
            {visibleConversationCount} conversation{visibleConversationCount === 1 ? "" : "s"}
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
        {query.trim() && (
          <p className="result-summary">
            {searchResults.length} message {searchResults.length === 1 ? "match" : "matches"}
          </p>
        )}
        {isLoading && <p className="empty-state">Loading archive...</p>}
        {error && <p className="error-state">{error}</p>}
        <ConversationList
          conversations={visibleConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </section>
      <section className="workspace" aria-label="Message archive workspace">
        <IPhoneImportPanel
          request={request}
          onArchiveChanged={refreshArchive}
        />
        <ArchiveStatsPanel stats={archiveStats} isLoading={isStatsLoading} />
        <ConversationView
          conversation={selectedConversation}
          isLoading={isConversationLoading}
        />
      </section>
    </main>
  );

  async function loadSampleArchive() {
    setIsLoading(true);
    setError("");
    try {
      await request("/import/dummy-csv", { method: "POST" });
      await refreshArchive();
    } catch (requestError) {
      setError(requestError.message);
      setIsLoading(false);
    }
  }

  async function loadArchiveStats() {
    setIsStatsLoading(true);
    try {
      const data = await request("/archive/stats");
      setArchiveStats(data);
    } catch (requestError) {
      setError(requestError.message);
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

function getConversationTimestamp(conversation) {
  const value = conversation.last_message_at;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof data === "object" && data !== null ? data.detail : data;
    if (response.status === 404 && detail === "Not Found") {
      throw new Error("The backend route was not found. Make sure the frontend is open on port 5173 and the API is running on port 8000.");
    }
    throw new Error(detail || `Backend request failed: ${response.status}`);
  }

  return data;
}

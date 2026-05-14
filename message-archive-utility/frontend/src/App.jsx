import { useEffect, useMemo, useState } from "react";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView from "./components/ConversationView.jsx";
import Filters from "./components/Filters.jsx";
import SearchBar from "./components/SearchBar.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialData() {
      setIsLoading(true);
      setError("");
      try {
        await request("/import/dummy-csv", { method: "POST" });
        const data = await request("/conversations");
        if (!isCurrent) return;

        const loadedConversations = data.conversations || [];
        setConversations(loadedConversations);
        setSelectedId((currentId) => currentId || loadedConversations[0]?.id || null);
      } catch (requestError) {
        if (isCurrent) setError(requestError.message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadInitialData();
    return () => {
      isCurrent = false;
    };
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
    if (!query.trim()) return conversations;
    const matchingIds = new Set(searchResults.map((result) => result.conversation_id));
    return conversations.filter((conversation) => matchingIds.has(conversation.id));
  }, [conversations, query, searchResults]);

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
          <p className="eyebrow">Local archive</p>
          <h1>Messages</h1>
        </div>
        <SearchBar value={query} onChange={setQuery} />
        <Filters />
        {query.trim() && (
          <p className="result-summary">
            {searchResults.length} message {searchResults.length === 1 ? "match" : "matches"}
          </p>
        )}
        {isLoading && <p className="empty-state">Loading fake sample archive...</p>}
        {error && <p className="error-state">{error}</p>}
        <ConversationList
          conversations={visibleConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </section>
      <ConversationView
        conversation={selectedConversation}
        isLoading={isConversationLoading}
      />
    </main>
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }
  return response.json();
}

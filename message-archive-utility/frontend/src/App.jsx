import { BarChart3, Download } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import BackupGuide from "./components/BackupGuide.jsx";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView, { ConversationMessages } from "./components/ConversationView.jsx";
import ExportPanel from "./components/ExportPanel.jsx";
import IPhoneImportPanel from "./components/IPhoneImportPanel.jsx";
import SearchBar from "./components/SearchBar.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const SHOW_SAMPLE_ARCHIVE = import.meta.env.VITE_ENABLE_SAMPLE_ARCHIVE === "true";
const APP_TABS = [
  { id: "get-started", label: "Get Started" },
  { id: "import-messages", label: "Import Messages" },
  { id: "browse-archive", label: "Browse Archive" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(null);
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotalMatches, setSearchTotalMatches] = useState(0);
  const [searchSummary, setSearchSummary] = useState(null);
  const [showSearchSummary, setShowSearchSummary] = useState(false);
  const [archiveStats, setArchiveStats] = useState(null);
  const [conversationSort, setConversationSort] = useState("lastMessageDesc");
  const [isLoading, setIsLoading] = useState(true);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isSearchSummaryLoading, setIsSearchSummaryLoading] = useState(false);
  const [error, setError] = useState(null);
  const conversationPanelRef = useRef(null);

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
      setSearchTotalMatches(0);
      setSearchSummary(null);
      setShowSearchSummary(false);
      return;
    }

    setShowSearchSummary(false);
    setSearchSummary(null);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data = await request(
          `/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        setSearchResults(data.results || []);
        setSearchTotalMatches(data.total_matching_messages || 0);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(toUserFacingError(requestError));
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!showSearchSummary || !normalizedQuery) return;

    const controller = new AbortController();
    async function loadSearchSummary() {
      setIsSearchSummaryLoading(true);
      try {
        const data = await request(
          `/search/summary?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        setSearchSummary(data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(toUserFacingError(requestError));
      } finally {
        if (!controller.signal.aborted) setIsSearchSummaryLoading(false);
      }
    }

    loadSearchSummary();
    return () => controller.abort();
  }, [query, showSearchSummary]);

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
  const resolvedActiveTab = activeTab || (hasArchiveData ? "browse-archive" : "get-started");

  useEffect(() => {
    if (resolvedActiveTab !== "browse-archive" || !selectedConversation || isConversationLoading) return;
    conversationPanelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [isConversationLoading, resolvedActiveTab, selectedConversation?.id]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-title-block">
          <p className="eyebrow">Local archive</p>
          <h1>Messages</h1>
          <p>Import, search, and export your iPhone messages on this computer.</p>
        </div>
        <nav className="app-tabs" aria-label="App sections" role="tablist">
          {APP_TABS.map((tab) => (
            <button
              aria-controls={`${tab.id}-panel`}
              aria-selected={resolvedActiveTab === tab.id}
              className={resolvedActiveTab === tab.id ? "is-active" : ""}
              id={`${tab.id}-tab`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <section
        aria-labelledby="get-started-tab"
        className="tab-panel"
        hidden={resolvedActiveTab !== "get-started"}
        id="get-started-panel"
        role="tabpanel"
      >
        <GetStartedPanel
          hasArchiveData={hasArchiveData}
          onBrowseArchive={() => setActiveTab("browse-archive")}
          onImportMessages={() => setActiveTab("import-messages")}
        />
      </section>

      <section
        aria-labelledby="import-messages-tab"
        className="tab-panel tab-panel-narrow"
        hidden={resolvedActiveTab !== "import-messages"}
        id="import-messages-panel"
        role="tabpanel"
      >
        <IPhoneImportPanel
          request={request}
          onArchiveChanged={handleArchiveChanged}
          hasArchiveData={hasArchiveData}
          archiveStats={archiveStats}
          isArchiveStatsLoading={isStatsLoading}
          onOpenArchive={() => setActiveTab("browse-archive")}
        />
      </section>

      <section
        aria-labelledby="browse-archive-tab"
        className="tab-panel browse-tab-panel"
        hidden={resolvedActiveTab !== "browse-archive"}
        id="browse-archive-panel"
        role="tabpanel"
      >
        {!hasArchiveData && !isLoading ? (
          <div className="browse-empty-state empty-panel">
            <strong>No archive loaded yet</strong>
            <span>Import messages first, then browse conversations, search your archive, and export a copy.</span>
            <button className="primary-button" type="button" onClick={() => setActiveTab("import-messages")}>
              Import Messages
            </button>
          </div>
        ) : (
          <div className="archive-browser">
            <section className="sidebar" aria-label="Conversation browser">
              <div className="sidebar-top">
                <div className="sidebar-overview-row">
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
              <ExportPanel
                apiBaseUrl={API_BASE_URL}
                hasArchiveData={hasArchiveData}
              />
            </section>
            <section className="workspace" aria-label="Message archive workspace">
              {isSearching && (
                <SearchResultsPanel
                  apiBaseUrl={API_BASE_URL}
                  query={query}
                  results={searchResults}
                  totalMatches={searchTotalMatches}
                  summary={searchSummary}
                  showSummary={showSearchSummary}
                  isSummaryLoading={isSearchSummaryLoading}
                  onShowSummary={() => setShowSearchSummary(true)}
                  onHideSummary={() => setShowSearchSummary(false)}
                  onOpenConversation={setSelectedId}
                />
              )}
              <div className="conversation-anchor" ref={conversationPanelRef}>
                <ConversationView
                  apiBaseUrl={API_BASE_URL}
                  conversation={selectedConversation}
                  isLoading={isConversationLoading}
                />
              </div>
              <ConversationMessages
                conversation={selectedConversation}
                isLoading={isConversationLoading}
              />
            </section>
          </div>
        )}
      </section>
    </main>
  );

  async function handleArchiveChanged() {
    await refreshArchive();
    setActiveTab("browse-archive");
  }

  async function loadSampleArchive() {
    setIsLoading(true);
    setError(null);
    try {
      await request("/import/dummy-csv", { method: "POST" });
      await refreshArchive();
      setActiveTab("browse-archive");
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

function SearchResultsPanel({
  apiBaseUrl,
  query,
  results,
  totalMatches,
  summary,
  showSummary,
  isSummaryLoading,
  onShowSummary,
  onHideSummary,
  onOpenConversation,
}) {
  const normalizedQuery = query.trim();
  const resolvedTotalMatches = summary?.total_matching_messages ?? totalMatches;
  const canExport = normalizedQuery.length > 0;

  return (
    <section className="search-results-panel" aria-label="Search results">
      <header className="search-results-header">
        <div>
          <p className="eyebrow">Search results</p>
          <h2>{formatSidebarNumber(resolvedTotalMatches)} matching {resolvedTotalMatches === 1 ? "message" : "messages"}</h2>
          <p>{normalizedQuery ? `Showing messages that match "${normalizedQuery}".` : "Search your archive."}</p>
        </div>
        <div className="search-result-actions">
          {showSummary ? (
            <button className="secondary-button" type="button" onClick={onHideSummary}>
              Matching messages
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={onShowSummary}>
              <BarChart3 size={16} aria-hidden="true" />
              View summary
            </button>
          )}
          <a
            className={`primary-button ${canExport ? "" : "is-disabled"}`}
            href={canExport ? buildSearchExportUrl(apiBaseUrl, normalizedQuery) : undefined}
            aria-disabled={!canExport}
            onClick={(event) => preventDisabledLink(event, canExport)}
          >
            <Download size={16} aria-hidden="true" />
            Export these results
          </a>
        </div>
      </header>

      {showSummary ? (
        <SearchSummaryStats
          apiBaseUrl={apiBaseUrl}
          query={normalizedQuery}
          summary={summary}
          isLoading={isSummaryLoading}
        />
      ) : (
        <SearchResultMessages
          results={results}
          totalMatches={resolvedTotalMatches}
          onOpenConversation={onOpenConversation}
        />
      )}
    </section>
  );
}

function SearchResultMessages({ results, totalMatches, onOpenConversation }) {
  if (results.length === 0) {
    return (
      <div className="empty-state empty-panel">
        <strong>No messages matched</strong>
        <span>Try a different name, phone number, word, or phrase.</span>
      </div>
    );
  }

  return (
    <>
      {totalMatches > results.length && (
        <p className="search-results-note">
          Showing the first {formatSidebarNumber(results.length)} matches.
        </p>
      )}
      <div className="search-message-list">
        {results.map((result) => (
          <article className="search-message-card" key={result.id}>
            <div className="search-message-card-header">
              <div>
                <strong>{result.sender_name || "Unknown sender"}</strong>
                <span>{result.conversation_title || "Untitled conversation"}</span>
              </div>
              <time>{formatResultDate(result.sent_at)}</time>
            </div>
            {result.body ? <p>{result.body}</p> : <p className="empty-message-body">No message text</p>}
            <button className="ghost-button" type="button" onClick={() => onOpenConversation(result.conversation_id)}>
              Open conversation
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function SearchSummaryStats({ apiBaseUrl, query, summary, isLoading }) {
  if (isLoading && !summary) {
    return (
      <div className="empty-state empty-panel">
        <strong>Checking results</strong>
        <span>Counting matches in your local archive.</span>
      </div>
    );
  }

  const safeSummary = summary || {
    total_matching_messages: 0,
    total_keyword_occurrences: 0,
    people: [],
    conversations: [],
    first_mention_at: null,
    most_recent_mention_at: null,
    mentions_by_month: [],
  };

  return (
    <div className="search-summary-stats">
      <div className="search-summary-actions">
        <div>
          <h3>Search summary</h3>
          <p>See where this search appears, then export the summary if you need a copy.</p>
        </div>
        <a
          className={`secondary-button ${query ? "" : "is-disabled"}`}
          href={query ? buildSearchSummaryExportUrl(apiBaseUrl, query) : undefined}
          aria-disabled={!query}
          onClick={(event) => preventDisabledLink(event, Boolean(query))}
        >
          <Download size={16} aria-hidden="true" />
          Export this summary
        </a>
      </div>
      <dl className="search-summary-topline">
        <div>
          <dt>Matching messages</dt>
          <dd>{formatSidebarNumber(safeSummary.total_matching_messages)}</dd>
        </div>
        <div>
          <dt>Times found</dt>
          <dd>{formatSidebarNumber(safeSummary.total_keyword_occurrences)}</dd>
        </div>
        <div>
          <dt>First mention</dt>
          <dd>{formatSearchSummaryDate(safeSummary.first_mention_at)}</dd>
        </div>
        <div>
          <dt>Most recent</dt>
          <dd>{formatSearchSummaryDate(safeSummary.most_recent_mention_at)}</dd>
        </div>
      </dl>

      <SearchSummarySection title="People" emptyText="No matches found.">
        {safeSummary.people.map((person) => (
          <li key={person.name}>
            <span>{person.name}</span>
            <strong>{formatMentionCount(person.mentions)}</strong>
          </li>
        ))}
      </SearchSummarySection>

      <SearchSummarySection title="Conversations" emptyText="No conversations matched.">
        {safeSummary.conversations.map((conversation) => (
          <li key={conversation.id}>
            <span>{conversation.title}</span>
            <strong>{formatMatchCount(conversation.matching_messages)}</strong>
          </li>
        ))}
      </SearchSummarySection>

      <SearchSummarySection title="Dates" emptyText="No matches found.">
        <li>
          <span>First mention</span>
          <strong>{formatSearchSummaryDate(safeSummary.first_mention_at)}</strong>
        </li>
        <li>
          <span>Most recent mention</span>
          <strong>{formatSearchSummaryDate(safeSummary.most_recent_mention_at)}</strong>
        </li>
      </SearchSummarySection>

      <SearchSummarySection title="By month" emptyText="No matches found.">
        {safeSummary.mentions_by_month.map((item) => (
          <li key={item.month}>
            <span>{formatMonthYear(item.month)}</span>
            <strong>{formatMentionCount(item.mentions)}</strong>
          </li>
        ))}
      </SearchSummarySection>
    </div>
  );
}

function SearchSummarySection({ title, emptyText, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <section className="search-summary-section">
      <h3>{title}</h3>
      {items.length > 0 ? <ul>{items}</ul> : <p>{emptyText}</p>}
    </section>
  );
}

function GetStartedPanel({ hasArchiveData, onBrowseArchive, onImportMessages }) {
  return (
    <section className="get-started-panel" aria-label="Get started">
      <div className="get-started-copy">
        <p className="eyebrow">Get Started</p>
        <h2>Save, search, and export your iPhone messages</h2>
        <p>
          The app walks you through creating a local iPhone backup, then lets you search and export your messages when needed.
        </p>
        <div className="trust-row" aria-label="Privacy safeguards">
          <span>Stays on this computer</span>
          <span>Nothing uploaded</span>
          <span>No account needed</span>
        </div>
      </div>
      <div className="get-started-layout">
        <div className="get-started-primary">
          <ol className="onboarding-steps" aria-label="Basic setup sequence">
            {[
              ["Back up your iPhone", "Plug in your iPhone and use Finder to create a local backup."],
              ["Import messages", "Let the app prepare a private message archive on this computer."],
              ["Search and export", "Browse conversations and export PDF, Excel, or CSV files."],
            ].map(([title, detail], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{detail}</p>
                  {index === 0 && <BackupGuide compact />}
                </div>
              </li>
            ))}
          </ol>
          <div className="get-started-actions">
            <button className="primary-button" type="button" onClick={onImportMessages}>
              {hasArchiveData ? "Import More Messages" : "Start Import"}
            </button>
            {hasArchiveData && (
              <button className="secondary-button" type="button" onClick={onBrowseArchive}>
                Browse Existing Archive
              </button>
            )}
          </div>
        </div>
        <aside className="after-import-panel" aria-label="After import">
          <h3>After import</h3>
          {[
            ["Search conversations", "Find names, numbers, dates, and message text."],
            ["See useful summaries", "Search a word like \"coffee\" and see who mentioned it, where it appeared, and when."],
            ["Export readable files", "Create PDF, Excel, or CSV copies."],
            ["Keep everything local", "Your archive stays on this computer."],
          ].map(([title, detail]) => (
            <div key={title}>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          ))}
        </aside>
      </div>
    </section>
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

function formatMentionCount(value) {
  return `${formatSidebarNumber(value)} mention${value === 1 ? "" : "s"}`;
}

function formatMatchCount(value) {
  return `${formatSidebarNumber(value)} matching message${value === 1 ? "" : "s"}`;
}

function formatResultDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthYear(value) {
  if (!value) return "";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

function buildSearchExportUrl(apiBaseUrl, query) {
  return `${apiBaseUrl}/export/messages.csv?q=${encodeURIComponent(query)}`;
}

function buildSearchSummaryExportUrl(apiBaseUrl, query) {
  return `${apiBaseUrl}/export/search-summary.pdf?q=${encodeURIComponent(query)}`;
}

function preventDisabledLink(event, isEnabled) {
  if (!isEnabled) event.preventDefault();
}

function formatSidebarDate(value) {
  if (!value) return "No messages yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatSearchSummaryDate(value) {
  if (!value) return "No mentions";
  return formatSidebarDate(value);
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
      title: "The app needs a restart",
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

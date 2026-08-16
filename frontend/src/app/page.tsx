'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  Database, 
  Search, 
  ExternalLink, 
  GitBranch, 
  Clock, 
  FileText, 
  ShieldAlert, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  HelpCircle,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

// Dynamically import ForceGraph2D to avoid SSR "window is not defined" error
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then((mod) => mod.default),
  { ssr: false }
);

interface ClaimVerification {
  id: string;
  claim: string;
  status: 'True' | 'False' | 'Inconclusive';
  explanation: string;
  sources: Array<{ title: string; url: string }>;
}

interface CapturedItem {
  id: string;
  rawInput: string;
  type: string;
  status: string;
  title: string | null;
  content: string | null;
  originalUrl: string | null;
  createdAt: string;
  category?: string | null;
  tags?: string[] | null;
  thumbnailUrl?: string | null;
  /** Why the item is incomplete, when it is. Null means nothing was missing. */
  issue?: string | null;
  verifications?: ClaimVerification[];
}

interface GraphNode {
  id: string;
  name: string;
  label: string;
  properties: Record<string, any>;
  x?: number;
  y?: number;
}

interface GraphLink {
  id: string;
  source: string | { id: string; name: string };
  target: string | { id: string; name: string };
  label: string;
  properties: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'items' | 'graph'>('items');
  const [items, setItems] = useState<CapturedItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  
  // Selected item detail modal/panel
  const [selectedItem, setSelectedItem] = useState<CapturedItem | null>(null);

  // Semantic question over everything ingested, as opposed to the search box
  // above, which only filters the cards already on screen.
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; sources: Array<{ title: string | null; url: string | null }> } | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // Graph state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [graphLoading, setGraphLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const fgRef = useRef<any>(null);

  // Fetch items, then keep the board live. Ingestion is asynchronous — a link
  // sent to the bot lands here a minute later — so without polling the page is
  // stale the moment it renders.
  useEffect(() => {
    let cancelled = false;

    const load = () =>
      fetch('/api/items')
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setItems(Array.isArray(data) ? data : []);
          setItemsLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Error fetching items:', err);
          setItemsLoading(false);
        });

    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const askQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo responder.');
      setAnswer(data);
    } catch (err) {
      // Shown, not swallowed: a blank panel would read as "nothing found".
      setAskError(err instanceof Error ? err.message : 'No se pudo responder.');
    } finally {
      setAsking(false);
    }
  };

  // Fetch Graph Data
  useEffect(() => {
    fetch('/api/graph')
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data || { nodes: [], links: [] });
        setGraphLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching graph:', err);
        setGraphLoading(false);
      });
  }, []);

  // Handle locating a node by search
  const handleLocateNode = (nodeName: string) => {
    const node = graphData.nodes.find((n) => n.name.toLowerCase() === nodeName.toLowerCase());
    if (node && fgRef.current) {
      // Focus camera on node coordinates
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 1000);
      setSelectedNode(node);
    }
  };

  const getStatusBadge = (status: string, issue?: string | null) => {
    // An item that failed, or that arrived with a piece of the pipeline missing,
    // must not look identical to one that came through whole.
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <ShieldAlert size={12} /> Failed
        </span>
      );
    }
    if (issue) {
      return (
        <span
          title={issue}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
        >
          <ShieldAlert size={12} /> Partial
        </span>
      );
    }
    switch (status) {
      case 'graph_extracted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.05)]">
            <ShieldCheck size={12} /> Graph Extracted
          </span>
        );
      case 'chunked_and_embedded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Layers size={12} /> Embedded
          </span>
        );
      case 'indexing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Cpu size={12} className="animate-spin" /> Indexing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Clock size={12} /> Captured
          </span>
        );
    }
  };

  // Node Color Mapper based on label
  const getNodeColor = (label: string) => {
    switch (label) {
      case 'Person': return '#ef4444'; // Red
      case 'Organization': return '#3b82f6'; // Blue
      case 'Location': return '#10b981'; // Emerald
      case 'Technology': return '#8b5cf6'; // Violet
      case 'Event': return '#f59e0b'; // Amber
      case 'Concept': return '#ec4899'; // Pink
      default: return '#9ca3af'; // Gray
    }
  };

  const filteredItems = items.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      (item.title && item.title.toLowerCase().includes(searchLower)) ||
      (item.rawInput && item.rawInput.toLowerCase().includes(searchLower)) ||
      (item.content && item.content.toLowerCase().includes(searchLower)) ||
      item.type.toLowerCase().includes(searchLower)
    );

    const matchesCategory = selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sleek Glassmorphism Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#090a0f]/80 border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <Database className="text-white" size={20} />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#090a0f]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Rumia
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                v1.3.0
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Knowledge Graph & Fact-Checking OS</p>
          </div>
        </div>

        {/* Tab Switching Controls */}
        <div className="flex p-1 bg-zinc-900/60 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'items'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText size={14} /> Captured Items
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'graph'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GitBranch size={14} /> Graph Explorer
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'items' ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Items List Side */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Ingested Content
                    <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full font-mono">
                      {filteredItems.length} items
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">All captured links, text notes, and voice transcriptions.</p>
                </div>
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search database..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-900/60 border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Ask the knowledge base. The search box above filters what is already
                  on screen; this searches meaning across everything ingested. */}
              <div className="mb-6">
                <div className="relative">
                  <Sparkles className="absolute left-3 top-3 text-indigo-400" size={16} />
                  <input
                    type="text"
                    placeholder="Pregúntale a tu base de conocimiento…"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                    className="w-full pl-10 pr-24 py-2.5 text-sm rounded-xl bg-zinc-900/60 border border-indigo-500/20 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    onClick={askQuestion}
                    disabled={asking || !question.trim()}
                    className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all"
                  >
                    {asking ? 'Buscando…' : 'Preguntar'}
                  </button>
                </div>

                {askError && (
                  <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                    <ShieldAlert size={12} /> {askError}
                  </p>
                )}

                {answer && (
                  <div className="mt-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{answer.answer}</p>
                    {answer.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                        {answer.sources.map((src) => (
                          <a
                            key={src.url ?? src.title ?? Math.random()}
                            href={src.url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] px-2 py-1 rounded-md bg-zinc-900 border border-white/5 text-indigo-400 hover:text-indigo-300 max-w-[240px] truncate"
                          >
                            {src.title || src.url}
                          </a>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { setAnswer(null); setQuestion(''); }}
                      className="mt-3 text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Category Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-6 pb-2 border-b border-white/5">
                {['All', 'News', 'Tutorial', 'Opinion', 'Entertainment', 'Documentation', 'Other', 'Unknown'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedCategoryFilter === cat
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                        : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Items Cards Grid */}
              {itemsLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                  <p className="text-xs font-medium">Loading knowledge base items...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-20 gap-3">
                  <HelpCircle size={40} className="text-zinc-600" />
                  <p className="text-xs">No items found matching your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredItems.map((item) => {
                    const verificationCount = item.verifications?.length || 0;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`glass-card glass-card-hover p-5 cursor-pointer transition-all flex flex-col justify-between min-h-[160px] ${
                          selectedItem?.id === item.id ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)] bg-indigo-500/5' : ''
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 bg-zinc-800/80 text-zinc-300 rounded border border-white/5">
                                {item.type}
                              </span>
                              {item.category && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            {getStatusBadge(item.status, item.issue)}
                          </div>

                          <h3 className="text-sm font-semibold text-white line-clamp-2 mb-2">
                            {item.title || item.rawInput || 'Captured Content'}
                          </h3>

                          <div className="flex gap-3 mb-3">
                            {item.thumbnailUrl && (
                              // The post's own image. Social content is visual first;
                              // a wall of paragraphs is not what it looked like.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.thumbnailUrl}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  // CDN links expire; hide rather than show a broken frame.
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                                className="w-20 h-20 shrink-0 rounded-lg object-cover border border-white/10 bg-zinc-900"
                              />
                            )}
                            {item.content && (
                              <p className="text-xs text-zinc-400 line-clamp-4 flex-1">
                                {item.content}
                              </p>
                            )}
                          </div>

                          {item.issue && (
                            <p className="text-[10px] text-amber-400/80 mb-3 flex items-start gap-1">
                              <ShieldAlert size={11} className="shrink-0 mt-px" />
                              <span className="line-clamp-2">{item.issue}</span>
                            </p>
                          )}

                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {item.tags.map((tag) => (
                                <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-950 text-zinc-400 rounded-md border border-white/5">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-3 border-t border-white/5">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {verificationCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded font-semibold text-[10px] uppercase">
                              <ShieldAlert size={10} /> Verified Claims ({verificationCount})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Details Viewer */}
            <div className="w-full md:w-[450px] border-t md:border-t-0 md:border-l border-white/5 bg-[#0e1017]/70 p-6 overflow-y-auto flex flex-col">
              {selectedItem ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                        {selectedItem.type}
                      </span>
                      {selectedItem.category && (
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 bg-zinc-800 text-zinc-300 border border-white/5 rounded">
                          {selectedItem.category}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white mt-2 mb-1">
                      {selectedItem.title || 'Document Details'}
                    </h2>
                    <p className="text-[10px] font-mono text-zinc-500">ID: {selectedItem.id}</p>
                  </div>

                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tags</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.tags.map((tag) => (
                          <span key={tag} className="text-[10px] font-mono px-2 py-0.5 bg-zinc-950 text-zinc-400 rounded border border-white/5">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Raw Capture</h3>
                    <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-white/5 text-xs text-zinc-300 font-mono break-all whitespace-pre-wrap">
                      {selectedItem.rawInput}
                    </div>
                  </div>

                  {selectedItem.originalUrl && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Source Link</h3>
                      <a
                        href={selectedItem.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 text-xs text-indigo-400 font-semibold transition-all group"
                      >
                        <span className="truncate mr-3">{selectedItem.originalUrl}</span>
                        <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    </div>
                  )}

                  {selectedItem.content && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Extracted Text</h3>
                      <div className="p-4 rounded-lg bg-zinc-950/40 border border-white/5 text-xs text-zinc-300 leading-relaxed max-h-96 overflow-y-auto">
                        {selectedItem.content}
                      </div>
                    </div>
                  )}

                  {/* Fact-checking Reliability Panel */}
                  {selectedItem.verifications && selectedItem.verifications.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert size={14} className="text-indigo-400" /> Reliability & Fact-Checking
                      </h3>
                      <div className="space-y-3">
                        {selectedItem.verifications.map((v) => (
                          <div key={v.id} className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-xs font-bold text-white leading-snug">
                                "{v.claim}"
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-0.5 shrink-0 ${
                                v.status === 'True'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : v.status === 'False'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {v.status === 'True' && '✓ True'}
                                {v.status === 'False' && '✗ False'}
                                {v.status === 'Inconclusive' && '? Inconcl.'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              {v.explanation}
                            </p>
                            {v.sources && v.sources.length > 0 && (
                              <div className="pt-2 flex flex-col gap-1 border-t border-white/5">
                                <span className="text-[9px] uppercase font-semibold text-zinc-500">Verified Sources:</span>
                                {v.sources.map((src, i) => (
                                  <a
                                    key={i}
                                    href={src.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                                  >
                                    • {src.title || 'Link'} <ExternalLink size={8} />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
                    <span>Captured on</span>
                    <span className="font-medium text-zinc-300">
                      {new Date(selectedItem.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-20 text-center gap-3">
                  <FileText size={40} className="text-zinc-700" />
                  <p className="text-xs">Select any item on the left to view full extraction contents, sources, and verification status.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Graph Explorer Side */
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {/* Visual Canvas Area */}
            <div className="flex-1 relative bg-[#06070a] overflow-hidden flex items-center justify-center">
              {graphLoading ? (
                <div className="flex flex-col items-center justify-center text-zinc-400 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Assembling Knowledge Graph network...</p>
                </div>
              ) : graphData.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-zinc-500 gap-3 text-center p-6">
                  <GitBranch size={48} className="text-zinc-700" />
                  <p className="text-xs font-semibold">No nodes or relations found.</p>
                  <p className="text-[11px] max-w-sm text-zinc-600">Ensure captured items have run successfully through Phase 4 (Graph Extraction).</p>
                </div>
              ) : (
                <div className="w-full h-full">
                  <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    nodeColor={(node: any) => getNodeColor(node.label)}
                    nodeLabel={(node: any) => `${node.name} (${node.label})`}
                    nodeVal={(node: any) => 6}
                    linkColor={() => '#2e303d'}
                    linkLabel={(link: any) => link.label}
                    linkWidth={1.5}
                    linkDirectionalArrowLength={4}
                    linkDirectionalArrowColor={() => '#555'}
                    linkDirectionalArrowRelPos={1}
                    onNodeClick={(node: any) => setSelectedNode(node)}
                    cooldownTicks={100}
                  />

                  {/* Graph controls overlay */}
                  <div className="absolute top-6 left-6 p-4 rounded-xl glass-card flex flex-col gap-3 pointer-events-auto max-w-xs border border-white/5">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Category Legend</h4>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor('Person') }} />
                          <span>Person</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor('Organization') }} />
                          <span>Organization</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor('Location') }} />
                          <span>Location</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor('Technology') }} />
                          <span>Technology</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor('Event') }} />
                          <span>Event</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor('Concept') }} />
                          <span>Concept</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar - Node detail & Search */}
            <div className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-white/5 bg-[#0e1017]/70 p-6 overflow-y-auto flex flex-col">
              {/* Search Node */}
              <div className="mb-6 space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Search Node</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
                  <input
                    type="text"
                    placeholder="Type node name (e.g. Google)..."
                    value={graphSearchQuery}
                    onChange={(e) => setGraphSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLocateNode(graphSearchQuery);
                    }}
                    className="w-full pl-9 pr-16 py-2 text-xs rounded-xl bg-zinc-950/60 border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleLocateNode(graphSearchQuery)}
                    className="absolute right-1.5 top-1 px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all"
                  >
                    Locate
                  </button>
                </div>
              </div>

              {/* Node Details Info */}
              {selectedNode ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span 
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-white/5 text-white"
                        style={{ backgroundColor: getNodeColor(selectedNode.label), borderColor: 'rgba(255,255,255,0.1)' }}
                      >
                        {selectedNode.label}
                      </span>
                      <h2 className="text-lg font-bold text-white mt-2 leading-tight">
                        {selectedNode.name}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Entity Properties</h3>
                    {Object.keys(selectedNode.properties || {}).length > 0 ? (
                      <div className="p-4 rounded-lg bg-zinc-950/60 border border-white/5 space-y-3 text-xs">
                        {Object.entries(selectedNode.properties).map(([k, v]) => (
                          <div key={k} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <span className="text-[10px] uppercase text-zinc-500 font-semibold">{k}</span>
                            <span className="text-zinc-300">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3.5 text-center text-xs text-zinc-500 bg-zinc-950/20 border border-dashed border-white/5 rounded-lg">
                        No properties found for this entity.
                      </div>
                    )}
                  </div>

                  {/* Connections breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Relations</h3>
                    <div className="space-y-2">
                      {graphData.links
                        .filter((link) => {
                          const srcName = typeof link.source === 'object' ? link.source.id : link.source;
                          const tgtName = typeof link.target === 'object' ? link.target.id : link.target;
                          return srcName === selectedNode.name || tgtName === selectedNode.name;
                        })
                        .map((link) => {
                          const srcName = typeof link.source === 'object' ? link.source.id : link.source;
                          const tgtName = typeof link.target === 'object' ? link.target.id : link.target;
                          const isSource = srcName === selectedNode.name;
                          return (
                            <div key={link.id} className="p-3 rounded-lg bg-zinc-900/40 border border-white/5 flex items-center justify-between text-xs">
                              <span className="text-zinc-400">
                                {isSource ? 'Outbound' : 'Inbound'}
                              </span>
                              <span className="font-mono text-zinc-300">
                                {isSource ? `--(${link.label})--> ${tgtName}` : `${srcName} --(${link.label})-->`}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-20 text-center gap-3">
                  <GitBranch size={40} className="text-zinc-700" />
                  <p className="text-xs">Click on any node in the interactive force-directed graph to inspect its parameters, properties, and relationships.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

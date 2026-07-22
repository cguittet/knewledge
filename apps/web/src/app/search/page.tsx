"use client";

import { Search as SearchIcon, Sparkles } from "lucide-react";
import { useState } from "react";
import { Shell } from "@/components/shell";

type Result = { capture_id: string; title: string; summary: string; snippet: string; score: number };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault(); if (!query.trim()) return; setLoading(true);
    const response = await fetch(`/v1/search?q=${encodeURIComponent(query)}`);
    const body = await response.json() as { results?: Result[] };
    setResults(body.results ?? []); setLoading(false);
  }

  return <Shell eyebrow="Full-text + semantic" title="Search your thinking">
    <form className="large-search" onSubmit={search}><SearchIcon size={22} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “how AI changes sales teams”" /><button>{loading ? "Searching…" : "Search"}</button></form>
    <div className="filter-row"><span>All sources</span><span>All topics</span><span>Any time</span></div>
    <div className="result-list">{results.map((result) => <a className="result-card" href={`/captures/${result.capture_id}`} key={result.capture_id}><div><span className="similarity"><Sparkles size={13} /> {Math.round(result.score * 100)}% match</span><h2>{result.title}</h2><p>{result.summary}</p><blockquote>{result.snippet}</blockquote></div><span>→</span></a>)}{!results.length && !loading && <div className="empty-state"><SearchIcon size={28} /><h3>Find the thread between ideas</h3><p>Search uses both exact language and meaning, so you can describe an idea even if the original capture used different words.</p></div>}</div>
  </Shell>;
}


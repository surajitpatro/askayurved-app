"use client";
import { useState } from "react";

interface Citation {
  verse_id: number;
  quote: string;
}
interface ApiResponse {
  answer: string;
  citations: Citation[];
  specializations: string[];
  confidence_note: string;
  disclaimer: string;
  is_emergency: boolean;
  emergency_prompt?: string;
  error?: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setResult({
        answer: "Failed to connect to the server.",
        citations: [],
        specializations: [],
        confidence_note: "",
        disclaimer: "",
        is_emergency: false,
        error: "Network error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif text-sage">AskAyurved</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
 Describe your health concern in plain English or Hindi. AskAyurved searches classical texts to provide cited, educational insights.
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex flex-col gap-4">
        <textarea
          className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sage"
          placeholder="e.g., I have chest pain and difficulty breathing. Or: What is Ayurveda?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
        />
        <button 
          type="submit" 
          className="bg-sage text-white font-bold py-3 px-6 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
          disabled={loading || !query}
        >
          {loading ? "Searching Texts..." : "Ask the Samhitas"}
        </button>
      </form>

      {result && (
        <div className="bg-white p-6 rounded-lg shadow-md space-y-6 border border-gray-100">
          
          {result.is_emergency && (
            <div className="bg-red-50 border-l-4 border-clay p-4 text-clay font-bold">
              <p>{result.emergency_prompt}</p>
            </div>
          )}

          {result.error ? (
            <div className="bg-red-50 border-l-4 border-clay p-4 text-clay font-bold">
              <p>Server Error: {result.error}. Please check API logs.</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Answer</h2>
                <div className="prose text-gray-700 whitespace-pre-wrap">{result.answer}</div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">What the Classical Texts Say</h2>
                <div className="space-y-3">
                  {result.citations && result.citations.length > 0 ? (
                    result.citations.map((cite, i) => (
                      <div key={i} className="bg-parchment p-3 border-l-2 border-sage text-sm">
                        <p className="italic text-gray-600">&quot;{cite.quote}&quot;</p>
                        <p className="text-xs text-gray-500 mt-1">Verse ID: {cite.verse_id}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No direct citations provided.</p>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p className="font-bold">Relevant Specializations:</p>
                <p>{result.specializations.join(", ")}</p>
              </div>

              <div className="text-sm text-gray-500 italic">
                <p className="font-bold">Confidence Note:</p>
                <p>{result.confidence_note}</p>
              </div>

              <div className="text-xs text-gray-400 border-t pt-4 mt-4">
                {result.disclaimer}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './utils/supabase';

// --- Helper Functions ---
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

const readTextFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

const stripJsonFences = (str) => {
  let s = str.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
};

const getEmojiForTitle = (title) => {
  const t = title.toLowerCase();
  if (t.includes('audience')) return '🎯';
  if (t.includes('revenue')) return '💰';
  if (t.includes('platform') || t.includes('channel')) return '📡';
  if (t.includes('market')) return '📊';
  if (t.includes('usp') || t.includes('unique')) return '⚡';
  if (t.includes('partner')) return '🤝';
  if (t.includes('geograph') || t.includes('location')) return '🌍';
  if (t.includes('growth') || t.includes('stage')) return '🚀';
  if (t.includes('content') || t.includes('product')) return '🎬';
  if (t.includes('model')) return '🏗️';
  return '📌';
};

const loadingMessages = [
  "Reading the deck...",
  "Extracting key insights...",
  "Extracting requirements...",
  "Comparing with your requirements...",
  "Calculating compatibility..."
];

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function DeckMatch() {
  const [deckFile, setDeckFile] = useState(null);
  const [reqMode, setReqMode] = useState('type'); // 'type' | 'upload'
  const [reqText, setReqText] = useState(`1. Core Value Proposition & Mission: The document must articulate a crystal-clear business focus, detailing exactly what problem the organization solves, its overarching mission, and a defined core target milestone (e.g., scale metrics, population reach, or volume of impact).

2. Defined Target Audience & Market Demand: The deck must explicitly outline its target demographic, consumer segments, or corporate end-users. It must provide measurable data indicating strong engagement or high activity levels across its primary audience segments to justify product-market fit.

3. Industry Viability & Market Size: The business must operate within a clearly quantified market space. The document must explicitly state the current total addressable market (TAM) or market size valuation, alongside reliable growth indicators such as a Compounding Annual Growth Rate (CAGR) and long-term future market projections.

4. Clear Delivery Formats & Channels: The business model must show established distribution pipelines, product deliverables, or media/service formats. It must define how it creates and deploys its core offerings—whether through digital platforms, multi-channel ecosystems, or physical distributions.

5. Strategic Partnerships & Integration Network: The organization must show a solid operational infrastructure by highlighting key knowledge partners, brand collaborations, corporate alliances, or government/institutional outreach pipelines that help validate or accelerate its execution.

6. Clear Monetization & Commercialization Strategy: The business must showcase a realistic, structured revenue architecture. It must list distinct commercial real estate or monetization streams—such as programmatic advertising assets, sponsored integrations, long-term commercial contract parameters, product placement properties, or subscription tiers.`);
  const [reqFile, setReqFile] = useState(null);
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'analyzing' | 'results' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  
  const [deckData, setDeckData] = useState(null);
  const [compatData, setCompatData] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  
  const resultsRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('deck_analysis_results')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching history:", error);
      } else {
        setHistory(data || []);
      }
    } catch (err) {
      console.error("Exception fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const loadHistoryItem = (item) => {
    // Mock the deck file name so UI displays active state
    setDeckFile({ name: item.deck_name });
    
    // Map feature_cards back to pointers format
    const pointers = item.feature_cards?.map((fc) => ({
      title: fc.title,
      description: fc.body
    })) || [];

    setDeckData({
      summary: item.business_summary,
      pointers: pointers
    });

    if (item.positive_points && item.positive_points.length > 0) {
      setCompatData({
        score: item.compatibility_percentage,
        matches: item.positive_points,
        mismatches: item.negative_points
      });
    } else {
      setCompatData(null);
    }

    setStatus('results');
  };

  // Cycle loading messages
  useEffect(() => {
    let interval;
    if (status === 'analyzing') {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Animate score counter
  useEffect(() => {
    if (status === 'results' && compatData) {
      let start = 0;
      const target = compatData.score || 0;
      const duration = 1500;
      const incrementTime = 30;
      const steps = duration / incrementTime;
      const increment = target / steps;

      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          setAnimatedScore(target);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.floor(start));
        }
      }, incrementTime);
      return () => clearInterval(timer);
    }
  }, [status, compatData]);

  // Scroll to results
  useEffect(() => {
    if (status === 'results' && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status]);

  const handleDeckDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setDeckFile(e.dataTransfer.files[0]);
    }
  };

  const handleReqDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setReqFile(e.dataTransfer.files[0]);
    }
  };

  const runAnalysis = async () => {
    if (!API_KEY) return showError("API Key is missing in project configuration.");
    if (!deckFile) return showError("Please upload a business deck.");
    
    let requirementsText = reqText;
    let hasRequirements = false;
    
    if (reqMode === 'upload' && reqFile) {
      hasRequirements = true;
    } else if (reqMode === 'type' && requirementsText.trim()) {
      hasRequirements = true;
    }

    setStatus('analyzing');
    setErrorMsg('');
    let localCompatData = null;

    try {
      // --- Call 1: Deck Analysis ---
      const mimeType = deckFile.type || 'application/octet-stream';
      const base64Data = await toBase64(deckFile);

      const payload1 = {
        contents: [{
          parts: [
            { text: "You are a business analyst performing an EXHAUSTIVE, DEEP-DIVE analysis of a business deck. It is CRITICAL that you extract the exact data, metrics, claims, and insights from EACH AND EVERY SINGLE SLIDE and EVERY SINGLE IMAGE without missing anything. Do NOT summarize away the details. Do NOT be concise. The later slides are just as important as the early slides. You must pack your thematic pointers with dense, highly-detailed paragraphs (at least 5-8 sentences per pointer) that explicitly mention the exact data points, names, and metrics from the slides. Pay extremely close attention to all visual elements. Carefully identify all logos (e.g., government collaborators, partners, clients) and visual diagrams. Return ONLY a raw JSON object with exactly two keys: 'summary' (string, 1-2 extensive paragraphs detailing everything this business does, its model, and its goals) and 'pointers' (array of objects, each with 'title' and 'description'). Extract minimum 15 highly-detailed, exhaustive pointers covering every facet of the deck (Business Model, Target Audience, USP, Platforms, Market Size, Revenue, Content, Partnerships, Geography, Growth Stage, Financials, Team, etc.). Ensure all partners and collaborators identified from logos are explicitly mentioned. Let all the specific slide data show in breadth and depth. Return raw JSON only. No markdown. No explanation." },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
      };

      const res1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1)
      });
      
      const data1 = await res1.json();
      if (data1.error) throw new Error(data1.error.message || "API Error during analysis.");
      
      const rawText1 = data1.candidates[0].content.parts[0].text;
      const parsedDeckData = JSON.parse(stripJsonFences(rawText1));
      setDeckData(parsedDeckData);

      // --- Call 1.5 & Call 2: Compatibility Check (Only if requirements exist) ---
      if (hasRequirements) {
        if (reqMode === 'upload' && reqFile) {
          const reqMimeType = reqFile.type || 'application/octet-stream';
          const reqBase64 = await toBase64(reqFile);
          
          const payload1_5 = {
            contents: [{
              parts: [
                { text: "You are an analyst. Extract the minimum requirements and criteria from this document. Carefully examine all text, images, and slides. Return ONLY a raw JSON object with exactly one key: 'requirements' (array of strings, each being a clear requirement criteria). Return raw JSON only. No markdown. No explanation." },
                { inline_data: { mime_type: reqMimeType, data: reqBase64 } }
              ]
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
          };

          const res1_5 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload1_5)
          });
          
          const data1_5 = await res1_5.json();
          if (data1_5.error) throw new Error(data1_5.error.message || "API Error during requirements extraction.");
          
          const rawText1_5 = data1_5.candidates[0].content.parts[0].text;
          const parsedReqData = JSON.parse(stripJsonFences(rawText1_5));
          requirementsText = JSON.stringify(parsedReqData.requirements);
        }

        const payload2 = {
          contents: [{
            parts: [{ 
              text: `You are a business compatibility evaluator. Here is a business summary and key pointers: ${JSON.stringify(parsedDeckData)}. Here are the evaluator's requirements: ${requirementsText}. Compare them carefully. Return ONLY a raw JSON object with: 'score' (integer 0-100 representing compatibility), 'matches' (array of strings, each describing something that aligned), 'mismatches' (array of strings, each describing something that didn't align). Minimum 3 items in each array. Return raw JSON only. No markdown. No explanation.`
            }]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
        };

        const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload2)
        });

        const data2 = await res2.json();
        if (data2.error) throw new Error(data2.error.message || "API Error during comparison.");

        const rawText2 = data2.candidates[0].content.parts[0].text;
        const parsedCompatData = JSON.parse(stripJsonFences(rawText2));
        setCompatData(parsedCompatData);
        localCompatData = parsedCompatData;
      } else {
        setCompatData(null); // Clear previous comparison if running deck only
      }

      // --- Save to Supabase DB ---
      try {
        const featureCards = parsedDeckData.pointers?.map((pt) => ({
          title: pt.title,
          icon: getEmojiForTitle(pt.title),
          body: pt.description
        })) || [];

        const insertPayload = {
          deck_name: deckFile.name,
          compatibility_percentage: localCompatData ? (localCompatData.score || 0) : 100,
          business_summary: parsedDeckData.summary || '',
          positive_points: localCompatData ? (localCompatData.matches || []) : [],
          negative_points: localCompatData ? (localCompatData.mismatches || []) : [],
          feature_cards: featureCards
        };

        const { error: dbError } = await supabase
          .from('deck_analysis_results')
          .insert([insertPayload]);

        if (dbError) {
          console.error("Supabase insert error:", dbError);
        } else {
          console.log("Analysis successfully saved to Supabase!");
          fetchHistory(); // Dynamically reload history listing
        }
      } catch (dbErr) {
        console.error("Database save exception:", dbErr);
      }

      setStatus('results');

    } catch (error) {
      console.error(error);
      showError(error.message || "Something went wrong. Check your API key or try a PDF instead.");
      setStatus('idle');
    }
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#22c55e'; // green
    if (score >= 40) return '#f5c518'; // yellow
    return '#ef4444'; // red
  };

  const isReady = API_KEY && deckFile;

  return (
    <div className="min-h-screen bg-[#0f0f13] text-[#e8e8f0] font-sans relative overflow-x-hidden selection:bg-[#f5c518] selection:text-black pb-24">
      
      {/* Error Toast */}
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-[slideDown_0.3s_ease-out]">
          {errorMsg}
        </div>
      )}

      {/* Header */}
      <header className="pt-16 pb-12 px-6 max-w-5xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
          Deck<span className="text-[#f5c518]">Match</span>
        </h1>
        <p className="text-[#8888aa] text-lg md:text-xl font-medium tracking-wide mb-10">
          Upload. Analyze. Compare.
        </p>
      </header>

      {/* Main Upload Area */}
      <main className="max-w-6xl mx-auto px-6 mb-16">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* Left Column: Deck */}
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-[#e8e8f0]">The Business Deck</h2>
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDeckDrop}
              className="flex-1 bg-[#1a1a24] border-2 border-dashed border-[#2a2a3a] hover:border-[#f5c518] transition-colors rounded-xl flex flex-col items-center justify-center p-8 text-center cursor-pointer min-h-[250px] relative group"
            >
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                accept=".pdf,.pptx,.xlsx,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setDeckFile(e.target.files[0])}
              />
              {deckFile ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-medium text-[#f5c518]">{deckFile.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-[#8888aa] group-hover:text-[#f5c518] transition-colors">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="font-medium">Drop the Business Deck Here</p>
                  <p className="text-xs opacity-70">PDF, PPTX, XLSX, DOCX, PNG, JPG</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Requirements */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#e8e8f0]">Your Requirements</h2>
              <div className="flex bg-[#1a1a24] rounded-full p-1 border border-[#2a2a3a]">
                <button 
                  onClick={() => setReqMode('type')}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-all ${reqMode === 'type' ? 'bg-[#f5c518] text-black' : 'text-[#8888aa] hover:text-white'}`}
                >
                  Type
                </button>
                <button 
                  onClick={() => setReqMode('upload')}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-all ${reqMode === 'upload' ? 'bg-[#f5c518] text-black' : 'text-[#8888aa] hover:text-white'}`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {reqMode === 'type' ? (
              <textarea 
                className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] focus:border-[#f5c518] transition-colors rounded-xl p-5 text-[#e8e8f0] placeholder:text-[#8888aa] resize-none min-h-[250px] outline-none"
                placeholder="e.g. Must be B2B, must operate in India, must have clear revenue model..."
                value={reqText}
                onChange={(e) => setReqText(e.target.value)}
              />
            ) : (
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleReqDrop}
                className="flex-1 bg-[#1a1a24] border-2 border-dashed border-[#2a2a3a] hover:border-[#f5c518] transition-colors rounded-xl flex flex-col items-center justify-center p-8 text-center cursor-pointer min-h-[250px] relative group"
              >
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept=".pdf,.pptx,.xlsx,.docx,.png,.jpg,.jpeg,.txt,.md,.csv"
                  onChange={(e) => setReqFile(e.target.files[0])}
                />
                {reqFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-medium text-[#f5c518]">{reqFile.name}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-[#8888aa] group-hover:text-[#f5c518] transition-colors">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="font-medium">Drop Requirements File</p>
                    <p className="text-xs opacity-70">PDF, PPTX, XLSX, DOCX, PNG, JPG, TXT</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={runAnalysis}
          disabled={!isReady || status === 'analyzing'}
          className={`w-full py-4 rounded-xl text-lg font-bold transition-all duration-300 ${
            isReady && status !== 'analyzing'
              ? 'bg-[#f5c518] text-black hover:shadow-[0_0_20px_rgba(245,197,24,0.3)] hover:-translate-y-1 cursor-pointer'
              : 'bg-[#1a1a24] text-[#8888aa] border border-[#2a2a3a] cursor-not-allowed'
          }`}
        >
          {status === 'analyzing' ? (
            <div className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5 text-[#f5c518]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-[#f5c518] w-[220px] text-left">{loadingMessages[loadingMsgIdx]}</span>
            </div>
          ) : (
            'Analyze & Match'
          )}
        </button>

        {/* Past Matches History Section */}
        <div className="mt-12 bg-[#1a1a24]/60 border border-[#2a2a3a] rounded-xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2a2a3a]">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              📂 Past Matches History
            </h3>
            <button 
              onClick={fetchHistory}
              className="text-[#f5c518] hover:text-[#ffd633] transition-colors text-sm font-medium flex items-center gap-1 bg-[#f5c518]/10 hover:bg-[#f5c518]/20 px-3 py-1 rounded-full cursor-pointer border-none outline-none"
            >
              🔄 Refresh List
            </button>
          </div>
          
          {loadingHistory ? (
            <div className="flex justify-center py-6 text-[#8888aa] text-sm items-center">
              <svg className="animate-spin h-5 w-5 text-[#f5c518] mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading past comparisons...
            </div>
          ) : history.length === 0 ? (
            <p className="text-center py-6 text-[#8888aa] text-sm">
              No past comparisons saved. Run your first match above!
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => loadHistoryItem(item)}
                  className="bg-[#101018] border border-[#2a2a3a] hover:border-[#f5c518]/60 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[#f5c518] text-xs font-bold uppercase tracking-wide">
                        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ 
                          backgroundColor: `${getScoreColor(item.compatibility_percentage)}22`, 
                          color: getScoreColor(item.compatibility_percentage) 
                        }}
                      >
                        {item.compatibility_percentage}% Match
                      </span>
                    </div>
                    <h4 className="text-white font-medium text-sm line-clamp-1 group-hover:text-[#f5c518] transition-colors">
                      {item.deck_name}
                    </h4>
                    <p className="text-[#8888aa] text-xs line-clamp-2 mt-1">
                      {item.business_summary}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#8888aa] group-hover:text-white transition-colors border-t border-[#2a2a3a] pt-2">
                    <span>{item.feature_cards?.length || 0} features</span>
                    <span className="font-semibold text-[#f5c518]">Load Run ➔</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Results Section */}
      {status === 'results' && deckData && (
        <section ref={resultsRef} className="max-w-6xl mx-auto px-6 animate-[fadeIn_0.8s_ease-out]">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#2a2a3a] to-transparent mb-16" />
          
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Panel: Deck Breakdown */}
            <div className={`${compatData ? 'lg:col-span-2' : 'lg:col-span-3'} flex flex-col gap-6`}>
              
              {/* Summary Card */}
              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-8">
                <h3 className="text-2xl font-bold text-white mb-4">What This Business Does</h3>
                <p className="text-[#e8e8f0] leading-relaxed text-lg opacity-90">{deckData.summary}</p>
              </div>

              {/* Pointers Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {deckData.pointers?.map((pt, i) => (
                  <div key={i} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-5 border-l-4 border-l-[#f5c518] hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getEmojiForTitle(pt.title)}</span>
                      <h4 className="font-bold text-white">{pt.title}</h4>
                    </div>
                    <p className="text-sm text-[#8888aa] leading-snug">{pt.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Compatibility Score */}
            {compatData && (
              <div className="flex flex-col gap-6">
              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-8 flex flex-col items-center">
                
                {/* SVG Animated Ring */}
                <div className="relative w-48 h-48 mb-6">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                    {/* Track */}
                    <circle 
                      cx="70" cy="70" r="60" 
                      fill="none" stroke="#2a2a3a" strokeWidth="12" 
                    />
                    {/* Animated Stroke */}
                    <circle 
                      cx="70" cy="70" r="60" 
                      fill="none" 
                      stroke={getScoreColor(compatData.score)} 
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray="377"
                      strokeDashoffset={377 - (animatedScore / 100) * 377}
                      style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-white">{animatedScore}<span className="text-2xl text-[#8888aa]">%</span></span>
                  </div>
                </div>
                <h3 className="text-sm uppercase tracking-widest text-[#8888aa] font-bold">Compatibility Score</h3>

                {/* Match/Mismatch List */}
                <div className="w-full mt-8 space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-white font-semibold border-b border-[#2a2a3a] pb-2">Why This Score?</h4>
                    {compatData.matches?.map((m, i) => (
                      <div key={`m-${i}`} className="flex items-start gap-3">
                        <span className="text-green-500 mt-1 flex-shrink-0">✅</span>
                        <p className="text-sm text-[#e8e8f0]">{m}</p>
                      </div>
                    ))}
                    {compatData.mismatches?.map((m, i) => (
                      <div key={`mm-${i}`} className="flex items-start gap-3 mt-2">
                        <span className="text-red-500 mt-1 flex-shrink-0">❌</span>
                        <p className="text-sm text-[#e8e8f0]">{m}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
              </div>
            </div>
            )}

          </div>
        </section>
      )}

      {/* Global Styles (Keyframes + Basic overrides) */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #101018;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2a3a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f5c518;
        }
      `}} />
    </div>
  );
}

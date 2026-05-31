import { useState, useEffect } from "react";
import { HistorySpider } from "./SpiderFX";

function timeAgo(epochMs) {
  if (!epochMs) return "";
  const diff = (Date.now() - epochMs) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function getMode(entry) {
  try {
    const rec = entry?.result?.final_recommendation;
    if (rec?.mode === "comparison") return "comparison";
    if (entry?.result?.mode) return entry.result.mode;
    if (rec?.winner) return "discovery";
    if (rec?.comparison_table) return "comparison";
  } catch (e) {}
  return "discovery";
}

export default function HistorySidebar({ isOpen, onToggle, onSelect, history: historyProp = [] }) {
  const [localHistory, setLocalHistory] = useState(historyProp);

  useEffect(() => { setLocalHistory(historyProp); }, [historyProp]);

  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem("ronin_history");
        if (raw) setLocalHistory(JSON.parse(raw));
      } catch (e) {}
    }
  }, [isOpen]);

  const clearHistory = () => {
    localStorage.removeItem("ronin_history");
    setLocalHistory([]);
  };

  return (
    <>
      <style>{`
        .history-sidebar {
          position: fixed; top: 0; right: 0; height: 100vh; width: 300px; z-index: 100;
          background: rgba(8,8,8,0.95); border-left: 1px solid rgba(220,20,60,0.2);
          backdrop-filter: blur(24px); transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
          display: flex; flex-direction: column;
        }
        .history-sidebar.open { transform: translateX(0); box-shadow: -4px 0 32px rgba(220,20,60,0.1); }
        .history-toggle-btn {
          position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 101;
          background: rgba(220,20,60,0.9); color: #fff; border: none;
          border-radius: 8px 0 0 8px; padding: 12px 8px; cursor: pointer;
          writing-mode: vertical-rl; font-weight: 700; font-size: 0.65rem;
          letter-spacing: 0.08em; transition: background 0.2s, box-shadow 0.2s;
          box-shadow: -2px 0 16px rgba(220,20,60,0.4);
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .history-toggle-btn:hover { background: rgba(220,20,60,1); box-shadow: -4px 0 24px rgba(220,20,60,0.6); }
        .history-entry {
          padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer; transition: background 0.2s; border-radius: 8px; margin: 3px 8px;
        }
        .history-entry:hover { background: rgba(220,20,60,0.08); }
        .clear-btn {
          background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25);
          color: #f87171; border-radius: 7px; padding: 5px 12px; font-size: 0.72rem;
          cursor: pointer; transition: background 0.2s; font-weight: 600;
        }
        .clear-btn:hover { background: rgba(248,113,113,0.18); }
        @media (max-width: 640px) { .history-sidebar { width: 85vw; } }
      `}</style>

      <button
        className="history-toggle-btn"
        onClick={onToggle}
        style={{ right: isOpen ? "300px" : "0", transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)" }}
      >
        <span style={{ fontSize: "1rem" }}>🕰</span>
        <span style={{ writingMode: "vertical-rl" }}>HISTORY</span>
      </button>

      <div className={`history-sidebar${isOpen ? " open" : ""}`}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(220,20,60,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h3 style={{ color: "#ff6b75", fontWeight: 700, fontSize: "0.9rem", margin: 0, letterSpacing: "0.05em" }}>
            Search History
          </h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {localHistory.length > 0 && <button className="clear-btn" onClick={clearHistory}>Clear</button>}
            <button onClick={onToggle} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "1rem", padding: "2px 4px", lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Spider drops from the top of the sidebar below the header */}
        {isOpen && (
          <div style={{ position: "relative", height: "0", overflow: "visible" }}>
            <HistorySpider />
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {localHistory.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.78rem", textAlign: "center", marginTop: "48px", padding: "0 24px", lineHeight: 1.7 }}>
              No searches yet.<br />Your history will appear here.
            </div>
          ) : (
            [...localHistory].reverse().map((entry, i) => {
              const mode = getMode(entry);
              return (
                <div
                  key={i}
                  className="history-entry"
                  onClick={() => { if (onSelect) onSelect(entry.query); if (onToggle) onToggle(); }}
                >
                  <div style={{ color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }} title={entry.query}>
                    {entry.query}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      background: mode === "comparison" ? "rgba(255,140,148,0.12)" : "rgba(220,20,60,0.1)",
                      border: `1px solid ${mode === "comparison" ? "rgba(255,140,148,0.3)" : "rgba(220,20,60,0.25)"}`,
                      color: mode === "comparison" ? "#ffadb3" : "#ff6b75",
                      borderRadius: "5px", padding: "1px 7px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {mode}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.68rem" }}>{timeAgo(entry.timestamp)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const ICON_MAP = {
  'intent': '🧠', 'classif': '🧭', 'search': '🔍', 'amazon': '📦',
  'review': '⭐', 'rank': '📊', 'recommend': '🏆', 'complet': '✅',
  'error': '❌', 'filter': '🎯', 'analyz': '🔬', 'fetch': '⚡',
  'found': '✓', 'agent': '🤖', 'price': '💰', 'winner': '🥇',
  'score': '⚖️', 'weight': '⚖️', 'llm': '🧠',
};

function getIcon(msg) {
  const lower = (msg || '').toLowerCase();
  for (const [k, v] of Object.entries(ICON_MAP)) {
    if (lower.includes(k)) return v;
  }
  return '▸';
}

export default function ProgressFeed({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if ((!messages || messages.length === 0) && !isLoading) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(220,20,60,0.1)',
      borderRadius: '14px',
      padding: '14px 16px',
      marginBottom: '20px',
      maxHeight: '280px',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        {isLoading && <Loader2 size={12} style={{ color: '#e63946', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
        <span style={{ color: '#475569', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
          {isLoading ? 'Agent Pipeline Running' : 'Pipeline Complete'}
        </span>
        {!isLoading && messages?.length > 0 && (
          <span style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', padding: '1px 8px', fontSize: '0.6rem', fontWeight: 700 }}>
            ✓ Done
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {(messages || []).map((msg, i, arr) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: '5px 8px', borderRadius: '7px',
              background: i === arr.length - 1 && isLoading ? 'rgba(220,20,60,0.05)' : 'transparent',
              border: i === arr.length - 1 && isLoading ? '1px solid rgba(220,20,60,0.1)' : '1px solid transparent',
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <span style={{ fontSize: '0.82rem', flexShrink: 0, lineHeight: 1.4 }}>{getIcon(msg)}</span>
            <span style={{ color: i === arr.length - 1 ? 'rgba(255,255,255,0.65)' : '#334155', fontSize: '0.78rem', lineHeight: 1.5, flex: 1 }}>
              {msg}
            </span>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px' }}>
            <span style={{ fontSize: '0.82rem' }}>⚙️</span>
            <span style={{ color: '#e63946', fontSize: '0.78rem' }}>Processing</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[0,1,2].map(d => (
                <span key={d} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#e63946', display: 'inline-block', animation: `pulse 1.4s ease-in-out ${d * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

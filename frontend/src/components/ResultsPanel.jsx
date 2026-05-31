import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowLeft, GitCompare, Loader2, Zap } from 'lucide-react';
import WinnerCard from './WinnerCard';
import ComparisonView from './ComparisonView';
import RankedTable from './RankedTable';
import ProgressFeed from './ProgressFeed';

export default function ResultsPanel({ result, isLoading, progress, query, onNewSearch, onSearch }) {
  const [searchVal, setSearchVal] = useState(query || '')
  const inputRef = useRef(null)

  if (!result) return null;

  const rec = result.final_recommendation;
  const mode = result.mode;
  const ranked = rec?.ranked || [];
  const isEmpty = !rec || (mode !== 'comparison' && !rec.winner?.name && ranked.length === 0);

  const handleInlineSearch = (e) => {
    e.preventDefault()
    const trimmed = searchVal.trim()
    if (trimmed && onSearch) onSearch(trimmed)
  }

  const handleCompareTop3 = () => {
    if (ranked.length >= 2 && onSearch) {
      const names = ranked.slice(0, 3).map(r => r.name)
      onSearch(`Compare ${names.join(' vs ')}`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#03040a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(3,4,10,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '12px 24px',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Back */}
          <button
            onClick={onNewSearch}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <ArrowLeft size={14} />
            New Search
          </button>

          {/* Inline search bar */}
          <form onSubmit={handleInlineSearch} style={{ flex: 1, minWidth: '240px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '10px',
              padding: '6px 12px',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={() => {}}
            >
              <Search size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                disabled={isLoading}
                placeholder="Refine your search..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#e2e8f0',
                  fontSize: '0.85rem',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              {isLoading && <Loader2 size={13} style={{ color: '#6366f1', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
            </div>
          </form>

          {/* Ronin logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={11} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em', color: '#fff' }}>RONIN</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Query label */}
        {query && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: '28px' }}
          >
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Results for</p>
            <h2 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{query}</h2>
          </motion.div>
        )}

        <ProgressFeed messages={progress} isLoading={isLoading} />

        {/* Empty / not found state */}
        {isEmpty && !isLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>🔍</div>
            <h3 style={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: 700, marginBottom: '10px' }}>No products found</h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '28px' }}>Try a different query or be more specific about the product category.</p>
            <button
              onClick={onNewSearch}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', borderRadius: '10px',
                padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              Try a different search
            </button>
          </motion.div>
        ) : mode === 'comparison' ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <ComparisonView rec={rec} />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <WinnerCard winner={rec?.winner} weights={rec?.weights_used} />

            {/* Compare Top 3 button */}
            {ranked.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ marginBottom: '8px' }}
              >
                <button
                  onClick={handleCompareTop3}
                  disabled={isLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#818cf8',
                    borderRadius: '10px',
                    padding: '9px 18px',
                    fontSize: '0.85rem', fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.16)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                >
                  <GitCompare size={15} />
                  Compare Top {Math.min(3, ranked.length)} Side by Side
                </button>
              </motion.div>
            )}

            <RankedTable
              ranked={ranked}
              productCache={result.agent_opinions?.search_agent?.product_cache || {}}
            />
          </motion.div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

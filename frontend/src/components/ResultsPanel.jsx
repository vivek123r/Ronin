import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowLeft, GitCompare, Loader2 } from 'lucide-react';

function SpiderIcon({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C10.9 2 10 2.9 10 4C10 4.74 10.4 5.38 11 5.73V7H9C7.9 7 7 7.9 7 9V10H5.27C4.64 9.39 3.74 9 2.73 9C1.22 9 0 10.22 0 11.73C0 13.24 1.22 14.46 2.73 14.46C3.74 14.46 4.64 14.07 5.27 13.46H7V15C7 15.55 7.22 16.05 7.59 16.41L5 21H7L9 17H15L17 21H19L16.41 16.41C16.78 16.05 17 15.55 17 15V13.46H18.73C19.36 14.07 20.26 14.46 21.27 14.46C22.78 14.46 24 13.24 24 11.73C24 10.22 22.78 9 21.27 9C20.26 9 19.36 9.39 18.73 10H17V9C17 7.9 16.1 7 15 7H13V5.73C13.6 5.38 14 4.74 14 4C14 2.9 13.1 2 12 2ZM9 9H15V11H9V9ZM9 13H15V15H9V13Z"/>
    </svg>
  )
}
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
    <div style={{ minHeight: '100vh', backgroundColor: '#080808', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8,8,8,0.85)',
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
              border: '1px solid rgba(220,20,60,0.2)',
              borderRadius: '10px',
              padding: '6px 12px',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={() => {}}
            >
              <Search size={14} style={{ color: '#e63946', flexShrink: 0 }} />
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
              {isLoading && <Loader2 size={13} style={{ color: '#e63946', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
            </div>
          </form>

          {/* Ronin logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'radial-gradient(circle, #e63946, #8b0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(220,20,60,0.5)' }}>
              <SpiderIcon size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.12em', color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>RONIN</span>
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
                background: 'linear-gradient(135deg, #e63946, #e63946)',
                color: '#fff', border: 'none', borderRadius: '10px',
                padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(220,20,60,0.35)',
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
                    background: 'rgba(220,20,60,0.08)',
                    border: '1px solid rgba(220,20,60,0.3)',
                    color: '#ff6b75',
                    borderRadius: '10px',
                    padding: '9px 18px',
                    fontSize: '0.85rem', fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,20,60,0.16)'; e.currentTarget.style.borderColor = 'rgba(220,20,60,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,20,60,0.08)'; e.currentTarget.style.borderColor = 'rgba(220,20,60,0.3)' }}
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

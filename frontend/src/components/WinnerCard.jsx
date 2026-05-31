import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score }) {
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  useEffect(() => {
    const t = setTimeout(() => {
      const val = Math.min(Math.max(score ?? 0, 0), 100);
      setOffset(CIRCUMFERENCE * (1 - val / 100));
    }, 100);
    return () => clearTimeout(t);
  }, [score]);
  const val = Math.min(Math.max(score ?? 0, 0), 100);
  const color = val >= 80 ? '#a78bfa' : val >= 60 ? '#818cf8' : '#6366f1';
  return (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="60" cy="60" r={RADIUS} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color, fontSize: '1.4rem', fontWeight: 800, lineHeight: 1 }}>{val.toFixed(0)}</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>SCORE</span>
      </div>
    </div>
  );
}

function formatPrice(price_inr) {
  if (price_inr == null) return null;
  const num = typeof price_inr === 'string' ? parseFloat(price_inr.replace(/[^0-9.]/g, '')) : price_inr;
  if (isNaN(num)) return String(price_inr);
  return '₹' + num.toLocaleString('en-IN');
}

function RatingBar({ star, pct }) {
  const colors = { 5: '#4ade80', 4: '#a3e635', 3: '#facc15', 2: '#fb923c', 1: '#f87171' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span style={{ color: '#64748b', fontSize: '0.7rem', width: '12px', textAlign: 'right' }}>{star}</span>
      <span style={{ color: '#64748b', fontSize: '0.65rem' }}>★</span>
      <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: (5 - star) * 0.1 }}
          style={{ height: '100%', borderRadius: '3px', background: colors[star] || '#6366f1' }}
        />
      </div>
      <span style={{ color: '#475569', fontSize: '0.65rem', width: '28px' }}>{pct}%</span>
    </div>
  );
}

export default function WinnerCard({ winner, weights, productCache }) {
  const [qualityWidth, setQualityWidth] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQualityWidth(Math.min(Math.max(winner?.quality_score ?? 0, 0), 100));
    }, 200);
    return () => clearTimeout(t);
  }, [winner?.quality_score]);

  if (!winner?.name) return null;

  // Try to get extra cache data
  const cacheKey = productCache && (productCache[winner.name] ? winner.name :
    Object.keys(productCache || {}).find(k => k.toLowerCase().includes(winner.name.toLowerCase().slice(0, 15))))
  const cached = productCache?.[cacheKey] || null;

  const priceDisplay = formatPrice(winner.price_inr);
  const inStock = winner.availability?.toLowerCase().includes('in stock');
  const benefits = Array.isArray(winner.benefits) ? winner.benefits : [];
  const losses = Array.isArray(winner.losses) ? winner.losses : [];
  const aboutBullets = Array.isArray(cached?.about_product) ? cached.about_product.slice(0, 5) : [];
  const ratingDist = cached?.rating_distribution || null;
  const imgUrl = winner.product_image_url || cached?.product_image_url || null;

  const handleShare = async () => {
    const text = `🏆 Best: ${winner.name}\nScore: ${(winner.combined_score || 0).toFixed(0)}/100 | Price: ${priceDisplay || 'N/A'}\nWhy: ${winner.why || ''}\nBuy: ${winner.url || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '20px',
        padding: '28px',
        marginBottom: '20px',
        boxShadow: '0 4px 40px rgba(99,102,241,0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient top glow */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)',
      }} />

      {/* Main row: image + score ring + info */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap' }}>
        {/* Product image */}
        {imgUrl && (
          <div style={{
            width: '100px', height: '100px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={imgUrl}
              alt={winner.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => { e.currentTarget.parentNode.style.display = 'none' }}
            />
          </div>
        )}

        <ScoreRing score={winner.combined_score} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', padding: '3px 10px', borderRadius: 9999, textTransform: 'uppercase' }}>
              WINNER
            </span>
            {winner.confidence != null && (
              <span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: '0.65rem', fontWeight: 600, padding: '3px 10px', borderRadius: 9999, border: '1px solid rgba(99,102,241,0.25)' }}>
                {typeof winner.confidence === 'number' ? winner.confidence.toFixed(0) + '% confidence' : winner.confidence}
              </span>
            )}
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '10px', fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
            {winner.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {priceDisplay && (
              <span style={{ background: 'rgba(99,102,241,0.12)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.3)', fontWeight: 800, fontSize: '1rem', padding: '4px 14px', borderRadius: 9999 }}>
                {priceDisplay}
              </span>
            )}
            {winner.availability && (
              <span style={{ background: inStock ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: inStock ? '#4ade80' : '#f87171', border: `1px solid ${inStock ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`, fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: 9999 }}>
                {winner.availability}
              </span>
            )}
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? '#4ade80' : '#94a3b8',
            borderRadius: '8px', padding: '8px 14px',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {copied ? <Check size={13} /> : <Share2 size={13} />}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* Quality bar */}
      {winner.quality_score != null && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Quality Score</span>
            <span style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: 700 }}>{winner.quality_score.toFixed(0)}%</span>
          </div>
          <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: qualityWidth + '%', background: 'linear-gradient(90deg, #6366f1, #a78bfa)', borderRadius: '3px', transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 8px rgba(99,102,241,0.5)' }} />
          </div>
        </div>
      )}

      {/* Rating distribution */}
      {ratingDist && Object.keys(ratingDist).length > 0 && (
        <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Rating Distribution</p>
          {[5, 4, 3, 2, 1].map(star => (
            <RatingBar key={star} star={star} pct={ratingDist[star] ?? ratingDist[String(star)] ?? 0} />
          ))}
        </div>
      )}

      {/* Why */}
      {winner.why && (
        <div style={{ marginBottom: '20px', padding: '14px 16px', background: 'rgba(99,102,241,0.04)', borderRadius: '12px', borderLeft: '3px solid rgba(99,102,241,0.4)' }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>
            {winner.why}
          </p>
        </div>
      )}

      {/* Benefits & Losses */}
      {(benefits.length > 0 || losses.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {benefits.length > 0 && (
            <div>
              <p style={{ color: '#4ade80', fontSize: '0.7rem', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Benefits</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {benefits.map((b, i) => (
                  <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#4ade80', marginTop: '2px', fontSize: '0.75rem' }}>✓</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', lineHeight: 1.5 }}>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {losses.length > 0 && (
            <div>
              <p style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Caveats</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {losses.map((l, i) => (
                  <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#fbbf24', marginTop: '2px', fontSize: '0.75rem' }}>⚠</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', lineHeight: 1.5 }}>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* About product / specs */}
      {aboutBullets.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setShowSpecs(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none',
              color: '#818cf8', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', padding: 0, marginBottom: showSpecs ? '12px' : 0,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {showSpecs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showSpecs ? 'Hide' : 'Show'} Specifications
          </button>
          {showSpecs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {aboutBullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#6366f1', fontSize: '0.65rem', marginTop: '4px', flexShrink: 0 }}>◆</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Weights */}
      {weights && Object.keys(weights).length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {Object.entries(weights).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
              <div style={{ color: '#818cf8', fontSize: '0.78rem', fontWeight: 700 }}>{(v * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}

      {/* Buy button */}
      <button
        onClick={() => winner.url && window.open(winner.url, '_blank')}
        disabled={!winner.url}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: winner.url ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.2)',
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '11px 28px', fontWeight: 700, fontSize: '0.9rem',
          cursor: winner.url ? 'pointer' : 'not-allowed',
          boxShadow: winner.url ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => winner.url && (e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.6)')}
        onMouseLeave={e => winner.url && (e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)')}
      >
        <ExternalLink size={15} />
        Buy on Amazon
      </button>
    </motion.div>
  );
}

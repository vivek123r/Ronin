import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { ProductDNA, MultiDNA } from './RadarChart';

const SMALL_R = 36;
const SMALL_C = 2 * Math.PI * SMALL_R;

function SmallScoreRing({ score, delay = 0 }) {
  const [offset, setOffset] = useState(SMALL_C);
  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(SMALL_C * (1 - Math.min(Math.max(score ?? 0, 0), 100) / 100));
    }, 100 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  const val = Math.min(Math.max(score ?? 0, 0), 100);
  const size = (SMALL_R + 10) * 2;
  const color = val >= 75 ? '#ff8c94' : val >= 55 ? '#ff6b75' : '#e63946';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={SMALL_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={SMALL_R} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={SMALL_C} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color, fontSize: '0.9rem', fontWeight: 700 }}>{val.toFixed(0)}</span>
      </div>
    </div>
  );
}

function formatPrice(p) {
  if (!p) return null;
  const num = typeof p === 'string' ? parseFloat(p.replace(/[^0-9.]/g, '')) : p;
  if (isNaN(num)) return String(p);
  return '₹' + num.toLocaleString('en-IN');
}

function sentimentStyle(s) {
  if (!s) return {};
  const sl = s.toLowerCase();
  if (sl.includes('positive') || sl.includes('good') || sl.includes('excellent'))
    return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' };
  if (sl.includes('negative') || sl.includes('poor') || sl.includes('bad'))
    return { bg: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' };
  return { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' };
}

function ProductCard({ item, index, reviewData }) {
  const [dnaExpanded, setDnaExpanded] = useState(false);
  const priceDisplay = formatPrice(item.price_inr);
  const inStock = item.availability?.toLowerCase?.()?.includes('in stock') || item.availability?.includes('In Stock');
  const benefits = Array.isArray(item.benefits) ? item.benefits.slice(0, 3) : [];
  const losses = Array.isArray(item.losses) ? item.losses.slice(0, 2) : [];
  const sStyle = sentimentStyle(item.sentiment);
  const imgUrl = item.product_image_url || null;
  const highlights = reviewData?.review_highlights?.slice(0, 2) || (Array.isArray(item.highlights) ? item.highlights.slice(0, 2) : []);
  const categoryScores = item.category_scores || reviewData?.category_scores || {};
  const hasDNA = Object.keys(categoryScores).length >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.45 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      whileHover={{ borderColor: 'rgba(220,20,60,0.3)', boxShadow: '0 8px 30px rgba(220,20,60,0.1)' }}
    >
      <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(220,20,60,0.3), transparent)' }} />

      {imgUrl && (
        <div style={{ width: '100%', height: '120px', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={imgUrl} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.parentNode.style.display = 'none' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <SmallScoreRing score={item.quality} delay={index * 120} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3, marginBottom: '4px' }}>{item.name}</h3>
          {item.sentiment && (
            <span style={{ ...sStyle, fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.sentiment}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {priceDisplay && (
          <span style={{ background: 'rgba(220,20,60,0.1)', color: '#ff8c94', border: '1px solid rgba(220,20,60,0.25)', fontWeight: 800, fontSize: '0.9rem', padding: '3px 12px', borderRadius: 9999 }}>
            {priceDisplay}
          </span>
        )}
        {item.availability && (
          <span style={{ background: inStock ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: inStock ? '#4ade80' : '#f87171', border: `1px solid ${inStock ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`, fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 9999 }}>
            {item.availability}
          </span>
        )}
      </div>

      {highlights.length > 0 && (
        <div style={{ background: 'rgba(220,20,60,0.04)', borderRadius: '10px', padding: '10px 12px', borderLeft: '2px solid rgba(220,20,60,0.3)' }}>
          {highlights.map((h, i) => (
            <p key={i} style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontStyle: 'italic', lineHeight: 1.5, marginBottom: i < highlights.length - 1 ? '4px' : 0 }}>
              "{h}"
            </p>
          ))}
        </div>
      )}

      {benefits.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {benefits.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
              <span style={{ color: '#4ade80', fontSize: '0.72rem', marginTop: '1px' }}>✓</span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', lineHeight: 1.4 }}>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {losses.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {losses.map((l, i) => (
            <li key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
              <span style={{ color: '#fbbf24', fontSize: '0.72rem', marginTop: '1px' }}>⚠</span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', lineHeight: 1.4 }}>{l}</span>
            </li>
          ))}
        </ul>
      )}

      {item.confidence != null && (
        <div>
          <span style={{ background: 'rgba(220,20,60,0.08)', color: '#ff6b75', border: '1px solid rgba(220,20,60,0.2)', fontSize: '0.65rem', fontWeight: 600, padding: '2px 9px', borderRadius: 9999 }}>
            {typeof item.confidence === 'number' ? item.confidence.toFixed(0) + '% confidence' : item.confidence}
          </span>
        </div>
      )}

      {/* DNA Profile toggle */}
      {hasDNA && (
        <div style={{ borderTop: '1px solid rgba(220,20,60,0.08)', paddingTop: 10 }}>
          <button
            onClick={() => setDnaExpanded(!dnaExpanded)}
            style={{
              background: 'rgba(220,20,60,0.06)', border: '1px solid rgba(220,20,60,0.18)',
              color: '#ff6b75', borderRadius: 6, padding: '5px 12px',
              fontSize: '0.65rem', fontFamily: 'monospace', cursor: 'pointer',
              letterSpacing: '0.06em', fontWeight: 600, width: '100%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,20,60,0.06)'}
          >
            {dnaExpanded ? '▾ HIDE DNA PROFILE' : '▸ DNA PROFILE'}
          </button>
          {dnaExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}
            >
              <ProductDNA categoryScores={categoryScores} size={220} colorIndex={index} />
            </motion.div>
          )}
        </div>
      )}

      {item.url && (
        <a
          href={item.url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            background: 'rgba(220,20,60,0.08)', color: '#ff6b75', border: '1px solid rgba(220,20,60,0.25)',
            borderRadius: '8px', padding: '8px', fontWeight: 700, fontSize: '0.78rem',
            textDecoration: 'none', marginTop: 'auto', transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,20,60,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,20,60,0.08)')}
        >
          <ExternalLink size={13} /> View on Amazon
        </a>
      )}
    </motion.div>
  );
}

export default function ComparisonView({ rec, agentOpinions }) {
  if (!rec?.comparison_table) return null;
  const reviewAnalysis = agentOpinions?.review_agent?.products_analyzed || {};

  // All products with category_scores for overlay radar
  const productsWithDNA = rec.comparison_table.filter(p => {
    const scores = p.category_scores || {}
    return Object.keys(scores).length >= 3
  })

  return (
    <div>
      {rec.verdict && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '20px', padding: '18px 22px', background: 'rgba(220,20,60,0.04)', border: '1px solid rgba(220,20,60,0.15)', borderRadius: '14px', borderLeft: '3px solid rgba(220,20,60,0.5)' }}
        >
          <p style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>{rec.verdict}</p>
        </motion.div>
      )}

      {(rec.best_value || rec.best_performance) && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {rec.best_value && (
            <span style={{ background: 'rgba(220,20,60,0.1)', color: '#ff6b75', border: '1px solid rgba(220,20,60,0.3)', fontWeight: 700, fontSize: '0.8rem', padding: '6px 16px', borderRadius: 9999, boxShadow: '0 0 12px rgba(220,20,60,0.15)' }}>
              Best Value: {rec.best_value}
            </span>
          )}
          {rec.best_performance && (
            <span style={{ background: 'rgba(255,140,148,0.1)', color: '#ffadb3', border: '1px solid rgba(255,140,148,0.3)', fontWeight: 700, fontSize: '0.8rem', padding: '6px 16px', borderRadius: 9999, boxShadow: '0 0 12px rgba(255,140,148,0.15)' }}>
              Best Performance: {rec.best_performance}
            </span>
          )}
        </div>
      )}

      {/* DNA Comparison overlay - show when multiple products have DNA */}
      {productsWithDNA.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ marginBottom: '24px', padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.15)', borderRadius: 14, backdropFilter: 'blur(10px)' }}
        >
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 14, fontFamily: 'monospace', fontWeight: 700 }}>
            ◈ DNA COMPARISON OVERLAY
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <MultiDNA products={productsWithDNA} size={300} />
          </div>
        </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {rec.comparison_table.map((item, i) => (
          <ProductCard
            key={item.name || i}
            item={item}
            index={i}
            reviewData={reviewAnalysis[item.name]}
          />
        ))}
      </div>
    </div>
  );
}

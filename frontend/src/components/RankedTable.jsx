import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

function formatPrice(price) {
  if (price === null || price === undefined || price === "" || price === "N/A") return "N/A";
  const num = typeof price === "string" ? parseFloat(price.replace(/[^0-9.]/g, "")) : price;
  if (isNaN(num)) return String(price);
  return "₹" + num.toLocaleString("en-IN");
}

function getAvailabilityDisplay(availability) {
  if (!availability) return { emoji: "❓", text: "Unknown", color: "#475569" };
  const val = String(availability).toLowerCase();
  if (val === "true" || val === "in stock" || val === "available") return { emoji: "●", text: "In Stock", color: "#4ade80" };
  if (val === "false" || val === "out of stock" || val === "unavailable") return { emoji: "●", text: "Out of Stock", color: "#f87171" };
  return { emoji: "●", text: String(availability), color: "#fbbf24" };
}

function ScorePill({ score }) {
  const num = typeof score === "number" ? score : parseFloat(score);
  let bg, color;
  if (num >= 75) { bg = 'rgba(167,139,250,0.12)'; color = '#a78bfa'; }
  else if (num >= 55) { bg = 'rgba(250,204,21,0.12)'; color = '#fbbf24'; }
  else { bg = 'rgba(248,113,113,0.12)'; color = '#f87171'; }
  return (
    <span style={{ background: bg, color, borderRadius: '6px', padding: '3px 10px', fontWeight: 700, fontSize: '0.82rem', border: `1px solid ${color}33` }}>
      {isNaN(num) ? score : num.toFixed(1)}
    </span>
  );
}

function MiniRatingBars({ dist }) {
  if (!dist || Object.keys(dist).length === 0) return null;
  const colors = { 5: '#4ade80', 4: '#a3e635', 3: '#facc15', 2: '#fb923c', 1: '#f87171' };
  return (
    <div style={{ marginTop: '10px' }}>
      <p style={{ color: '#6366f1', fontSize: '0.72rem', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.05em' }}>Rating Distribution</p>
      {[5, 4, 3, 2, 1].map(star => {
        const pct = dist[star] ?? dist[String(star)] ?? 0;
        return (
          <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span style={{ color: '#475569', fontSize: '0.65rem', width: '10px' }}>{star}</span>
            <span style={{ color: '#475569', fontSize: '0.6rem' }}>★</span>
            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: colors[star] || '#6366f1', transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ color: '#334155', fontSize: '0.6rem', width: '24px' }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function findInCache(productCache, name) {
  if (!productCache) return null;
  if (productCache[name]) return productCache[name];
  const lower = name.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  const keys = Object.keys(productCache);
  for (const key of keys) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return productCache[key];
  }
  for (const key of keys) {
    if (words.some(w => key.toLowerCase().includes(w))) return productCache[key];
  }
  return null;
}

function ExpandedRow({ item, productCache }) {
  const cached = findInCache(productCache, item.name);
  const about = Array.isArray(cached?.about_product) ? cached.about_product.slice(0, 4) : [];
  const ratingDist = cached?.rating_distribution || null;
  const reviews = cached?.customer_reviews?.slice(0, 2) || [];

  return (
    <tr>
      <td colSpan={7} style={{ background: 'rgba(99,102,241,0.03)', borderBottom: '1px solid rgba(99,102,241,0.12)', padding: 0 }}>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ padding: '16px 24px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Left: desc + about */}
            <div>
              {cached?.product_description && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '10px' }}>
                  {cached.product_description}
                </p>
              )}
              {item.benefits && (
                <p style={{ color: '#4ade80', fontSize: '0.78rem', marginBottom: '6px' }}>✓ {item.benefits}</p>
              )}
              {item.losses && (
                <p style={{ color: '#fbbf24', fontSize: '0.78rem', marginBottom: '10px' }}>⚠ {item.losses}</p>
              )}
              {about.length > 0 && (
                <div>
                  <p style={{ color: '#6366f1', fontSize: '0.72rem', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.05em' }}>Specifications</p>
                  {about.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '4px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#4f46e5', fontSize: '0.6rem', marginTop: '4px', flexShrink: 0 }}>◆</span>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', lineHeight: 1.4 }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Right: rating bars + reviews */}
            <div>
              <MiniRatingBars dist={ratingDist} />
              {reviews.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ color: '#6366f1', fontSize: '0.72rem', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em' }}>Customer Reviews</p>
                  {reviews.map((r, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px', padding: '8px 12px',
                      color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem',
                      lineHeight: 1.5, marginBottom: '6px', fontStyle: 'italic',
                    }}>
                      "{r.review_body}"
                    </div>
                  ))}
                </div>
              )}
              {!cached && (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', fontStyle: 'italic', marginTop: '8px' }}>No additional details available.</p>
              )}
            </div>
          </div>
        </motion.div>
      </td>
    </tr>
  );
}

export default function RankedTable({ ranked, productCache }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (!ranked || ranked.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        borderRadius: '18px',
        padding: '20px',
        marginTop: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>All Ranked Products</h2>
        <span style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600 }}>
          {ranked.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
              {['#', 'Product', 'Score', 'Quality', 'Price', 'Stock', 'Link'].map(h => (
                <th key={h} style={{ color: '#475569', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((item, i) => {
              const avail = getAvailabilityDisplay(item.availability);
              const isExpanded = expandedIndex === i;
              const imgUrl = item.product_image_url || findInCache(productCache, item.name)?.product_image_url || null;
              return (
                <React.Fragment key={i}>
                  <motion.tr
                    className="ranked-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={visible ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    style={{
                      borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.04)',
                      background: isExpanded ? 'rgba(99,102,241,0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '11px 12px', color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', fontWeight: 700 }}>
                      {item.rank ?? i + 1}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {imgUrl && (
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.parentNode.style.display = 'none' }} />
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</span>
                          <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <ScorePill score={item.score} />
                    </td>
                    <td style={{ padding: '11px 12px', color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>
                      {item.quality !== undefined ? (typeof item.quality === 'number' ? item.quality.toFixed(1) : item.quality) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {formatPrice(item.price_inr)}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      <span style={{ color: avail.color, fontSize: '0.55rem', marginRight: '5px' }}>●</span>
                      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{avail.text}</span>
                    </td>
                    <td style={{ padding: '11px 12px' }} onClick={e => e.stopPropagation()}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="view-btn">View</a>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </motion.tr>
                  {isExpanded && <ExpandedRow item={item} productCache={productCache} />}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

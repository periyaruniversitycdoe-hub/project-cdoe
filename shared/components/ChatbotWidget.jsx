/**
 * ChatbotWidget — Floating PhD Portal support chatbot.
 * Props:
 *   apiUrl    {string}  Base API URL for the portal backend (e.g. "http://localhost:5000")
 *   portalKey {string}  "public" | "student" | "supervisor" | "center"
 *   userInfo  {object}  Optional { id, name, email } for authenticated user
 *   token     {string}  Optional JWT for authenticated requests
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

const COLORS = {
  primary: '#1e3a5f', accent: '#32c5d2', success: '#10b981',
  warning: '#f59e0b', danger: '#ef4444', muted: '#6b7280',
  bg: '#f4f6f9', card: '#fff', border: '#e5e7eb',
};

const STATUS_LABELS = {
  new: { label: 'Pending', color: '#3b82f6', bg: '#dbeafe' },
  pending_review: { label: 'In Review', color: '#f59e0b', bg: '#fef3c7' },
  in_progress:    { label: 'In Progress', color: '#8b5cf6', bg: '#ede9fe' },
  answered:  { label: 'Answered', color: '#10b981', bg: '#d1fae5' },
  published: { label: 'Published', color: '#059669', bg: '#d1fae5' },
  closed:    { label: 'Closed', color: '#6b7280', bg: '#f3f4f6' },
};

export default function ChatbotWidget({ apiUrl = 'http://localhost:5000', portalKey = 'public', userInfo = null, token = null }) {
  const BASE = `${apiUrl}/api/chatbot`;

  const [config, setConfig]         = useState(null);
  const [open, setOpen]             = useState(false);
  const [activeTab, setActiveTab]   = useState('chat');
  const [notifCount, setNotifCount] = useState(0);
  const [faqs, setFaqs]             = useState([]);
  const [categories, setCategories] = useState([]);
  const [myQueries, setMyQueries]   = useState([]);
  const [notifications, setNotifs]  = useState([]);

  // Chat state
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName]   = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [sending, setSending]       = useState(false);
  const [searching, setSearching]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedCat, setSelectedCat] = useState('');

  const messagesEndRef = useRef(null);
  const searchTimer    = useRef(null);

  const headers = token ? { Authorization: `Bearer ${token}`, 'bypass-tunnel-reminder': 'true' }
                        : { 'bypass-tunnel-reminder': 'true' };

  // Fetch config on mount
  useEffect(() => {
    fetch(`${BASE}/config`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.enabled) {
          setConfig(d.data);
          setMessages([{ role: 'bot', text: d.data.welcome_message, ts: Date.now() }]);
        }
      })
      .catch(() => {});
  }, [apiUrl]);

  // Poll unread notifications
  useEffect(() => {
    if (!config?.enabled) return;
    const fetchNotifs = () => {
      const qs = userInfo?.id ? `?user_id=${userInfo.id}` : guestEmail ? `?user_email=${encodeURIComponent(guestEmail)}` : '';
      if (!qs) return;
      fetch(`${BASE}/notifications/unread${qs}`, { headers }).then(r => r.json()).then(d => {
        if (d.success) { setNotifCount(d.count); setNotifs(d.data || []); }
      }).catch(() => {});
    };
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30000);
    return () => clearInterval(t);
  }, [config, guestEmail, userInfo]);

  // Load FAQs + categories when tab opens
  useEffect(() => {
    if (!open || !config?.enabled) return;
    fetch(`${BASE}/faqs${selectedCat ? `?category_id=${selectedCat}` : ''}`, { headers })
      .then(r => r.json()).then(d => setFaqs(d.data || [])).catch(() => {});
    if (categories.length === 0) {
      fetch(`${BASE}/categories`, { headers }).then(r => r.json()).then(d => setCategories(d.data || [])).catch(() => {});
    }
  }, [open, selectedCat, config]);

  // Load my queries when tab is active
  useEffect(() => {
    if (activeTab !== 'myqueries' || !open) return;
    const qs = userInfo?.id ? '' : guestEmail ? `?user_email=${encodeURIComponent(guestEmail)}` : '';
    if (!userInfo?.id && !guestEmail) return;
    fetch(`${BASE}/my-queries${qs}`, { headers }).then(r => r.json()).then(d => setMyQueries(d.data || [])).catch(() => {});
  }, [activeTab, open, guestEmail, userInfo]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults(null); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      fetch(`${BASE}/search?q=${encodeURIComponent(searchQuery)}`, { headers })
        .then(r => r.json()).then(d => setSearchResults(d.data || null))
        .catch(() => setSearchResults(null))
        .finally(() => setSearching(false));
    }, 400);
  }, [searchQuery]);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || sending) return;

    const isGuest = !userInfo?.id;
    if (isGuest && !showForm && !guestEmail) { setShowForm(true); return; }
    if (isGuest && !guestEmail.trim()) return;

    setSending(true);
    setMessages(prev => [...prev, { role: 'user', text: q, ts: Date.now() }]);
    setInput('');

    try {
      const body = { question: q };
      if (isGuest) { body.user_name = guestName; body.user_email = guestEmail; }
      const res  = await fetch(`${BASE}/query`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        if (data.auto_answered) {
          setMessages(prev => [...prev, { role: 'bot', text: data.answer, ts: Date.now(), auto: true }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'bot',
            text: `Your question has been submitted (Ref: ${data.query_ref}). Our support team will respond shortly. You will be notified by email.`,
            ts: Date.now(), queued: true, ref: data.query_ref,
          }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: data.message || 'Failed to submit question. Please try again.', ts: Date.now(), error: true }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Network error. Please check your connection and try again.', ts: Date.now(), error: true }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, userInfo, guestEmail, guestName, showForm]);

  const markNotifRead = async (ids) => {
    try {
      await fetch(`${BASE}/notifications/mark-read`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      setNotifCount(prev => Math.max(0, prev - ids.length));
      setNotifs(prev => prev.filter(n => !ids.includes(n.id)));
    } catch (_) {}
  };

  const markFaqHelpful = async (id) => {
    await fetch(`${BASE}/faqs/${id}/helpful`, { method: 'POST', headers }).catch(() => {});
    setFaqs(prev => prev.map(f => f.id === id ? { ...f, helpful_count: (f.helpful_count||0)+1 } : f));
  };

  const useFaqAnswer = (faq) => {
    setMessages(prev => [...prev,
      { role: 'user', text: faq.question, ts: Date.now() },
      { role: 'bot', text: faq.answer, ts: Date.now(), faqId: faq.id },
    ]);
    setActiveTab('chat');
  };

  if (!config?.enabled) return null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    fab: {
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      width: 56, height: 56, borderRadius: '50%',
      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(30,58,95,.4)', transition: 'transform .2s, box-shadow .2s',
    },
    window: {
      position: 'fixed', bottom: 88, right: 24, zIndex: 9998,
      width: 370, height: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 120px)',
      background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(0,0,0,.18)', overflow: 'hidden',
      animation: open ? 'cbSlideIn .2s ease' : 'none',
    },
    header: {
      background: `linear-gradient(135deg, ${COLORS.primary}, #2d5185)`,
      padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: '#fff', flexShrink: 0,
    },
    tabs: {
      display: 'flex', background: '#f8fafc', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
    },
    tabBtn: (active) => ({
      flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
      background: active ? '#fff' : 'transparent',
      color: active ? COLORS.primary : COLORS.muted,
      borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
      transition: 'all .15s',
    }),
    body: { flex: 1, overflowY: 'auto', padding: 0 },
    chatArea: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
    msgList: { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
    botBubble: { maxWidth: '82%', alignSelf: 'flex-start', background: '#f0f9ff', border: `1px solid #bfdbfe`, borderRadius: '12px 12px 12px 4px', padding: '9px 12px', fontSize: 13, lineHeight: 1.5, color: COLORS.text },
    userBubble: { maxWidth: '82%', alignSelf: 'flex-end', background: COLORS.primary, color: '#fff', borderRadius: '12px 12px 4px 12px', padding: '9px 12px', fontSize: 13, lineHeight: 1.5 },
    inputArea: { padding: '10px 12px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 },
  };

  const totalBadge = notifCount > 0 || messages.filter(m => m.queued && m.role === 'bot').length > 0;

  return (
    <>
      <style>{`
        @keyframes cbSlideIn { from { opacity:0; transform:translateY(12px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes cbPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        .cb-fab:hover { transform:scale(1.08) !important; box-shadow:0 6px 28px rgba(30,58,95,.55) !important; }
        .cb-tab:hover { background:#f0f9ff !important; color:${COLORS.primary} !important; }
        .cb-msg-time { font-size:10px; color:${COLORS.muted}; margin-top:3px; }
        .cb-faq-item:hover { background:#f0f9ff !important; }
        .cb-input { resize:none; outline:none; border:1px solid ${COLORS.border}; border-radius:8px; padding:8px 10px; font-size:13px; flex:1; min-height:38px; max-height:80px; font-family:inherit; }
        .cb-input:focus { border-color:${COLORS.accent}; }
        .cb-send-btn { width:36px; height:36px; border-radius:8px; background:${COLORS.accent}; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .15s; }
        .cb-send-btn:hover { background:${COLORS.primary}; }
        .cb-send-btn:disabled { background:#d1d5db; cursor:not-allowed; }
        .cb-query-card { background:#f8fafc; border:1px solid ${COLORS.border}; border-radius:8px; padding:10px 12px; margin-bottom:8px; }
        @media print {
          .cb-fab, .cb-window {
            display: none !important;
          }
        }
      `}</style>

      {/* FAB */}
      <button className="cb-fab" style={S.fab} onClick={() => setOpen(o => !o)} title="Open Support Chat">
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {(notifCount > 0 || totalBadge) && (
              <span style={{ position: 'absolute', top: -2, right: -2, background: COLORS.danger, color: '#fff',
                borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                {notifCount > 9 ? '9+' : notifCount || '!'}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="cb-window" style={S.window}>
          {/* Header */}
          <div style={S.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>PhD Portal Support</div>
                <div style={{ fontSize: 11, opacity: .8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
                  Online — Here to help
                </div>
              </div>
            </div>
            {notifCount > 0 && (
              <span style={{ background: COLORS.danger, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                {notifCount} new
              </span>
            )}
          </div>

          {/* Tabs */}
          <div style={S.tabs}>
            {[
              { id: 'chat', label: '💬 Chat' },
              { id: 'faq', label: '❓ FAQ' },
              { id: 'myqueries', label: '📋 My Questions' },
            ].map(t => (
              <button key={t.id} className="cb-tab" style={S.tabBtn(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                {t.label}
                {t.id === 'myqueries' && notifCount > 0 && (
                  <span style={{ marginLeft: 4, background: COLORS.danger, color: '#fff', borderRadius: 8, padding: '1px 5px', fontSize: 10 }}>{notifCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Chat */}
          {activeTab === 'chat' && (
            <div style={S.chatArea}>
              {/* Search bar */}
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth="2" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search FAQ, knowledge base..."
                    style={{ width: '100%', padding: '7px 8px 7px 26px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' }} />
                </div>
              </div>

              {/* Search Results or Chat Messages */}
              {searchQuery.trim().length >= 2 ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                  {searching ? (
                    <div style={{ textAlign: 'center', padding: 20, color: COLORS.muted, fontSize: 12 }}>Searching...</div>
                  ) : !searchResults || (searchResults.faqs?.length===0 && searchResults.articles?.length===0 && searchResults.answers?.length===0) ? (
                    <div style={{ textAlign: 'center', padding: 20, color: COLORS.muted, fontSize: 12 }}>
                      No results found. Type your question below to ask our team.
                    </div>
                  ) : (
                    <>
                      {searchResults.faqs?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase' }}>From FAQs</div>
                          {searchResults.faqs.map(f => (
                            <div key={f.id} className="cb-faq-item" onClick={() => useFaqAnswer(f)}
                              style={{ padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 7, marginBottom: 6, cursor: 'pointer', background: '#fff' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 3 }}>{f.question}</div>
                              <div style={{ fontSize: 11, color: COLORS.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.answer}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.articles?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase' }}>Knowledge Base</div>
                          {searchResults.articles.map(a => (
                            <div key={a.id} style={{ padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 7, marginBottom: 6, background: '#f0fdf4' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{a.title}</div>
                              {a.short_description && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{a.short_description}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div style={S.msgList}>
                  {messages.map((m, i) => (
                    <div key={i} style={m.role === 'user' ? { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } : { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={m.role === 'user' ? S.userBubble : { ...S.botBubble, ...(m.error ? { background: '#fff5f5', borderColor: '#fecaca', color: COLORS.danger } : m.queued ? { background: '#fffbeb', borderColor: '#fde68a' } : {}) }}>
                        {m.text}
                        {m.faqId && (
                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #bfdbfe' }}>
                            <button onClick={() => markFaqHelpful(m.faqId)} style={{ fontSize: 11, background: 'none', border: '1px solid #93c5fd', borderRadius: 5, color: '#2563eb', padding: '2px 8px', cursor: 'pointer' }}>
                              👍 Helpful
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="cb-msg-time">{new Date(m.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                  {sending && (
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <div style={{ ...S.botBubble, display: 'flex', gap: 4, alignItems: 'center', padding: '10px 14px' }}>
                        {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.accent, animation: `cbPulse .9s ${i*.15}s infinite ease-in-out`, display: 'inline-block' }}></span>)}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Guest form */}
              {showForm && !userInfo?.id && (
                <div style={{ padding: '10px 12px', background: '#fffbeb', borderTop: `1px solid #fde68a`, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>Please provide your details to submit a question:</div>
                  <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name (optional)"
                    style={{ width: '100%', marginBottom: 6, padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
                  <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="Email address *" type="email"
                    style={{ width: '100%', padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => { if (!guestEmail.trim()) return; setShowForm(false); sendMessage(); }}
                      style={{ flex: 1, padding: '7px', background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Continue
                    </button>
                    <button onClick={() => setShowForm(false)}
                      style={{ padding: '7px 12px', background: '#f3f4f6', color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Input area */}
              <div style={S.inputArea}>
                <textarea
                  className="cb-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={config.placeholder_text || 'Type your question here...'}
                  rows={1}
                />
                <button className="cb-send-btn" onClick={sendMessage} disabled={sending || !input.trim()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Tab: FAQ */}
          {activeTab === 'faq' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Category filter */}
              {categories.length > 0 && (
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedCat('')}
                    style={{ padding: '3px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: !selectedCat ? COLORS.primary : '#f3f4f6', color: !selectedCat ? '#fff' : COLORS.muted }}>
                    All
                  </button>
                  {categories.slice(0, 8).map(c => (
                    <button key={c.id} onClick={() => setSelectedCat(c.id)}
                      style={{ padding: '3px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: selectedCat == c.id ? COLORS.primary : '#f3f4f6', color: selectedCat == c.id ? '#fff' : COLORS.muted }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {faqs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: COLORS.muted, fontSize: 12 }}>No FAQs available yet.</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {faqs.map(f => <FaqItem key={f.id} faq={f} onSelect={() => useFaqAnswer(f)} onHelpful={() => markFaqHelpful(f.id)} />)}
                </div>
              )}
            </div>
          )}

          {/* Tab: My Questions */}
          {activeTab === 'myqueries' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {!userInfo?.id && !guestEmail && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Enter your email to see your submitted questions:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="Your email address" type="email"
                      style={{ flex: 1, padding: '7px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 12 }} />
                    <button onClick={() => setActiveTab('myqueries')}
                      style={{ padding: '7px 12px', background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Go
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications banner */}
              {notifications.length > 0 && (
                <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 4 }}>🎉 {notifications.length} New Answer{notifications.length > 1 ? 's' : ''}</div>
                  {notifications.map(n => (
                    <div key={n.id} style={{ color: '#065f46', marginBottom: 2 }}>• {n.message}</div>
                  ))}
                  <button onClick={() => markNotifRead(notifications.map(n => n.id))}
                    style={{ marginTop: 6, padding: '4px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    Mark All Read
                  </button>
                </div>
              )}

              {myQueries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: COLORS.muted, fontSize: 12 }}>
                  No questions submitted yet.<br />
                  <button onClick={() => setActiveTab('chat')}
                    style={{ marginTop: 8, padding: '6px 14px', background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Ask a Question
                  </button>
                </div>
              ) : (
                myQueries.map(q => (
                  <div key={q.query_ref} className="cb-query-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: 700 }}>{q.query_ref}</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 600,
                        background: (STATUS_LABELS[q.status]?.bg || '#f3f4f6'), color: (STATUS_LABELS[q.status]?.color || COLORS.muted) }}>
                        {STATUS_LABELS[q.status]?.label || q.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{q.question}</div>
                    {q.answer && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#065f46' }}>
                        <strong>Answer:</strong> {q.answer}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 5 }}>
                      Submitted: {new Date(q.created_at).toLocaleDateString('en-IN')}
                      {q.answered_at && ` · Answered: ${new Date(q.answered_at).toLocaleDateString('en-IN')}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FaqItem({ faq, onSelect, onHelpful }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="cb-faq-item" style={{ borderBottom: `1px solid ${COLORS.border}`, transition: 'background .1s' }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.text, lineHeight: 1.4 }}>{faq.question}</div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth="2.5"
          style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 12px', fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>{faq.answer}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onHelpful} style={{ fontSize: 11, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, color: '#2563eb', padding: '3px 9px', cursor: 'pointer', fontWeight: 600 }}>
              👍 Helpful ({faq.helpful_count || 0})
            </button>
            <button onClick={onSelect} style={{ fontSize: 11, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, color: '#059669', padding: '3px 9px', cursor: 'pointer', fontWeight: 600 }}>
              View in Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

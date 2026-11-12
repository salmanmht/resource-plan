/* ============================================================================
 * mep-core.js  —  SHARED CORE for the MEP web tools (Equipment Calculator, Spec)
 * ----------------------------------------------------------------------------
 * PLAIN JAVASCRIPT — NOT JSX. Loaded directly by each app with a normal
 * <script src="mep-core.js"></script> tag, so it runs with NO build step and
 * works the same whether the page is served online OR opened from disk for
 * local testing. Keep it valid JavaScript: write React.createElement(...) here,
 * never <div>…</div> JSX — you edit THIS file directly.
 *
 * Owns everything the apps share: the Supabase connection, the login screen and
 * access/approval flow (AuthScreen, AccessPendingScreen), the team/roles hook
 * (useTeamData), the sign-off widgets, the shared form controls (Field, Sel)
 * and the brand logo. The app sets window.APP_META = { name, tagline } before
 * this script runs. Provides (do not rename): sb, SUPABASE_URL,
 * SUPABASE_ANON_KEY, MEINHARDT_LOGO_SRC, lbl, inp, IN, Field, Sel, AuthScreen,
 * AccessPendingScreen, useTeamData, SignOff, SignedField, UserBadge.
 * ============================================================================ */

const {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect
} = React;
const APP_META = typeof window !== "undefined" && window.APP_META || {
  name: "MEP Tool",
  tagline: "Secure cloud projects"
};

// ── Supabase (same project and user accounts across all apps) ───────────────
const SUPABASE_URL = "https://pjxqfzbignjxatzdlxed.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yKNkvfwVnk35wuOGOZJ0oQ_0cMI-0Ae";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Brand logo (one copy; swap here to change it everywhere) ────────────────
const MEINHARDT_LOGO_SRC = "data:image/png;base64,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";

// ── Shared control styles ───────────────────────────────────────────────────
const lbl = {
  fontSize: 9,
  fontWeight: 700,
  color: "#86868b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 3
};
const inp = {
  border: "1px solid #d2d2d7",
  borderRadius: 6,
  padding: "5px 9px",
  fontSize: 12.5,
  color: "#1d1d1f",
  background: "white",
  width: "100%",
  outline: "none",
  transition: "border-color 0.15s"
};
const IN = {
  width: '100%',
  minWidth: 0,
  padding: '5px 7px',
  border: '1px solid #d2d2d7',
  borderRadius: 6,
  fontSize: 11,
  fontFamily: 'inherit'
};

// ── Shared form controls ────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
  note
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    min: min,
    step: step,
    onChange: e => onChange(e.target.value),
    style: inp,
    onFocus: e => e.target.style.borderColor = "#007aff",
    onBlur: e => e.target.style.borderColor = "#d2d2d7"
  }), note && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: "#86868b",
      fontStyle: "italic",
      marginTop: 3
    }
  }, note));
}
function Sel({
  label,
  value,
  onChange,
  options
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lbl
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      ...inp,
      cursor: "pointer"
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))));
}

// ── Login screen ────────────────────────────────────────────────────────────
function AuthScreen({
  onAuthed
}) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const submit = async e => {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        const {
          error
        } = await sb.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      } else {
        const {
          data,
          error
        } = await sb.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        const normalizedEmail = email.trim().toLowerCase();
        if (data && data.session) {
          const {
            data: roster
          } = await sb.from('engineers').select('id,active').eq('email', normalizedEmail).maybeSingle();
          if (!roster || roster.active === false) {
            const {
              error: requestError
            } = await sb.from('pending_users').upsert({
              email: normalizedEmail,
              status: 'pending',
              requested_at: new Date().toISOString()
            }, {
              onConflict: 'email',
              ignoreDuplicates: true
            });
            if (requestError) throw requestError;
          }
          setInfo("Account created and your access request is pending administrator approval.");
        } else {
          setInfo("Account created. Check your inbox to confirm your email, then sign in to submit or view your access request.");
        }
      }
    } catch (e2) {
      setErr(e2.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#f5f5f7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      width: 480,
      height: 480,
      borderRadius: "50%",
      background: "radial-gradient(circle,rgba(0,122,255,.08) 0%,transparent 70%)",
      top: -140,
      right: -60,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      width: 360,
      height: 360,
      borderRadius: "50%",
      background: "radial-gradient(circle,rgba(52,199,89,.07) 0%,transparent 70%)",
      bottom: -80,
      left: -80,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      width: "min(400px,94vw)",
      background: "#fff",
      borderRadius: 20,
      padding: "40px 36px 32px",
      textAlign: "center",
      boxShadow: "0 2px 4px rgba(0,0,0,.04),0 12px 40px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: MEINHARDT_LOGO_SRC,
    alt: "Meinhardt",
    style: {
      display: "block",
      width: 176,
      height: "auto",
      margin: "0 auto 16px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      margin: "0 auto 20px",
      background: "linear-gradient(160deg,#007aff 0%,#0055d4 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 16px rgba(0,122,255,.3)",
      color: "white",
      fontSize: 23
    }
  }, "\u25A5"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: "#1d1d1f",
      marginBottom: 5,
      letterSpacing: "-.03em"
    }
  }, APP_META.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#6e6e73",
      marginBottom: 28
    }
  }, "Sign in to continue"), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    autoComplete: "email",
    placeholder: "Email address",
    value: email,
    onChange: e => setEmail(e.target.value),
    style: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #d2d2d7",
      borderRadius: 10,
      fontSize: 12,
      color: "#1d1d1f",
      background: "#fff",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    autoComplete: mode === "login" ? "current-password" : "new-password",
    placeholder: "Password",
    value: password,
    onChange: e => setPassword(e.target.value),
    style: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #d2d2d7",
      borderRadius: 10,
      fontSize: 12,
      color: "#1d1d1f",
      background: "#fff",
      outline: "none"
    }
  }), err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#ff3b30",
      background: "#fff0ee",
      padding: "8px 10px",
      borderRadius: 8
    }
  }, err), info && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#16803a",
      background: "#e8faf0",
      padding: "8px 10px",
      borderRadius: 8
    }
  }, info), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: busy,
    style: {
      marginTop: 2,
      padding: "10px 0",
      background: "#007aff",
      color: "white",
      border: "none",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      cursor: busy ? "default" : "pointer",
      opacity: busy ? 0.6 : 1
    }
  }, busy ? "Please wait…" : mode === "login" ? "Sign In" : "Request Access")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      textAlign: "center",
      fontSize: 11,
      color: "#86868b"
    }
  }, mode === "login" ? /*#__PURE__*/React.createElement(React.Fragment, null, "Don\u2019t have an account? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setMode("signup");
      setErr("");
      setInfo("");
    },
    style: {
      color: "#007aff",
      fontWeight: 600,
      textDecoration: "underline"
    }
  }, "Request Access")) : /*#__PURE__*/React.createElement(React.Fragment, null, "Already have an account? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setMode("login");
      setErr("");
      setInfo("");
    },
    style: {
      color: "#007aff",
      fontWeight: 600,
      textDecoration: "underline"
    }
  }, "Sign In"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26,
      fontSize: 9,
      color: "#86868b",
      lineHeight: 1.6
    }
  }, APP_META.name, " \xB7 ", APP_META.tagline, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
      letterSpacing: ".02em"
    }
  }, BUILD_LABEL))));
}

// ── Access request / pending-approval screen ────────────────────────────────
function AccessPendingScreen({
  session,
  reload
}) {
  const email = (session && session.user && session.user.email || '').toLowerCase();
  const [state, setState] = React.useState('loading');
  const [message, setMessage] = React.useState('Checking access request…');
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const {
          data,
          error
        } = await sb.from('pending_users').select('id,status,requested_at,note').eq('email', email).maybeSingle();
        if (!alive) return;
        if (error) throw error;
        if (data) {
          setState(data.status || 'pending');
          setMessage(data.status === 'rejected' ? data.note || 'Your access request was not approved. Contact an administrator.' : 'Your access request is awaiting review by an administrator.');
          return;
        }
        const {
          error: insertError
        } = await sb.from('pending_users').insert({
          email,
          status: 'pending',
          requested_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
        if (alive) {
          setState('pending');
          setMessage('Your access request has been submitted. An administrator can approve it from Team & Access.');
        }
      } catch (e) {
        if (alive) {
          setState('error');
          setMessage('Access could not be checked or requested: ' + (e.message || e));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [email]);
  const blocked = state === 'rejected' || state === 'error';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: '#f5f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'min(520px,94vw)',
      background: '#fff',
      border: '1px solid #d2d2d7',
      borderRadius: 18,
      padding: '34px 36px',
      boxShadow: '0 12px 40px rgba(0,0,0,.08)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      margin: '0 auto 18px',
      background: blocked ? '#fff0ee' : '#e8faf0',
      color: blocked ? '#c2410c' : '#16803a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 23,
      fontWeight: 800
    }
  }, blocked ? '!' : '✓'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: '#86868b',
      marginBottom: 8
    }
  }, APP_META.name, " access"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 22,
      letterSpacing: '-.03em',
      margin: '0 0 10px',
      color: '#1d1d1f'
    }
  }, state === 'loading' ? 'Checking access…' : state === 'rejected' ? 'Access not approved' : 'Access request pending'), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      lineHeight: 1.6,
      color: '#6e6e73',
      margin: '0 auto 18px',
      maxWidth: 390
    }
  }, message), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#86868b',
      background: '#f5f5f7',
      borderRadius: 8,
      padding: '9px 12px',
      marginBottom: 18,
      overflowWrap: 'anywhere'
    }
  }, email), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: reload,
    style: {
      padding: '8px 14px',
      border: '1px solid #d2d2d7',
      background: '#fff',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Check again"), /*#__PURE__*/React.createElement("button", {
    onClick: () => sb.auth.signOut(),
    style: {
      padding: '8px 14px',
      border: 'none',
      background: '#1d1d1f',
      color: '#fff',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Sign out"))));
}

// ── Team, roles & sign-off (shared access strategy) ─────────────────────────
function useTeamData(session) {
  const email = (session && session.user && session.user.email || '').toLowerCase();
  const [team, setTeam] = React.useState([]);
  const [roles, setRoles] = React.useState([]);
  const [ready, setReady] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const load = React.useCallback(async quiet => {
    if (quiet !== true) setReady(false);
    const [teamRes, roleRes, pendingRes] = await Promise.all([sb.from('engineers').select('*').order('name'), sb.from('engineer_roles').select('id,email,role,scope,active,created_at').order('email'), sb.from('pending_users').select('id', {
      count: 'exact',
      head: true
    }).eq('status', 'pending')]);
    setTeam(teamRes.data || []);
    setRoles(roleRes.data || []);
    setPendingCount(pendingRes.count || 0);
    setReady(true);
  }, []);
  React.useEffect(() => {
    if (session) load();else {
      setTeam([]);
      setRoles([]);
      setReady(false);
    }
  }, [load, session]);
  const me = team.find(t => (t.email || '').toLowerCase() === email) || null;
  const isAdmin = !!(me && me.active !== false && (me.is_admin || roles.some(r => r.active !== false && r.role === 'admin' && (r.email || '').toLowerCase() === email)));
  return {
    team,
    roles,
    me,
    isAdmin,
    ready,
    pendingCount,
    reload: load
  };
}
function SignOff({
  label,
  who,
  when,
  onWho,
  onWhen,
  team,
  placeholderWho
}) {
  const active = team.filter(t => t.active !== false && t.initials);
  const known = !who || active.some(t => t.initials === who);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      fontSize: 10,
      fontWeight: 700,
      color: "#86868b",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: 5
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, known ? /*#__PURE__*/React.createElement("select", {
    value: who || "",
    onChange: e => onWho(e.target.value),
    style: {
      flex: 1,
      minWidth: 0,
      padding: "7px 8px",
      border: "1px solid #d2d2d7",
      borderRadius: 8,
      fontSize: 12,
      background: "#fff",
      fontFamily: "inherit"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholderWho || "—"), active.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.initials
  }, t.name, " (", t.initials, ")"))) : /*#__PURE__*/React.createElement("input", {
    value: who || "",
    onChange: e => onWho(e.target.value),
    title: "Not on the current team list",
    style: {
      flex: 1,
      minWidth: 0,
      padding: "7px 8px",
      border: "1px solid #f0a500",
      borderRadius: 8,
      fontSize: 12,
      fontFamily: "inherit"
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: when || "",
    onChange: e => onWhen(e.target.value),
    style: {
      width: 130,
      padding: "7px 8px",
      border: "1px solid #d2d2d7",
      borderRadius: 8,
      fontSize: 12,
      fontFamily: "inherit"
    }
  })));
}
function SignedField({
  label,
  who,
  when,
  team,
  pending
}) {
  const t = (team || []).find(x => (x.initials || '').toUpperCase() === String(who || '').toUpperCase());
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      fontSize: 10,
      fontWeight: 700,
      color: "#86868b",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: 5
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "signed-box" + (who ? " on" : "")
  }, who ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, t ? `${t.name} (${t.initials})` : who), /*#__PURE__*/React.createElement("span", null, fmtDay(when), " \uD83D\uDD12")) : /*#__PURE__*/React.createElement("em", null, pending)));
}
function UserBadge({
  session,
  me,
  roles
}) {
  const email = session && session.user && session.user.email || "";
  const eng = me;
  const derived = email ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—";
  const name = eng && eng.name || derived;
  const desig = eng && eng.desig || "Meinhardt Group";
  // v1.18.2 · show the sign-off level (Engineer / Checker / Approver) and Admin
  const mine = (roles || []).filter(r => r.active !== false && String(r.email || '').toLowerCase() === email.toLowerCase()).map(r => r.role);
  const admin = !!(eng && eng.is_admin) || mine.includes('admin');
  const level = mine.includes('associate') ? 'Approver' : mine.includes('lead') ? 'Checker' : mine.includes('engineer') ? 'Engineer' : roles ? 'View only' : '';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      minWidth: 0
    },
    title: email
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 9,
      flexShrink: 0,
      background: "linear-gradient(135deg,#007aff,#5856d6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,122,255,.2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "#fff"
    }
  }, name.charAt(0).toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "#1d1d1f",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      letterSpacing: "-.02em"
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: "#8e8e93",
      lineHeight: 1.3
    }
  }, desig), level && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 8,
      fontWeight: 700,
      padding: "1px 5px",
      borderRadius: 6,
      background: level === 'Approver' ? "rgba(52,199,89,.14)" : level === 'Checker' ? "rgba(255,149,0,.14)" : "rgba(0,122,255,.1)",
      color: level === 'Approver' ? "#16803a" : level === 'Checker' ? "#a76200" : "#007aff"
    }
  }, level), (admin || !level) && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 8,
      fontWeight: 700,
      padding: "1px 5px",
      borderRadius: 6,
      background: "rgba(88,86,214,.12)",
      color: "#5856d6"
    }
  }, admin ? "Admin" : "Team"))));
}

window.__MEP_CORE_READY = true;

const { useState, useEffect, useCallback } = React;

// ─── Constants ────────────────────────────────────────────────────────────────

const CASE_TYPES = [
  'Grievance', 'Disciplinary', 'Bullying & Harassment', 'Whistleblowing',
  'Discrimination', 'Absence & Capability', 'AWOL', 'Counter-Allegation',
  'Complex / Multi-Party'
];

const EVIDENCE_TYPES = [
  'Email correspondence', 'CCTV footage', 'HR records', 'Payroll records',
  'Attendance records', 'Witness statements', 'Medical evidence',
  'IT records / logs', 'Physical documents', 'Audio / video recordings'
];

const DOCUMENT_TYPES = [
  'Investigation Plan', 'Invitation Letter', 'Interview Framework',
  'Witness Statement', 'Evidence Log', 'Case Chronology',
  'Investigation Report', 'Case Summary', 'Outcome Letter A', 'Outcome Letter B'
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function timelineBadge(status) {
  const map = {
    'On Track': 'bg-green-100 text-green-800',
    'At Risk':  'bg-amber-100 text-amber-800',
    'Overdue':  'bg-red-100 text-red-800',
    'Extended': 'bg-blue-100 text-blue-800',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}

function escalationBadge(level) {
  const map = {
    'Mandatory': 'bg-red-100 text-red-800 border border-red-300',
    'Advisory':  'bg-amber-100 text-amber-800 border border-amber-300',
    'None':      'bg-green-100 text-green-800',
  };
  return map[level] || 'bg-gray-100 text-gray-700';
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

/**
 * Polls GET /api/jobs/:id every 2 seconds until the job completes or fails.
 * Resolves with the job result on success.
 * Rejects with an Error on failure.
 * @param {string} jobId
 * @param {Function} [onTick] - called each poll with the current status object
 */
async function pollJob(jobId, onTick) {
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await api('GET', `/api/jobs/${jobId}`);
    if (onTick) onTick(s);
    if (s.status === 'completed') return s.result;
    if (s.status === 'failed')    throw new Error(s.error || 'Job failed');
  }
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      {label && <p className="text-gray-500 text-sm">{label}</p>}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ view, setView }) {
  const [unread, setUnread] = useState(0);

  // Poll unread count every 30 s and on mount
  useEffect(() => {
    const load = () => api('GET', '/api/notifications?state=unread')
      .then(d => setUnread(d.unread_count || 0))
      .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const links = [
    { key: 'dashboard',      label: 'Dashboard' },
    { key: 'new-case',       label: '+ New Case' },
    { key: 'notifications',  label: null }, // rendered separately as bell
    { key: 'help',           label: 'How to Use' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
      <span className="font-bold text-blue-700 text-lg mr-4">ER Investigation Platform</span>
      {[{ key: 'dashboard', label: 'Dashboard' }, { key: 'new-case', label: '+ New Case' }, { key: 'help', label: 'How to Use' }].map(l => (
        <button
          key={l.key}
          onClick={() => setView({ name: l.key })}
          className={`text-sm font-medium px-3 py-1 rounded transition ${
            view.name === l.key
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          {l.label}
        </button>
      ))}
      {/* Notifications bell */}
      <button
        onClick={() => setView({ name: 'notifications' })}
        className={`relative ml-auto text-sm font-medium px-3 py-1 rounded transition ${
          view.name === 'notifications' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600'
        }`}
        title="Notifications"
      >
        <span>🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </nav>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ setView }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('GET', '/api/tracker/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (!data)   return <p className="p-6 text-red-600">Could not load dashboard.</p>;

  const stats = [
    { label: 'Total Active', value: data.total,    color: 'text-blue-600' },
    { label: 'On Track',     value: data.on_track,  color: 'text-green-600' },
    { label: 'At Risk',      value: data.at_risk,   color: 'text-amber-600' },
    { label: 'Overdue',      value: data.overdue,   color: 'text-red-600' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Active Cases</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cases table */}
      {data.cases.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          No active cases. Click <strong>+ New Case</strong> to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Case Ref', 'Type', 'Complexity', 'Phase', 'Status', 'Next Action', 'Due', 'Timeline'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cases.map((c, i) => (
                <tr
                  key={c.case_reference}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  onClick={() => setView({ name: 'case-view', caseRef: c.case_reference, caseData: c })}
                >
                  <td className="px-4 py-3 font-mono text-blue-700 font-medium">{c.case_reference}</td>
                  <td className="px-4 py-3">{c.case_type}</td>
                  <td className="px-4 py-3">{c.complexity}</td>
                  <td className="px-4 py-3">Phase {c.phase}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{c.next_action}</td>
                  <td className="px-4 py-3 text-gray-600">{c.target_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${timelineBadge(c.timeline_status)}`}>
                      {c.timeline_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── New Case Form ────────────────────────────────────────────────────────────

function NewCaseForm({ setView }) {
  const [form, setForm] = useState({
    case_type:           'Grievance',
    complainant_name:    '',
    complainant_role:    '',
    respondent_name:     '',
    respondent_role:     '',
    allegations:         [''],
    witnesses:           [],
    incident_period:     '',
    referring_party:     '',
    policies_applicable: [''],
    evidence_types:      [],
    legal_involved:      false,
    conflict_of_interest: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const addRow    = key => set(key, [...form[key], '']);
  const removeRow = (key, idx) => set(key, form[key].filter((_, i) => i !== idx));
  const updateRow = (key, idx, val) => set(key, form[key].map((v, i) => i === idx ? val : v));

  const addWitness    = () => set('witnesses', [...form.witnesses, { name: '', role: '' }]);
  const removeWitness = idx => set('witnesses', form.witnesses.filter((_, i) => i !== idx));
  const updateWitness = (idx, field, val) => set('witnesses', form.witnesses.map((w, i) => i === idx ? { ...w, [field]: val } : w));

  const toggleEvidence = type => {
    const ev = form.evidence_types.includes(type)
      ? form.evidence_types.filter(t => t !== type)
      : [...form.evidence_types, type];
    set('evidence_types', ev);
  };

  const handleSubmit = async () => {
    if (form.conflict_of_interest) {
      setError('⚠ Conflict of interest flagged. Case submission blocked. Please reassign the investigator before proceeding.');
      return;
    }

    const allegations = form.allegations.filter(a => a.trim());
    if (!allegations.length) { setError('At least one allegation is required.'); return; }
    if (!form.complainant_role.trim()) { setError('Complainant role is required.'); return; }
    if (!form.respondent_role.trim())  { setError('Respondent role is required.'); return; }
    if (!form.incident_period.trim())  { setError('Incident period is required.'); return; }
    if (!form.referring_party.trim())  { setError('Referring party is required.'); return; }

    setError(null);
    setSubmitting(true);

    try {
      // Enqueue the case intake job — returns immediately with { job_id }
      const { job_id } = await api('POST', '/api/cases', {
        case_type:           form.case_type,
        complainant_name:    form.complainant_name,
        complainant_role:    form.complainant_role,
        respondent_name:     form.respondent_name,
        respondent_role:     form.respondent_role,
        allegations,
        witnesses:           form.witnesses.filter(w => w.role.trim()),
        incident_period:     form.incident_period,
        referring_party:     form.referring_party,
        policies_applicable: form.policies_applicable.filter(p => p.trim()),
        evidence_types:      form.evidence_types,
        legal_involved:      form.legal_involved,
      });

      // Poll until the job completes
      const result = await pollJob(job_id);

      if (result && result.status === 'CASE_OPENED') {
        setView({ name: 'case-view', caseRef: result.case_reference, caseData: result });
      } else {
        setError((result && result.message) || JSON.stringify(result));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) return <Spinner label="Opening case — running Coordinator Agent, Intake Agent, and Case Management Agent..." />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Case</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded text-red-700 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Conflict of Interest */}
      <section className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-amber-800 mb-2">Conflict of Interest Check</h2>
        <p className="text-sm text-amber-700 mb-3">
          Before proceeding, confirm the assigned investigator has no conflict of interest with any party.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.conflict_of_interest}
            onChange={e => set('conflict_of_interest', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-amber-800 font-medium">
            A conflict of interest exists — DO NOT PROCEED (reassign investigator first)
          </span>
        </label>
      </section>

      {/* Case Type */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Case Type *</label>
        <select
          value={form.case_type}
          onChange={e => set('case_type', e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </section>

      {/* Parties */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Parties</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Complainant Name (stays local)</label>
            <input type="text" value={form.complainant_name} onChange={e => set('complainant_name', e.target.value)}
              placeholder="Full name" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Complainant Role *</label>
            <input type="text" value={form.complainant_role} onChange={e => set('complainant_role', e.target.value)}
              placeholder="e.g. Senior Manager, Finance" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Respondent Name (stays local)</label>
            <input type="text" value={form.respondent_name} onChange={e => set('respondent_name', e.target.value)}
              placeholder="Full name" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Respondent Role *</label>
            <input type="text" value={form.respondent_role} onChange={e => set('respondent_role', e.target.value)}
              placeholder="e.g. Team Leader, Operations" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* Allegations */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Allegations *</h2>
        {form.allegations.map((a, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text" value={a}
              onChange={e => updateRow('allegations', i, e.target.value)}
              placeholder={`Allegation ${i + 1}`}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            {form.allegations.length > 1 && (
              <button onClick={() => removeRow('allegations', i)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded text-sm">✕</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow('allegations')}
          className="text-sm text-blue-600 hover:underline mt-1">+ Add allegation</button>
      </section>

      {/* Witnesses */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Witnesses</h2>
        {form.witnesses.map((w, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input type="text" value={w.name} onChange={e => updateWitness(i, 'name', e.target.value)}
              placeholder="Witness name (stays local)" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
            <input type="text" value={w.role} onChange={e => updateWitness(i, 'role', e.target.value)}
              placeholder="Role" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
            <button onClick={() => removeWitness(i)}
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded text-sm">✕</button>
          </div>
        ))}
        <button onClick={addWitness}
          className="text-sm text-blue-600 hover:underline mt-1">+ Add witness</button>
      </section>

      {/* Case Details */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Case Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Incident Period *</label>
            <input type="text" value={form.incident_period} onChange={e => set('incident_period', e.target.value)}
              placeholder="e.g. October–December 2025" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referring Party *</label>
            <input type="text" value={form.referring_party} onChange={e => set('referring_party', e.target.value)}
              placeholder="e.g. HRBP, Line Manager, Hotline" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Applicable Policies</h2>
        {form.policies_applicable.map((p, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input type="text" value={p}
              onChange={e => updateRow('policies_applicable', i, e.target.value)}
              placeholder={`Policy ${i + 1}`}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
            {form.policies_applicable.length > 1 && (
              <button onClick={() => removeRow('policies_applicable', i)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded text-sm">✕</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow('policies_applicable')}
          className="text-sm text-blue-600 hover:underline mt-1">+ Add policy</button>
      </section>

      {/* Evidence Types */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Evidence Types Available</h2>
        <div className="grid grid-cols-2 gap-2">
          {EVIDENCE_TYPES.map(type => (
            <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.evidence_types.includes(type)}
                onChange={() => toggleEvidence(type)} className="w-4 h-4" />
              {type}
            </label>
          ))}
        </div>
      </section>

      {/* Toggles */}
      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Additional Information</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => set('legal_involved', !form.legal_involved)}
            className={`w-11 h-6 rounded-full transition-colors ${form.legal_involved ? 'bg-blue-600' : 'bg-gray-300'} relative cursor-pointer`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.legal_involved ? 'translate-x-6' : 'translate-x-1'}`}></div>
          </div>
          <span className="text-sm text-gray-700">Legal already involved</span>
        </label>
      </section>

      <button
        onClick={handleSubmit}
        disabled={form.conflict_of_interest}
        className={`w-full py-3 rounded-lg font-semibold text-white transition ${
          form.conflict_of_interest
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {form.conflict_of_interest ? 'Blocked — Conflict of Interest Flagged' : 'Open Case'}
      </button>
    </div>
  );
}

// ─── Case View ────────────────────────────────────────────────────────────────

function CaseView({ caseRef, initialData, setView }) {
  const [caseData, setCaseData]       = useState(initialData);
  const [fullCaseData, setFullCaseData] = useState(null);
  const [log, setLog]                 = useState([]);
  const [generating, setGenerating]   = useState(null);
  const [generated, setGenerated]     = useState(null);
  const [activeTab, setActiveTab]     = useState('documents');
  const [elapsed, setElapsed]         = useState(0);
  const [lastDuration, setLastDuration] = useState({ doc: null, seconds: null });
  const timerRef    = React.useRef(null);
  const startTimeRef = React.useRef(null);

  const phases = [
    { num: 1, name: 'Case Opening',  docs: ['Investigation Plan', 'Invitation Letter'] },
    { num: 2, name: 'Investigation', docs: ['Interview Framework', 'Evidence Log', 'Case Chronology', 'Witness Statement'] },
    { num: 3, name: 'Reporting',     docs: ['Investigation Report', 'Case Summary'] },
    { num: 4, name: 'Outcome',       docs: ['Outcome Letter A', 'Outcome Letter B'] },
  ];

  const loadLog = useCallback(async () => {
    const l = await api('GET', `/api/cases/${caseRef}/log`);
    if (Array.isArray(l)) setLog(l);
  }, [caseRef]);

  const loadFullData = useCallback(async () => {
    try {
      const d = await api('GET', `/api/cases/${caseRef}/data`);
      if (d && !d.status) setFullCaseData(d);
    } catch (_) {}
  }, [caseRef]);

  useEffect(() => { loadLog(); loadFullData(); }, [loadLog, loadFullData]);

  const generateDoc = async (docType) => {
    setGenerating(docType);
    setElapsed(0);
    setLastDuration({ doc: null, seconds: null });
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    try {
      // Use persisted anonymised case data if available, otherwise fall back to initialData
      const src = fullCaseData || caseData;
      const anonymisedCase = {
        case_reference:      caseRef,
        case_type:           src.case_type || (src.classification && src.classification.case_type_confirmed) || 'Grievance',
        complexity:          src.complexity || (src.classification && src.classification.complexity_level) || 'Medium',
        allegations:         src.allegations || [],
        allegation_count:    (src.allegations || []).length,
        complainant_role:    src.complainant_role || '',
        respondent_role:     src.respondent_role  || '',
        incident_period:     src.incident_period  || '',
        policies_applicable: src.policies_applicable || [],
        evidence_types:      src.evidence_types   || [],
        legal_involved:      src.legal_involved   || false,
        escalation_level:    src.escalation_level || 'None',
        escalation_required: (src.escalation_level || 'None') !== 'None',
        witness_count:       (src.witnesses || []).length,
        witness_roles:       (src.witnesses || []).map(w => w.role || ''),
      };

      // Enqueue document generation job — returns immediately with { job_id }
      const { job_id } = await api('POST', '/api/documents/generate', { anonymisedCase, documentType: docType });
      // Poll until the job completes
      const result = await pollJob(job_id);
      setGenerated({ ...result, caseRef });
      await loadLog();
    } finally {
      clearInterval(timerRef.current);
      setLastDuration({ doc: docType, seconds: Math.floor((Date.now() - startTimeRef.current) / 1000) });
      setGenerating(null);
    }
  };

  const currentPhase = caseData.phase || (caseData.classification ? 1 : 1);
  const escalation   = caseData.escalation_level || (caseData.classification && caseData.classification.escalation_level) || 'None';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold font-mono text-blue-700">{caseRef}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${escalationBadge(escalation)}`}>
              {escalation === 'None' ? 'No Escalation' : `${escalation} Escalation`}
            </span>
          </div>
          <p className="text-gray-600 text-sm">
            {caseData.case_type || caseData.classification?.case_type_confirmed} ·{' '}
            {caseData.complexity || caseData.classification?.complexity_level} ·{' '}
            Status: {caseData.status || 'Open'}
          </p>
        </div>
        <button onClick={() => setView({ name: 'dashboard' })}
          className="text-sm text-gray-500 hover:text-blue-600">← Back to Dashboard</button>
      </div>

      {/* Escalation Banner */}
      {escalation !== 'None' && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${escalation === 'Mandatory' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
          <strong>⚠ {escalation} Escalation:</strong>{' '}
          {(caseData.escalation_reasons || []).join(', ') || 'See case details for reasons.'}
        </div>
      )}

      {/* Phase Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Investigation Progress</h2>
        <div className="flex gap-2">
          {phases.map(p => (
            <div key={p.num} className="flex-1">
              <div className={`h-2 rounded-full mb-1 ${p.num <= currentPhase ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
              <p className={`text-xs text-center ${p.num <= currentPhase ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                Phase {p.num}
              </p>
              <p className={`text-xs text-center ${p.num <= currentPhase ? 'text-blue-600' : 'text-gray-400'}`}>
                {p.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[['documents', 'Documents'], ['log', 'Case Log']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'documents' && (
        <div>
          {/* Intake summary */}
          {caseData.intake_result?.letters_draft && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
              <strong className="text-blue-800">Intake Complete:</strong>{' '}
              <span className="text-blue-700">Acknowledgement letters drafted. Review and approve before sending.</span>
              <button
                onClick={() => setGenerated({
                  draft_text:    caseData.intake_result.letters_draft,
                  document_type: 'Acknowledgement Letters',
                  caseRef,
                  file_name:     caseData.intake_result.letters_file,
                  quality_review: null,
                  status: 'Draft — awaiting consultant review'
                })}
                className="ml-3 text-blue-600 hover:underline text-xs"
              >
                View →
              </button>
            </div>
          )}

          {/* Phase document buttons */}
          {phases.map(phase => (
            <div key={phase.num} className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Phase {phase.num} — {phase.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {phase.docs.map(doc => (
                  <button
                    key={doc}
                    onClick={() => generateDoc(doc)}
                    disabled={!!generating}
                    className={`px-3 py-2 rounded border text-sm text-left transition ${
                      generating === doc
                        ? 'bg-blue-50 border-blue-300 text-blue-600'
                        : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
                    }`}
                  >
                    {generating === doc ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                        <span>Generating... <span className="font-mono">{elapsed}s</span></span>
                      </span>
                    ) : (
                      <span>
                        Generate {doc}
                        {lastDuration.doc === doc && lastDuration.seconds !== null && (
                          <span className="block text-xs text-gray-400 font-normal mt-0.5">Generated in {lastDuration.seconds}s</span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'log' && <CaseLog log={log} caseRef={caseRef} onNote={loadLog} />}

      {/* Document Viewer modal */}
      {generated && (
        <DocumentViewer
          data={generated}
          onClose={() => setGenerated(null)}
          onApproved={() => { setGenerated(null); loadLog(); }}
        />
      )}
    </div>
  );
}

// ─── Quality Review Panel (structured JSON) ───────────────────────────────────

function QualityReviewPanel({ qr }) {
  if (!qr) return null;

  // Handle QUALITY_PARSE_ERROR (error object, not a full JSON review)
  if (qr.error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
        <p className="font-semibold text-red-800 mb-1">Quality Review Error</p>
        <p className="text-red-700 text-xs">{qr.error}</p>
      </div>
    );
  }

  const qj = qr.quality_json || qr;
  const result = qr.overall_result || qj.overall_result || 'UNKNOWN';
  const score  = qr.overall_score  ?? qj.overall_score  ?? 0;

  const resultColor = {
    PASS:                         'bg-green-50 border-green-200',
    PASS_WITH_MANDATORY_CORRECTIONS: 'bg-amber-50 border-amber-200',
    FAIL:                         'bg-red-50 border-red-200',
    AUTOMATIC_FAIL:               'bg-red-50 border-red-300',
  }[result] || 'bg-gray-50 border-gray-200';

  const badgeColor = {
    PASS:                         'bg-green-200 text-green-800',
    PASS_WITH_MANDATORY_CORRECTIONS: 'bg-amber-200 text-amber-800',
    FAIL:                         'bg-red-200 text-red-800',
    AUTOMATIC_FAIL:               'bg-red-300 text-red-900',
  }[result] || 'bg-gray-200 text-gray-700';

  const stages     = qj.stages || {};
  const mandatory  = qj.mandatory_corrections  || [];
  const advisory   = qj.advisory_improvements  || [];
  const escalation = qj.escalation_flags       || [];

  return (
    <div className={`rounded-lg border p-4 text-sm ${resultColor}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <strong>Quality Review:</strong>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
          {result.replace(/_/g, ' ')}
        </span>
        <span className="text-gray-600">Score: {score}/100</span>
      </div>

      {/* Stage scores */}
      {Object.keys(stages).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-3 text-xs">
          {Object.entries(stages).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full inline-block ${val.passed ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="font-medium">{val.score !== undefined ? `${val.score}/100` : (val.passed ? 'PASS' : 'FAIL')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {qj.summary && (
        <p className="text-gray-700 mb-3 italic text-xs">{qj.summary}</p>
      )}

      {/* Mandatory corrections */}
      {mandatory.length > 0 && (
        <div className="mb-3">
          <p className="font-semibold text-red-700 mb-1 text-xs">Mandatory Corrections ({mandatory.length})</p>
          <div className="space-y-1">
            {mandatory.map((mc, i) => (
              <div key={i} className="bg-red-100 rounded p-2 text-xs">
                <span className="font-mono font-bold mr-1">{mc.id}</span>
                <span className="text-red-800">{mc.issue}</span>
                {mc.location && <span className="text-red-600 ml-1">({mc.location})</span>}
                {mc.required_action && (
                  <p className="text-red-700 mt-0.5">→ {mc.required_action}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advisory improvements */}
      {advisory.length > 0 && (
        <div className="mb-3">
          <p className="font-semibold text-amber-700 mb-1 text-xs">Advisory Improvements ({advisory.length})</p>
          <div className="space-y-1">
            {advisory.map((ai, i) => (
              <div key={i} className="bg-amber-100 rounded p-2 text-xs">
                <span className="font-mono font-bold mr-1">{ai.id}</span>
                <span className="text-amber-800">{ai.observation}</span>
                {ai.suggestion && <p className="text-amber-700 mt-0.5">→ {ai.suggestion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalation flags */}
      {escalation.length > 0 && (
        <div>
          <p className="font-semibold text-red-700 mb-1 text-xs">Escalation Flags</p>
          {escalation.map((f, i) => (
            <p key={i} className="text-xs text-red-700">⚠ {f}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Document Viewer ──────────────────────────────────────────────────────────

function DocumentViewer({ data, onClose, onApproved }) {
  const [approving, setApproving] = useState(false);
  const [approved,  setApproved]  = useState(null);
  const [error,     setError]     = useState(null);

  const isValidationFailed = data.status === 'VALIDATION_FAILED';

  const approve = async (override = false) => {
    setApproving(true);
    setError(null);
    try {
      const result = await api('POST', '/api/documents/approve', {
        caseReference: data.caseRef,
        documentType:  data.document_type,
        draftText:     data.draft_text,
        document_id:   data.document_id || undefined,
        override,
      });
      setApproved(result);
      if (onApproved) onApproved();
    } catch (e) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-lg">{data.document_type}</h2>
            <p className="text-sm text-gray-500">
              {data.file_name}
              {data.status && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                  data.status === 'VALIDATION_FAILED'  ? 'bg-red-100 text-red-700' :
                  data.status === 'VALIDATION_PASSED'  ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{data.status.replace(/_/g, ' ')}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* VALIDATION_FAILED banner */}
          {isValidationFailed && !approved && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-sm">
              <p className="font-semibold text-red-800 mb-1">Validation Failed — Document Cannot Be Approved Normally</p>
              <p className="text-red-700 text-xs mb-2">
                This document failed deterministic validation checks after 2 generation attempts.
                The document requires investigator review before it can proceed.
              </p>
              {data.validation_failures && data.validation_failures.length > 0 && (
                <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5 mb-2">
                  {data.validation_failures.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              <p className="text-xs text-red-600 font-medium">
                You may override validation and approve manually — this will be recorded in the audit log.
              </p>
            </div>
          )}

          {/* Policy injection summary */}
          {data.policies_injected && data.policies_injected.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <span className="font-semibold">Policies applied: </span>
              {data.policies_injected.map(p => `${p.name} v${p.version}`).join(', ')}
            </div>
          )}
          {data.policies_injected && data.policies_injected.length === 0 && (
            <div className="text-xs text-gray-400 italic">No policy templates injected for this document type.</div>
          )}

          {/* Quality review (structured) */}
          {data.quality_review && (
            <QualityReviewPanel qr={data.quality_review} />
          )}

          {/* Validation failures (non-VALIDATION_FAILED status — passed but had attempt 2) */}
          {!isValidationFailed && data.attempt === 2 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <span className="font-semibold">Note: </span>
              This document passed validation on attempt 2. The first attempt required regeneration.
            </div>
          )}

          {/* Document text */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Document Draft</h3>
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono leading-relaxed">
              {data.draft_text}
            </pre>
          </div>

          {/* Approved result */}
          {approved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-green-800 mb-2">
                {approved.status === 'Approved (override)' ? '⚠ Document Approved (Override)' : '✓ Document Approved'} — FINAL saved
              </p>
              <p className="text-green-700 mb-2">HTML: {approved.file_path}</p>
              <div className="flex gap-3 text-xs">
                {approved.docx_path && (
                  <a
                    href={`/api/documents/download/docx/${data.caseRef}?documentType=${encodeURIComponent(data.document_type)}`}
                    download
                    className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
                  >
                    Download DOCX
                  </a>
                )}
                {approved.pdf_path && (
                  <a
                    href={`/api/documents/download/pdf/${data.caseRef}?documentType=${encodeURIComponent(data.document_type)}`}
                    download
                    className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 font-medium"
                  >
                    Download PDF
                  </a>
                )}
              </div>
              {approved.warning && (
                <p className="text-amber-700 mt-2 text-xs">⚠ {approved.warning}</p>
              )}
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
            Close
          </button>
          {!approved && isValidationFailed && (
            <button
              onClick={() => approve(true)}
              disabled={approving}
              className="px-4 py-2 rounded border border-red-400 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
            >
              {approving ? 'Saving...' : 'Override & Approve'}
            </button>
          )}
          {!approved && !isValidationFailed && (
            <button
              onClick={() => approve(false)}
              disabled={approving}
              className="px-5 py-2 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
            >
              {approving ? 'Approving...' : 'Approve & Save FINAL'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Case Log ─────────────────────────────────────────────────────────────────

function CaseLog({ log, caseRef, onNote }) {
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await api('PATCH', `/api/cases/${caseRef}`, {
      manual_note: note.trim(),
      note_date:   new Date().toISOString()
    });
    setNote('');
    setSaving(false);
    if (onNote) onNote();
  };

  return (
    <div>
      <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
        {log.length === 0 && (
          <p className="text-gray-400 text-sm">No log entries yet.</p>
        )}
        {log.map(entry => (
          <div key={entry.entry_number} className="bg-white border border-gray-100 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">#{entry.entry_number}</span>
              <span className="text-xs text-gray-500">{entry.date} {entry.time}</span>
              <span className="text-xs font-medium text-blue-600">{entry.event_type}</span>
              <span className="text-xs text-gray-500">by {entry.by}</span>
              {entry.status_after && (
                <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {entry.status_after}
                </span>
              )}
            </div>
            <p className="text-gray-700">{entry.details}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveNote()}
          placeholder="Add a manual note..."
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <button
          onClick={saveNote}
          disabled={saving || !note.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Note'}
        </button>
      </div>
    </div>
  );
}

// ─── Help Page ────────────────────────────────────────────────────────────────

function HelpPage() {
  const sections = [
    {
      title: '1. What this platform does',
      content: `This platform helps ER investigators produce first-draft investigation documents faster and more consistently. You enter the case details, the system generates professional drafts using Claude AI, you review and approve them, and real names are merged in locally before saving. Nothing with real names ever leaves your machine.`
    },
    {
      title: '2. Before you start a case',
      steps: [
        'Check for conflicts of interest — if you have a personal or professional relationship with any party, do not proceed. Reassign the case first.',
        'Gather the minimum required information: case type, at least one allegation, complainant and respondent roles, incident period, and referring party.',
        'Real names are optional on the form — they stay on your machine only and are never sent to the AI. Role descriptions (e.g. "Senior Manager, Finance") are used instead.',
      ]
    },
    {
      title: '3. Opening a new case',
      steps: [
        'Click "+ New Case" in the top menu.',
        'Select the case type from the dropdown.',
        'Enter complainant and respondent names (local only) and roles.',
        'Add allegations one by one using the "+ Add allegation" button.',
        'Add witnesses if known — name (local only) and role.',
        'Fill in the incident period, referring party, and applicable policies.',
        'Tick any evidence types already identified.',
        'Toggle "Legal already involved" if legal has been notified.',
        'Click "Open Case" — the system will classify the case, assign a reference number, create the case file structure, and generate acknowledgement letters.',
      ]
    },
    {
      title: '4. Understanding escalation',
      content: `After you submit a case, the Coordinator Agent assesses it for escalation:`,
      items: [
        { label: 'No Escalation', desc: 'Proceed as normal.' },
        { label: 'Advisory Escalation', desc: 'A flag has been raised (e.g. senior leadership involved). You can proceed, but consider whether legal should be consulted.' },
        { label: 'Mandatory Escalation', desc: 'A serious flag is present (e.g. whistleblowing, criminal allegations, protected characteristic). Do not issue outcome documents without consulting legal first.' },
      ]
    },
    {
      title: '5. Generating documents',
      steps: [
        'Open a case from the Dashboard by clicking its row.',
        'In the Case View, use the phase document buttons to generate drafts.',
        'Start with Phase 1: Investigation Plan and Invitation Letters.',
        'Document generation takes 60–90 seconds — this is normal.',
        'The Document Viewer shows the full draft. If a Quality Review was run automatically, it appears above the document.',
        'Read the draft carefully. Apply your professional judgement.',
        'Click "Approve & Save FINAL" when satisfied. Real names are merged at this point.',
        'Any placeholders that still need filling (e.g. [EAP contact], [HRBP]) are listed as warnings after approval.',
      ]
    },
    {
      title: '6. Quality reviews',
      content: `Investigation Reports and Outcome Letters are automatically reviewed by the Quality Agent before you see them. The review runs five checks:`,
      items: [
        { label: 'Stage 1 — Completeness', desc: 'Are all required sections present?' },
        { label: 'Stage 2 — Structure', desc: 'Is the document in the correct order?' },
        { label: 'Stage 3 — Language & Tone', desc: 'Are prohibited terms (certainty language, emotive language, opinion language) absent?' },
        { label: 'Stage 4 — Legal Compliance', desc: 'Does the document meet UK employment law procedural requirements?' },
        { label: 'Stage 5 — Anonymisation', desc: 'Has any real name leaked into the document?' },
      ]
    },
    {
      title: '7. Approving documents',
      steps: [
        'Every document is a first draft — you must read it and apply your professional judgement before approving.',
        'The Quality Report lists Mandatory Corrections (must be resolved) and Advisory Improvements (your discretion).',
        'If you need to edit the document, copy the draft text, make your changes, and paste the edited version back before approving — or approve and edit the saved file directly.',
        'Approved FINAL files are saved in the case folder on your machine.',
        'Remaining placeholders (like [INVESTIGATING OFFICER]) shown after approval are fields the system cannot fill — you must insert these before sending the document.',
      ]
    },
    {
      title: '8. Case file location',
      content: `Case files are saved to the cases/ folder inside this application directory. Each case has its own folder named with the case reference (e.g. ER-2026-0001-GR) containing 10 subfolders for documents, correspondence, evidence, interviews, and the case log. Back this folder up regularly.`
    },
    {
      title: '9. Document placeholders',
      content: `All AI-generated drafts use placeholders instead of real names. Common ones:`,
      items: [
        { label: '[COMPLAINANT]', desc: 'Replaced with complainant name on approval' },
        { label: '[RESPONDENT]', desc: 'Replaced with respondent name on approval' },
        { label: '[WITNESS A], [WITNESS B]', desc: 'Replaced with witness names on approval' },
        { label: '[INVESTIGATING OFFICER]', desc: 'You must fill this in — not collected on the form' },
        { label: '[HRBP]', desc: 'You must fill this in — contact details for the HR Business Partner' },
        { label: '[EAP contact details]', desc: 'You must fill this in — Employee Assistance Programme details' },
        { label: '[ORGANISATION]', desc: 'You must fill this in — client organisation name' },
      ]
    },
    {
      title: '10. Important rules',
      items: [
        { label: 'Never send an AI draft without reading it', desc: 'Every document is a first draft. Your professional judgement is required before anything goes to a client or party.' },
        { label: 'Never skip the conflict of interest check', desc: 'If you have any connection to a party, stop and reassign before proceeding.' },
        { label: 'Outcome language must match case type', desc: 'Grievance outcomes use Upheld / Not Upheld. Disciplinary investigations use Case to Answer / No Case to Answer. These are not interchangeable.' },
        { label: 'Keep case files backed up', desc: 'The cases/ folder contains all your case files. Back it up regularly.' },
        { label: 'Legal must be consulted on mandatory escalations', desc: 'Whistleblowing, discrimination, and criminal allegations require legal involvement before outcome documents are issued.' },
      ]
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">How to Use the ER Investigation Platform</h1>
      <p className="text-gray-500 text-sm mb-8">
        This platform is a tool to support your professional judgement — not replace it. Every document it produces is a first draft. You review, apply your expertise, and approve.
      </p>

      <div className="space-y-6">
        {sections.map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-3">{s.title}</h2>

            {s.content && (
              <p className="text-sm text-gray-700 mb-3">{s.content}</p>
            )}

            {s.steps && (
              <ol className="list-decimal list-inside space-y-2">
                {s.steps.map((step, j) => (
                  <li key={j} className="text-sm text-gray-700">{step}</li>
                ))}
              </ol>
            )}

            {s.items && (
              <div className="space-y-2 mt-2">
                {s.items.map((item, j) => (
                  <div key={j} className="flex gap-2 text-sm">
                    <span className="font-medium text-gray-800 whitespace-nowrap">{item.label} —</span>
                    <span className="text-gray-600">{item.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        ER Investigation Platform MVP · Built for consultant use only · localhost only
      </p>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter,     setFilter]     = useState('unread');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api('GET', `/api/notifications${filter ? `?state=${filter}` : ''}`);
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const generate = async () => {
    setGenerating(true);
    try {
      await api('POST', '/api/notifications/generate');
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const updateState = async (id, state) => {
    await api('PATCH', `/api/notifications/${id}`, { state });
    await load();
  };

  const typeColor = t => t === 'overdue'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-amber-50 border-amber-200 text-amber-800';

  const typeBadge = t => t === 'overdue'
    ? 'bg-red-200 text-red-800'
    : 'bg-amber-200 text-amber-800';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex gap-2">
          <button onClick={generate} disabled={generating}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-60">
            {generating ? 'Checking...' : 'Check Deadlines'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[['unread','Unread'], ['dismissed','Dismissed'], ['resolved','Resolved'], ['','All']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              filter === val ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Unread count banner */}
      {data && data.unread_count > 0 && filter === 'unread' && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 font-medium">
          {data.unread_count} unread notification{data.unread_count !== 1 ? 's' : ''}
        </div>
      )}

      {loading ? <Spinner label="Loading notifications..." /> : (
        <div className="space-y-3">
          {(!data || !data.notifications || data.notifications.length === 0) && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
              {filter === 'unread' ? 'No unread notifications. Click "Check Deadlines" to scan for upcoming or overdue cases.' : 'No notifications found.'}
            </div>
          )}
          {data && data.notifications && data.notifications.map(n => (
            <div key={n.id} className={`rounded-lg border p-4 ${typeColor(n.type)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeBadge(n.type)}`}>
                      {n.type === 'overdue' ? 'OVERDUE' : 'UPCOMING'}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{n.case_reference}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      n.state === 'unread' ? 'bg-blue-100 text-blue-700' :
                      n.state === 'dismissed' ? 'bg-gray-100 text-gray-600' :
                      'bg-green-100 text-green-700'
                    }`}>{n.state}</span>
                  </div>
                  <p className="text-sm font-medium">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                {n.state === 'unread' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => updateState(n.id, 'dismissed')}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-white">
                      Dismiss
                    </button>
                    <button onClick={() => updateState(n.id, 'resolved')}
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                      Resolved
                    </button>
                  </div>
                )}
                {n.state === 'dismissed' && (
                  <button onClick={() => updateState(n.id, 'resolved')}
                    className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 flex-shrink-0">
                    Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

function App() {
  const [view, setView] = useState({ name: 'dashboard' });

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav view={view} setView={setView} />

      <main>
        {view.name === 'dashboard' && (
          <Dashboard setView={setView} />
        )}

        {view.name === 'new-case' && (
          <NewCaseForm setView={setView} />
        )}

        {view.name === 'case-view' && (
          <CaseView
            caseRef={view.caseRef}
            initialData={view.caseData || {}}
            setView={setView}
          />
        )}

        {view.name === 'notifications' && (
          <NotificationsPanel />
        )}

        {view.name === 'help' && (
          <HelpPage />
        )}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

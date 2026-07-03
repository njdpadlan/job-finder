import { useState, useEffect, useCallback } from 'react';
import JobTable from './components/JobTable.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import JobDetail from './components/JobDetail.jsx';
import LogFeed from './components/LogFeed.jsx';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [log, setLog] = useState(null); // null = hidden, { title, lines, status } = shown

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      setJobs(await res.json());
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const runStream = useCallback(async (url, body, title, onDone) => {
    setLog({ title, lines: [], status: 'running' });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let msg;
          try { msg = JSON.parse(part.slice(6).trim()); } catch { continue; }

          if (msg.type === 'done') {
            setLog(prev => ({ ...prev, status: 'done' }));
            onDone?.();
            return;
          }
          if (msg.type === 'error') {
            setLog(prev => ({
              ...prev,
              status: 'error',
              lines: [...prev.lines, `ERROR: ${msg.error}`],
            }));
            return;
          }
          const text = extractText(msg);
          if (text) setLog(prev => ({ ...prev, lines: [...prev.lines, text] }));
        }
      }
    } catch (e) {
      setLog(prev => ({
        ...prev,
        status: 'error',
        lines: [...prev.lines, `ERROR: ${e.message}`],
      }));
    }
  }, []);

  const handleSearch = useCallback((keyword) => {
    runStream('/api/search-jobs', { keyword }, 'Searching for jobs...', fetchJobs);
  }, [runStream, fetchJobs]);

  const handleApply = useCallback((job, onComplete) => {
    runStream(
      '/api/apply',
      { company: job.company },
      `Generating resume & cover letter for ${job.company}...`,
      onComplete
    );
  }, [runStream]);

  const filteredJobs = jobs.filter(j => {
    const q = filter.toLowerCase();
    return !q
      || j.title?.toLowerCase().includes(q)
      || j.company?.toLowerCase().includes(q)
      || j.location?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Job Search Dashboard</h1>
        </div>
        <SearchPanel onSearch={handleSearch} disabled={log !== null} />
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 73px)' }}>
        <main className={`flex-1 overflow-auto p-6 transition-all duration-200 ${selectedJob ? 'mr-[440px]' : ''}`}>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filter by title, company, or location..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <JobTable
            jobs={filteredJobs}
            selectedJob={selectedJob}
            onSelect={setSelectedJob}
          />
        </main>

        {selectedJob && (
          <JobDetail
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onApply={handleApply}
            logStatus={log?.status}
          />
        )}
      </div>

      {log && (
        <LogFeed log={log} onClose={() => setLog(null)} />
      )}
    </div>
  );
}

function extractText(msg) {
  if (msg.type === 'assistant') {
    const content = msg.message?.content;
    if (!Array.isArray(content)) return '';
    return content.map(c => {
      if (c.type === 'text') return c.text.trim();
      if (c.type === 'tool_use') {
        const detail = c.input?.query
          ? `: "${c.input.query}"`
          : c.input?.command
          ? `: ${c.input.command}`
          : c.input?.url
          ? `: ${c.input.url}`
          : c.input?.file_path
          ? `: ${c.input.file_path}`
          : '';
        return `→ ${c.name}${detail}`;
      }
      return '';
    }).filter(Boolean).join('\n');
  }
  if (msg.type === 'result') {
    const s = msg.subtype ?? '';
    if (s === 'success') return '✓ Agent completed successfully';
    if (s.startsWith('error')) return `✗ ${s}`;
    return s;
  }
  if (msg.type === 'system') {
    return msg.text || (msg.subtype ? `[${msg.subtype}]` : '');
  }
  return '';
}

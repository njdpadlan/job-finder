import { useEffect, useRef } from 'react';

export default function LogFeed({ log, onClose }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.lines.length]);

  const canClose = log.status !== 'running';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-xl w-[720px] max-h-[75vh] flex flex-col shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
          <div className="flex items-center gap-3 min-w-0">
            <StatusDot status={log.status} />
            <h3 className="text-white text-sm font-medium truncate">{log.title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={!canClose}
            className="flex-shrink-0 ml-4 w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-1 font-mono text-xs text-gray-300">
          {log.lines.length === 0 && log.status === 'running' && (
            <p className="text-gray-500 animate-pulse">Starting agent&hellip;</p>
          )}
          {log.lines.map((line, i) => (
            <LogLine key={i} text={line} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-3 border-t border-gray-700/60 flex items-center justify-between">
          <StatusMessage status={log.status} />
          <button
            onClick={onClose}
            disabled={!canClose}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xs font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {canClose ? 'Close' : 'Running…'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const cls = status === 'running'
    ? 'bg-green-400 animate-pulse'
    : status === 'done'
    ? 'bg-green-400'
    : 'bg-red-400';
  return <span className={`flex-shrink-0 inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function StatusMessage({ status }) {
  if (status === 'running') {
    return <span className="text-gray-400 text-xs">Agent is running &mdash; this may take a few minutes&hellip;</span>;
  }
  if (status === 'done') {
    return <span className="text-green-400 text-xs font-medium">&#10003; Completed successfully</span>;
  }
  return <span className="text-red-400 text-xs font-medium">&#10007; Error &mdash; see output above</span>;
}

function LogLine({ text }) {
  const isToolCall = text.startsWith('→ ');
  const isSuccess = text.startsWith('✓');
  const isError = text.startsWith('✗') || text.startsWith('ERROR:');

  const cls = isToolCall
    ? 'text-blue-300'
    : isSuccess
    ? 'text-green-400'
    : isError
    ? 'text-red-400'
    : 'text-gray-300';

  return (
    <p className={`whitespace-pre-wrap leading-5 ${cls}`}>{text}</p>
  );
}

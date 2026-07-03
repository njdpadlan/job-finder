import { useState, useEffect, useCallback } from 'react';

function toFolderName(company) {
  return company.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export default function JobDetail({ job, onClose, onApply, logStatus }) {
  const [files, setFiles] = useState([]);
  const [applying, setApplying] = useState(false);
  const companyFolder = toFolderName(job.company);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(companyFolder)}`);
      setFiles(await res.json());
    } catch {
      setFiles([]);
    }
  }, [companyFolder]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  useEffect(() => {
    if (logStatus === 'done' && applying) {
      fetchFiles();
      setApplying(false);
    }
    if (logStatus === 'error' && applying) {
      setApplying(false);
    }
  }, [logStatus, applying, fetchFiles]);

  const handleApply = () => {
    if (applying) return;
    setApplying(true);
    onApply(job, () => {
      fetchFiles();
      setApplying(false);
    });
  };

  const resume = files.find(f => f.toLowerCase().includes('resume'));
  const coverLetter = files.find(f => f.toLowerCase().includes('cover'));

  return (
    <div className="fixed right-0 bg-white border-l border-gray-200 overflow-auto shadow-xl z-10 flex flex-col"
      style={{ top: 73, bottom: 0, width: 440 }}>
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex-1 min-w-0 pr-3">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{job.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{job.company} &bull; {job.location}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        <dl className="grid grid-cols-2 gap-3">
          <InfoRow label="Type" value={job.type} />
          <InfoRow label="Score" value={`${job.score}/10`} />
          <InfoRow label="Salary" value={job.salary || 'Not listed'} />
          <InfoRow label="Date Found" value={job.dateFound} />
        </dl>

        {job.url && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Job Posting</p>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {job.url}
            </a>
          </div>
        )}

        {job.requiredSkills && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Required Skills</p>
            <p className="text-sm text-gray-700 leading-relaxed">{job.requiredSkills}</p>
          </div>
        )}

        {job.skillGaps && job.skillGaps !== 'None' && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Skill Gaps</p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              {job.skillGaps}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-5 space-y-3">
        <button
          onClick={handleApply}
          disabled={applying || logStatus === 'running'}
          className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {applying ? 'Generating...' : 'Generate Resume & Cover Letter'}
        </button>

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Generated Documents</p>
            {resume && (
              <DownloadButton
                href={`/api/download/${encodeURIComponent(companyFolder)}/${encodeURIComponent(resume)}`}
                label="Resume"
                filename={resume}
              />
            )}
            {coverLetter && (
              <DownloadButton
                href={`/api/download/${encodeURIComponent(companyFolder)}/${encodeURIComponent(coverLetter)}`}
                label="Cover Letter"
                filename={coverLetter}
              />
            )}
            {files.filter(f => f !== resume && f !== coverLetter).map(f => (
              <DownloadButton
                key={f}
                href={`/api/download/${encodeURIComponent(companyFolder)}/${encodeURIComponent(f)}`}
                label={f}
                filename={f}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

function DownloadButton({ href, label, filename }) {
  return (
    <a
      href={href}
      download={filename}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors group"
    >
      <svg className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="flex-1 min-w-0">
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-gray-400 truncate">{filename}</span>
      </span>
    </a>
  );
}

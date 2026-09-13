import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Download,
  FileCheck,
  FileText,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  incidentTitle: string;
  markdown: string;
}

export const PostMortemModal: React.FC<Props> = ({
  isOpen,
  onClose,
  incidentTitle,
  markdown,
}) => {
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState(false);

  // Parse structured markdown sections for formatted presentation
  const parsedData = useMemo(() => {
    if (!markdown) return null;

    const getMeta = (prefix: string) => {
      const match = markdown.match(new RegExp(`\\*\\*${prefix}:\\*\\*\\s*([^\n\r]+)`));
      return match ? match[1].replace(/[`*]/g, '').trim() : '';
    };

    const incidentId = getMeta('Incident ID') || 'inc-auto';
    const severity = getMeta('Severity') || 'MAJOR';
    const impacted = getMeta('Impacted Services') || 'Core Services';
    const duration = getMeta('Total Duration') || 'N/A';
    const started = getMeta('Started') || '';
    const resolved = getMeta('Resolved') || '';

    // Extract sections
    const execMatch = markdown.match(/## 1\. Executive Summary\s+([\s\S]*?)(?=## 2|$)/);
    const execSummary = execMatch ? execMatch[1].trim() : '';

    const impactMatch = markdown.match(/## 2\. Customer & Operational Impact\s+([\s\S]*?)(?=## 3|$)/);
    const impactLines = impactMatch
      ? impactMatch[1]
          .split('\n')
          .filter((l) => l.trim().startsWith('-'))
          .map((l) => l.replace(/^[-\s*]+/, '').trim())
      : [];

    const timelineMatch = markdown.match(/## 3\. Incident Timeline\s+([\s\S]*?)(?=## 4|$)/);
    const timelineItems = timelineMatch
      ? timelineMatch[1]
          .split('\n')
          .filter((l) => l.trim().startsWith('-'))
          .map((l) => {
            const line = l.replace(/^-\s*/, '').trim();
            const timeMatch = line.match(/\*\*([^*]+)\*\*\s*\[([^\]]+)\]:\s*(.*)/);
            if (timeMatch) {
              return { time: timeMatch[1], status: timeMatch[2], msg: timeMatch[3] };
            }
            return { time: '', status: 'UPDATE', msg: line };
          })
      : [];

    const rootCauseMatch = markdown.match(/## 4\. Root Cause & Remediation\s+([\s\S]*?)(?=## 5|$)/);
    const rootCauseLines = rootCauseMatch
      ? rootCauseMatch[1]
          .split('\n')
          .filter((l) => l.trim().startsWith('-'))
          .map((l) => l.replace(/^-\s*/, '').trim())
      : [];

    const actionsMatch = markdown.match(/## 5\. Preventative & Follow-Up Actions\s+([\s\S]*?)(?=---|$)/);
    const actionItems = actionsMatch
      ? actionsMatch[1]
          .split('\n')
          .filter((l) => l.trim().startsWith('- ['))
          .map((l) => {
            const checked = l.includes('- [x]');
            const text = l.replace(/^-\s*\[[ x]\]\s*/, '').trim();
            return { checked, text };
          })
      : [];

    return {
      incidentId,
      severity,
      impacted,
      duration,
      started,
      resolved,
      execSummary,
      impactLines,
      timelineItems,
      rootCauseLines,
      actionItems,
    };
  }, [markdown]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `post-mortem-${incidentTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-750 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Fully Responsive & Clean */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100 tracking-tight">
                  Incident Post-Mortem Report
                </h2>
                <span className="hidden xs:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3" /> Auto-Generated
                </span>
              </div>
              <div className="text-xs text-zinc-400 truncate mt-0.5" title={incidentTitle}>
                {incidentTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* View Switcher Pill */}
            <div className="flex items-center p-0.5 rounded-lg bg-zinc-850 border border-zinc-750 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('formatted')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'formatted'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Formatted
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                  activeTab === 'raw'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Raw MD</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                title="Copy Markdown Source"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-all active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden xs:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                title="Download Markdown file"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Download</span>
              </button>

              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 text-zinc-200">
          {activeTab === 'formatted' && parsedData ? (
            <div className="space-y-6">
              {/* Metric Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3 rounded-xl bg-zinc-850/70 border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    <span>Severity</span>
                  </div>
                  <div className="text-sm font-bold text-rose-400 font-mono">
                    {parsedData.severity}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-850/70 border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Total Downtime</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {parsedData.duration}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-850/70 border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Impacted Services</span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-200 truncate" title={parsedData.impacted}>
                    {parsedData.impacted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-850/70 border border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Incident ID</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-400 truncate">
                    {parsedData.incidentId}
                  </div>
                </div>
              </div>

              {/* 1. Executive Summary */}
              {parsedData.execSummary && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-850/40 p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    1. Executive Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                    {parsedData.execSummary.replace(/\*\*/g, '')}
                  </p>
                </div>
              )}

              {/* 2. Customer & Operational Impact */}
              {parsedData.impactLines.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-850/40 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    2. Customer & Operational Impact
                  </h3>
                  <div className="space-y-1.5">
                    {parsedData.impactLines.map((line, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
                        <span>{line.replace(/\*\*/g, '').replace(/`/g, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Incident Timeline */}
              {parsedData.timelineItems.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-850/40 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    3. Incident Timeline
                  </h3>
                  <div className="space-y-2 border-l-2 border-zinc-750 pl-3.5 ml-1">
                    {parsedData.timelineItems.map((item, i) => (
                      <div key={i} className="relative text-xs space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-emerald-400 border border-zinc-700">
                            {item.status}
                          </span>
                          {item.time && (
                            <span className="text-[11px] font-mono text-zinc-500">
                              {new Date(item.time).toUTCString()}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-200 text-xs leading-relaxed">{item.msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Root Cause & Remediation */}
              {parsedData.rootCauseLines.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-850/40 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    4. Root Cause & Remediation
                  </h3>
                  <div className="space-y-1.5">
                    {parsedData.rootCauseLines.map((line, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                        <span>{line.replace(/\*\*/g, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Preventative & Follow-Up Actions */}
              {parsedData.actionItems.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-850/40 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400" />
                    5. Preventative & Follow-Up Actions
                  </h3>
                  <div className="space-y-2">
                    {parsedData.actionItems.map((act, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs transition-colors ${
                          act.checked
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300'
                            : 'bg-zinc-800/40 border-zinc-750 text-zinc-300'
                        }`}
                      >
                        {act.checked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-zinc-500 shrink-0 mt-0.5" />
                        )}
                        <span className={act.checked ? 'line-through text-zinc-400' : ''}>
                          {act.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-zinc-500 font-mono text-center pt-2">
                StatusCast Autonomous Incident Engine • Report Verified
              </div>
            </div>
          ) : (
            /* Raw Markdown Code Viewer */
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-text overflow-x-auto">
              {markdown}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

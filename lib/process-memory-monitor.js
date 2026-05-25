'use strict';

function createProcessMemoryMonitor({ fs, processCleanup }) {
  function findRoonProcesses() {
    const processes = processCleanup.listProcesses();
    return processes
      .filter(proc => /Roon(Server|Appliance|Bridge|RAATServer|Goer|Helper)|Roon/.test(proc.command || ''))
      .map(proc => ({
        ...proc,
        isServer: /RoonServer|RoonAppliance/.test(proc.command || ''),
        isRaat: /RAAT/.test(proc.command || ''),
        isRoon: /Roon/.test(proc.command || '')
      }));
  }

  function selectBestRoonProcess(processes) {
    if (!processes || processes.length === 0) return null;
    return processes.slice().sort((a, b) => {
      const score = proc => (proc.isServer ? 100 : 0) + (proc.isRoon ? 10 : 0) + Number(proc.rssKb || 0) / 1024 / 1024;
      return score(b) - score(a);
    })[0];
  }

  function readLinuxProcMemory(pid) {
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
      const rss = status.match(/^VmRSS:\s+(\d+)\s+kB/im);
      const size = status.match(/^VmSize:\s+(\d+)\s+kB/im);
      return {
        rssMB: rss ? Number(rss[1]) / 1024 : null,
        virtualMB: size ? Number(size[1]) / 1024 : null
      };
    } catch (_) {
      return null;
    }
  }

  return { findRoonProcesses, selectBestRoonProcess, readLinuxProcMemory };
}

module.exports = { createProcessMemoryMonitor };

'use strict';

// v8.71: Diagnostics are intentionally read-only. This module prints the same
// operator-facing report as previous releases, but keeps diagnose-mode output
// separate from the normal runtime orchestration path.
function diagnose(options) {
  const {
    fs,
    path,
    configPath,
    config,
    dirs,
    maxFilesPerDirectory,
    logFileService,
    findRoonProcesses,
    selectBestRoonProcess
  } = options;

  console.log('\n================ DIAGNOSE ================');
  console.log('Config file:', configPath);
  const runtimeProfile = logFileService.getRuntimeProfile();
  console.log('Platform:', (runtimeProfile.platform || runtimeProfile.name) + '/' + (runtimeProfile.arch || process.arch), '(' + runtimeProfile.name + ')');
  console.log('Configured baseDirectory:', logFileService.getConfiguredBaseDirectory(config));
  console.log('Discovery strategy: explicit paths + platform-specific Roon log discovery + optional deep scan');
  if (runtimeProfile.name === 'macOS') {
    console.log('Mounted /Volumes entries:');
    const volumes = logFileService.listMountedVolumes();
    if (volumes.length === 0) console.log(' - (none)');
    else volumes.forEach(v => console.log(' - ' + v));
  }

  const processes = findRoonProcesses();
  console.log('\nRoon processes:');
  if (processes.length === 0) console.log(' - (none found)');
  else processes.forEach(p => console.log(` - PID ${p.pid}: ${p.command}`));
  const memoryProc = selectBestRoonProcess(processes);
  console.log('Selected process for memory:', memoryProc ? `PID ${memoryProc.pid}` : '(none)');
  console.log('Memory source:', runtimeProfile.supportsProcMemory ? '/proc/<pid>/status VmRSS/VmSize' : 'Roon [stats] log lines');

  console.log('\nActive log directories:');
  if (!dirs || dirs.length === 0) {
    console.log(' - (none)');
  } else {
    dirs.forEach(dir => {
      const files = logFileService.listLogFiles(dir);
      console.log(` - ${dir}: ${files.length} file${files.length === 1 ? '' : 's'}`);
      files.slice(0, maxFilesPerDirectory).forEach(file => {
        let stat = null;
        try { stat = fs.statSync(file); } catch (_) {}
        const size = stat ? `${Math.round(stat.size / 1024)} KB` : 'unknown size';
        const modified = stat ? new Date(stat.mtimeMs).toLocaleString() : 'unknown modified time';
        console.log(`    watching: ${path.basename(file)} (${size}, modified ${modified})`);
      });
    });
  }

  const hasRoonServer = (dirs || []).some(d => d.toLowerCase().includes('roonserver'));
  console.log('\nRoonServer logs detected:', hasRoonServer ? 'yes' : 'no');
  if (!hasRoonServer) {
    console.log('Hint: set config.json > logDirectories to the exact Logs folder or set baseDirectory to the Roon data root. On Linux also check ~/.RoonServer/Logs and /var/roon/RoonServer/Logs.');
  }
  console.log('==========================================\n');
}

module.exports = { diagnose };

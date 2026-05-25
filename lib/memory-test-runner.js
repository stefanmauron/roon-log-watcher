'use strict';

function runMemoryTestFile({ file, fs, path, extractMemorySamples, extractLogTimestamp, trimLine, exit = process.exit }) {
  const resolved = path.resolve(file);
  console.log('Memory parser test:', resolved);
  let data;
  try {
    data = fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    console.error('Cannot read test file:', err.message);
    exit(1);
    return;
  }

  const detected = [];
  for (const line of data.split(/\r?\n/)) {
    const samples = extractMemorySamples(line);
    if (samples.length > 0) {
      detected.push({
        time: extractLogTimestamp(line) || '',
        samples,
        line: trimLine(line).slice(0, 240)
      });
    }
  }

  console.log(`Detected ${detected.length} memory log line(s).`);
  console.log(`Detected ${detected.reduce((sum, item) => sum + item.samples.length, 0)} memory value(s).`);
  detected.slice(0, 10).forEach((item, index) => {
    console.log(`\n#${index + 1} ${item.time}`);
    console.log(item.samples.map(sample => `${sample.metric}: ${Number(sample.valueMB.toFixed(2))} MB`).join(', '));
    console.log(item.line);
  });
  if (detected.length > 10) console.log(`\n... plus ${detected.length - 10} more memory line(s).`);
}

module.exports = { runMemoryTestFile };

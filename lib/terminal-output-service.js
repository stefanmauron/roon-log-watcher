'use strict';

function createTerminalOutputService({ enabled, smooth, intervalMs, write = text => console.log(text) }) {
  const queue = [];
  let timer = null;

  function ensureTimer() {
    if (timer || queue.length === 0) return;
    timer = setInterval(() => {
      const item = queue.shift();
      if (item) write(item);
      if (queue.length === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, intervalMs);
  }

  function writeLogLine(text) {
    if (!enabled) return;
    if (smooth) {
      queue.push(text);
      ensureTimer();
      return;
    }
    write(text);
  }

  function getQueueLength() {
    return queue.length;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    queue.length = 0;
  }

  return { writeLogLine, ensureTimer, getQueueLength, stop };
}

module.exports = { createTerminalOutputService };

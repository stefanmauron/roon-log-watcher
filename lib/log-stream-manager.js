'use strict';

function createLogStreamManager({ logWatcher, tailProcesses }) {
  return {
    stopAll() {
      logWatcher.stopTailProcesses(tailProcesses);
    },
    activeCount() {
      return tailProcesses.size;
    }
  };
}

module.exports = { createLogStreamManager };

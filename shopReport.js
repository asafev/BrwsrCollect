// shopReport.js — Builds, downloads, and displays the full session report

var _report = (function() {

  function build(promptType, promptEntry, responseText) {
    var parsed = null;
    var isValid = false;
    try { parsed = JSON.parse(responseText); isValid = true; } catch(e) {}

    var session = _ux.snapshot();
    var mutations = _mut.report();

    // Collect task field change history
    var isPlainText = !!(promptEntry.isFormBased);
    var taskFieldName = promptEntry.taskField || 'task';
    var taskChanges = _mut.fieldHistory(taskFieldName, isPlainText);

    return {
      _version: '1.1',
      promptType: promptType,
      promptId: promptEntry.id,
      timestamp: new Date().toISOString(),
      session: {
        durationMs: session.sessionDurationMs,
        totalEvents: session.totalEvents,
        trustedEvents: session.trustedEvents,
        untrustedEvents: session.untrustedEvents,
        untrustedRatio: session.untrustedRatio,
        untrustedTypes: session.untrustedTypes
      },
      response: {
        raw: responseText,
        parsed: parsed,
        isValidJSON: isValid
      },
      taskHistory: taskChanges,
      mouse: session.mouse,
      typing: session.typing,
      focus: session.focus,
      scroll: session.scroll,
      intentMutations: mutations,
      rawEvents: {
        clicks: session.rawClicks,
        keydowns: session.rawKeydowns,
        keyHolds: session.rawKeyHolds,
        focusEvents: session.rawFocus
      }
    };
  }

  function download(data) {
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'session-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  function inject(data) {
    var json = JSON.stringify(data, null, 2);
    var div = document.createElement('div');
    div.id = 'session-report';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#111;color:#0f0;'
      + 'font-family:monospace;font-size:11px;max-height:40vh;overflow:auto;padding:12px 16px;'
      + 'border-bottom:2px solid #0f0;';
    var btn = document.createElement('button');
    btn.textContent = 'Copy Report';
    btn.style.cssText = 'position:absolute;top:8px;right:16px;background:#0f0;color:#000;border:none;'
      + 'padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;';
    btn.onclick = function() {
      navigator.clipboard.writeText(json).then(function() { btn.textContent = 'Copied!'; });
    };
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-all;';
    pre.textContent = json;
    div.appendChild(btn);
    div.appendChild(pre);
    document.body.insertBefore(div, document.body.firstChild);
  }

  return { build: build, download: download, inject: inject };
})();

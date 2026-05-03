/**
 * Backup of _sendReport function removed from shop.html
 * Posts collected data to radware.com/asaf_even
 */
function _sendReport(data) {
  try {
    fetch('https://radware.com/asaf_even', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(e) {}
}

// A small in-app confirmation dialog (instead of window.confirm, so it
// matches the app and the "dialog open" hotkey guard sees it).

// → { ask({ title, message, confirmLabel, noLabel, cancelLabel }) → Promise<boolean|null> }
export function createConfirmDialog(dialog) {
  dialog.innerHTML = `
    <form method="dialog">
      <h2 data-r="title"></h2>
      <p data-r="message"></p>
      <div class="dialog-actions">
        <button type="button" data-r="cancel">Cancel</button>
        <button type="button" data-r="no" hidden>No</button>
        <button type="submit" class="primary" data-r="ok"></button>
      </div>
    </form>`;
  const r = (name) => dialog.querySelector(`[data-r="${name}"]`);
  let resolve = null;

  const finish = (answer) => {
    if (dialog.open) dialog.close();
    resolve?.(answer);
    resolve = null;
  };
  
  r('cancel').addEventListener('click', () => finish(null)); // Cancel -> null
  dialog.addEventListener('cancel', () => finish(null));      // Esc -> null
  r('no').addEventListener('click', () => finish(false));     // No -> false
  dialog.querySelector('form').addEventListener('submit', (e) => { 
    e.preventDefault(); 
    finish(true); // Yes/OK -> true
  });

  return {
    ask({ title, message, confirmLabel = 'OK', noLabel = null, cancelLabel = 'Cancel' }) {
      if (resolve) finish(null);
      r('title').textContent = title;
      r('message').textContent = message;
      r('ok').textContent = confirmLabel;
      r('cancel').textContent = cancelLabel;

      const noBtn = r('no');
      if (noLabel) {
        noBtn.textContent = noLabel;
        noBtn.hidden = false;
      } else {
        noBtn.hidden = true;
      }

      dialog.showModal();
      r('cancel').focus();
      return new Promise((res) => { resolve = res; });
    },
  };
}
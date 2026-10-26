// Companion chat panel (step D): a collapsible box at the top-left of the
// map with the message list, place chips, and the input. Display only:
// nothing here changes the sim, map data, undo history, or saved
// settings, and nothing is persisted.
//
// D1: replies can be pasted ("Paste sample reply") to try the place
// display before the local bridge exists. Sending is wired in D3.

import { parsePlaces } from './places.js';

// opts: { onShowPlace(place), onClearPlace() }
export function createChatPanel(root, { onShowPlace, onClearPlace }) {
  root.classList.add('chat-panel');
  root.setAttribute('aria-label', 'Companion chat');

  const head = document.createElement('div');
  head.className = 'chat-head';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'chat-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = 'Companion ▸';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'chat-clear';
  clear.textContent = 'Clear highlight';
  clear.hidden = true;
  head.append(toggle, clear);

  const body = document.createElement('div');
  body.className = 'chat-body';
  body.hidden = true;
  const list = document.createElement('div');
  list.className = 'chat-list';
  list.setAttribute('aria-live', 'polite');
  const note = document.createElement('p');
  note.className = 'hint chat-note';

  const paste = document.createElement('details');
  paste.className = 'chat-paste';
  const pasteSummary = document.createElement('summary');
  pasteSummary.textContent = 'Paste sample reply';
  const pasteBox = document.createElement('textarea');
  pasteBox.rows = 4;
  pasteBox.placeholder = 'A reply with a ```json list of {name, lat, lon, radius_km}';
  const pasteBtn = document.createElement('button');
  pasteBtn.type = 'button';
  pasteBtn.textContent = 'Show reply';
  paste.append(pasteSummary, pasteBox, pasteBtn);

  const form = document.createElement('form');
  form.className = 'chat-form';
  const input = document.createElement('textarea');
  input.rows = 2;
  input.maxLength = 4000;
  input.placeholder = 'Ask about this map…';
  input.setAttribute('aria-label', 'Message');
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'primary';
  send.textContent = 'Send';
  form.append(input, send);

  const thinking = document.createElement('div');
  thinking.className = 'chat-thinking';
  thinking.hidden = true;
  const thinkingText = document.createElement('span');
  thinkingText.textContent = 'Thinking…';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  thinking.append(thinkingText, cancel);

  body.append(list, thinking, note, paste, form);
  root.append(head, body);

  const setOpen = (open) => {
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Companion ▾' : 'Companion ▸';
  };
  toggle.addEventListener('click', () => setOpen(body.hidden));
  clear.addEventListener('click', () => { clear.hidden = true; onClearPlace(); });

  function addMessage(role, text) {
    const item = document.createElement('div');
    item.className = `chat-msg chat-${role}`;
    const p = document.createElement('div');
    p.className = 'chat-text';
    p.textContent = text;
    item.append(p);
    list.append(item);
    list.scrollTop = list.scrollHeight;
    return item;
  }

  // A reply: its text, then one chip per place. place.flagged / place.flags
  // come from the bridge's checks (D2); parse issues flag a place too.
  function addReply(reply, { places: checked = null, toolCalls = null } = {}) {
    const parsed = parsePlaces(reply);
    const item = addMessage('assistant', parsed.text || '(no text)');
    const places = (checked ?? parsed.places).map((p) => {
      const flags = [...(p.issues ?? []), ...(p.flags ?? [])];
      return { ...p, flags, flagged: Boolean(p.flagged) || flags.length > 0 };
    });
    if (parsed.error) {
      const err = document.createElement('div');
      err.className = 'chat-error';
      err.textContent = parsed.error;
      item.append(err);
    }
    if (places.length) {
      const chips = document.createElement('div');
      chips.className = 'chat-chips';
      for (const place of places) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = place.flagged ? 'chat-chip is-flagged' : 'chat-chip';
        chip.textContent = place.flagged ? `⚠ ${place.name}` : place.name;
        chip.title = place.flagged
          ? `Flagged: ${place.flags.join('; ')}`
          : `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)} · ${Math.round(place.radius_km)} km`;
        chip.addEventListener('click', () => { clear.hidden = false; onShowPlace(place); });
        chips.append(chip);
      }
      item.append(chips);
    }
    if (toolCalls != null) {
      const meta = document.createElement('div');
      meta.className = 'hint';
      meta.textContent = `Map tool calls: ${toolCalls}`;
      item.append(meta);
    }
    return places;
  }

  pasteBtn.addEventListener('click', () => {
    if (!pasteBox.value.trim()) return;
    addReply(pasteBox.value);
    pasteBox.value = '';
  });

  function addError(text) {
    const item = addMessage('assistant', text);
    item.classList.add('chat-failed');
    return item;
  }

  return {
    element: root, form, input, send, list, note, cancel,
    setOpen, addMessage, addReply, addError,
    setNote(text) { note.textContent = text; note.hidden = !text; },
    setSending(on) { input.disabled = on; send.disabled = on; },
    setThinking(on, text = 'Thinking…') { thinking.hidden = !on; thinkingText.textContent = text; },
    disable(text) { input.disabled = true; send.disabled = true; note.textContent = text; },
  };
}

const POPUP_CSS = `
  :host {
    all: initial;
    --bg: #ffffff;
    --text: #1f2328;
    --hover: #eef1f4;
    --line: #d0d7de;
    --result: #0b57d0;
    --muted: #656d76;
    --shadow: rgba(31, 35, 40, 0.18);
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --bg: #1f2328;
      --text: #f0f2f4;
      --hover: #3a4048;
      --line: #3a4048;
      --result: #8ab4ff;
      --muted: #9aa4ae;
      --shadow: rgba(0, 0, 0, 0.35);
    }
  }
  .popup {
    position: fixed;
    display: none;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--line);
    font: 13px/1.2 system-ui, sans-serif;
    box-shadow: 0 4px 14px var(--shadow);
    user-select: none;
    white-space: nowrap;
    flex-wrap: wrap;
    max-width: calc(100vw - 16px);
  }
  .popup.open { display: flex; }
  button {
    all: unset;
    cursor: pointer;
    padding: 5px 9px;
    border-radius: 5px;
  }
  button:hover, button:focus-visible { background: var(--hover); }
  button.result { color: var(--result); font-weight: 600; }
  button.switch { color: var(--muted); font-size: 12px; }
  .sep { width: 1px; align-self: stretch; margin: 3px 1px; background: var(--line); }
`;

// Inline and !important so page CSS can't hide or move the popup; its
// contents are in a closed shadow root.
const HOST_STYLE = [
  "all: initial", "display: block", "position: fixed", "top: 0", "left: 0",
  "width: 0", "height: 0", "overflow: visible", "z-index: 2147483647",
].map((rule) => `${rule} !important`).join("; ");

class SelectionPopup {
  constructor() {
    this.host = null;
    this.box = null;
  }

  mount() {
    if (this.host?.isConnected) return;
    this.host = document.createElement("selectkit-popup");
    this.host.style.cssText = HOST_STYLE;
    const root = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = POPUP_CSS;
    this.box = document.createElement("div");
    this.box.className = "popup";
    // Clicking the popup must not clear the page selection.
    this.box.addEventListener("mousedown", (e) => e.preventDefault());
    root.append(style, this.box);
    document.documentElement.append(this.host);
  }

  contains(event) {
    return !!this.host && event.composedPath().includes(this.host);
  }

  get isOpen() {
    return !!this.box && this.box.classList.contains("open");
  }

  show(clientX, clientY, actions) {
    this.mount();
    this.box.replaceChildren();
    actions.forEach((action, i) => {
      if (i > 0) {
        const sep = document.createElement("div");
        sep.className = "sep";
        this.box.append(sep);
      }
      const button = document.createElement("button");
      button.textContent = action.label;
      if (action.title) button.title = action.title;
      if (action.className) button.className = action.className;
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        action.onClick(button);
      });
      this.box.append(button);
    });

    this.box.style.left = "0px";
    this.box.style.top = "0px";
    this.box.style.visibility = "hidden";
    this.box.classList.add("open");
    const { width, height } = this.box.getBoundingClientRect();
    const margin = 8;
    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = document.documentElement.clientHeight;
    let left = clientX + 10;
    let top = clientY + 14;
    if (left + width + margin > viewWidth) left = Math.max(margin, viewWidth - width - margin);
    if (top + height + margin > viewHeight) top = Math.max(margin, clientY - height - 14);
    this.box.style.left = `${left}px`;
    this.box.style.top = `${top}px`;
    this.box.style.visibility = "";
  }

  hide() {
    if (!this.isOpen) return;
    this.box.classList.remove("open");
    this.box.replaceChildren();
  }
}

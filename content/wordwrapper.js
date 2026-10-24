// Word wrapper: grows the page selection so every word it touches is
// selected in full ("ect all wor" -> "select all words").
//
// A word can be split over several text nodes ("sel<b>ect</b>"), so each
// selection edge is looked up in the text of its whole block (paragraph,
// list item, cell, ...), then mapped back to a text node and offset.

function blockOf(node) {
  let el = node.parentElement;
  while (el && el !== document.body && getComputedStyle(el).display.startsWith("inline")) {
    el = el.parentElement;
  }
  return el || document.body;
}

function textNodesOf(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  return nodes;
}

// Returns the new position for one selection edge, or null to leave it.
function wrapEdge(node, offset, isEnd) {
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const nodes = textNodesOf(blockOf(node));
  const starts = [];
  let text = "";
  let position = -1;
  for (const n of nodes) {
    if (n === node) position = text.length + offset;
    starts.push(text.length);
    text += n.data;
  }
  if (position < 0) return null;

  const word = wordAround(text, position);
  if (!word) return null;
  const target = isEnd ? word.end : word.start;

  // A position between two text nodes belongs to the node before it when
  // it's an end edge, and to the node after it when it's a start edge.
  for (let i = 0; i < nodes.length; i++) {
    const nodeStart = starts[i];
    const nodeEnd = nodeStart + nodes[i].data.length;
    const inside = isEnd
      ? nodeStart < target && target <= nodeEnd
      : nodeStart <= target && target < nodeEnd;
    if (inside) return { node: nodes[i], offset: target - nodeStart };
  }
  return null;
}

function wrapSelectionToWords() {
  const selection = window.getSelection();
  if (selection.rangeCount !== 1 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const start = wrapEdge(range.startContainer, range.startOffset, false);
  const end = wrapEdge(range.endContainer, range.endOffset, true);
  if (!start && !end) return;

  const from = start || { node: range.startContainer, offset: range.startOffset };
  const to = end || { node: range.endContainer, offset: range.endOffset };

  // Keep the direction the user dragged in, so Shift+arrow keeps working.
  const backward =
    selection.focusNode === range.startContainer && selection.focusOffset === range.startOffset;
  if (backward) selection.setBaseAndExtent(to.node, to.offset, from.node, from.offset);
  else selection.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
}

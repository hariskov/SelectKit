function isInline(element) {
  const { display } = getComputedStyle(element);
  return display === "" || display === "contents" || display.startsWith("inline");
}

function blockOf(node) {
  let element = node.parentElement;
  while (element && element !== document.body && isInline(element)) element = element.parentElement;
  return element ?? document.body;
}

// A word can be split over text nodes ("sel<b>ect</b>"): the node plus
// enough of its block's text on each side to hold any word through it.
function nearbyTextNodes(node) {
  const walker = document.createTreeWalker(blockOf(node), NodeFilter.SHOW_TEXT);
  const collect = (step) => {
    const nodes = [];
    walker.currentNode = node;
    for (let length = 0, n = step(); n && length < WORD_CONTEXT; n = step()) {
      nodes.push(n);
      length += n.data.length;
    }
    return nodes;
  };
  const before = collect(() => walker.previousNode()).reverse();
  const after = collect(() => walker.nextNode());
  return [...before, node, ...after];
}

// A price or measurement wins over the word, so "25" in "$25" or "25 лв"
// grows to the whole price.
function spanAround(text, position) {
  const inside = ({ start, end }) => start < position && position < end;
  return [...findPrices(text), ...findMeasurements(text)].find(inside) ?? wordAround(text, position);
}

function wrapEdge(node, offset, isEnd) {
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const nodes = nearbyTextNodes(node);
  const starts = [];
  let text = "";
  for (const n of nodes) {
    starts.push(text.length);
    text += n.data;
  }
  const span = spanAround(text, starts[nodes.indexOf(node)] + offset);
  if (!span) return null;
  const target = isEnd ? span.end : span.start;

  // Between two nodes, an end edge stays in the earlier one, a start edge
  // in the later one.
  for (let i = 0; i < nodes.length; i++) {
    const nodeEnd = starts[i] + nodes[i].data.length;
    const inside = isEnd ? starts[i] < target && target <= nodeEnd : starts[i] <= target && target < nodeEnd;
    if (inside) return { node: nodes[i], offset: target - starts[i] };
  }
  return null;
}

function wrapSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const start = wrapEdge(range.startContainer, range.startOffset, false);
  const end = wrapEdge(range.endContainer, range.endOffset, true);
  if (!start && !end) return;

  const from = start ?? { node: range.startContainer, offset: range.startOffset };
  const to = end ?? { node: range.endContainer, offset: range.endOffset };
  // Keep the drag direction so Shift+arrow extends from the right end.
  const backward = selection.focusNode === range.startContainer && selection.focusOffset === range.startOffset;
  if (backward) selection.setBaseAndExtent(to.node, to.offset, from.node, from.offset);
  else selection.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
}

// CodeMirror 6 による LaTeX ソースエディタ
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap, Decoration, ViewPlugin, WidgetType, placeholder } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { indentWithTab, undo, redo } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { findMathRanges, fullwidthFixes } from './mathRanges.js';
import { parseMarker, markerText, MARKER_RE } from './natural.js';

// ---------------- LaTeX を知らなくても読めるように ----------------
// \item・\begin{enumerate} などの命令を「小問」「小問ここから」といった札で見せる。
// カーソルのある行だけは元の文字のまま見せる（そのまま編集できるように）。
class ChipWidget extends WidgetType {
  constructor(text, kind) {
    super();
    this.text = text;
    this.kind = kind;
  }
  eq(o) {
    return o.text === this.text && o.kind === this.kind;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = `cm-chip cm-chip-${this.kind}`;
    s.textContent = this.text;
    return s;
  }
  ignoreEvent() {
    return false;
  }
}
const CHIPS = [
  [/\\begin\{enumerate\}(\[[^\]\n]*\])?/g, () => ['小問ここから', 'list']],
  [/\\end\{enumerate\}/g, () => ['小問ここまで', 'list']],
  [/\\begin\{itemize\}/g, () => ['箇条書きここから', 'list']],
  [/\\end\{itemize\}/g, () => ['箇条書きここまで', 'list']],
  [/\\item(\[[^\]\n]*\])?(?![a-zA-Z])/g, (m) => [m[1] ? `小問 ${m[1].slice(1, -1)}` : '小問', 'item']],
  [/\\blank\{([^{}\n]*)\}/g, (m) => [`空欄 ${m[1]}`, 'blank']],
  [/\\Part(\[[^\]\n]*\])?(?![a-zA-Z])/g, (m) => [m[1] ? `部 ${m[1].slice(1, -1)}` : '部（I, II…）', 'part']],
  [/\\(newpage|clearpage)(?![a-zA-Z])/g, () => ['改ページ', 'page']],
  [/^[ \t]*\\\[[ \t]*$/gm, () => ['別行の数式ここから', 'math']],
  [/^[ \t]*\\\][ \t]*$/gm, () => ['別行の数式ここまで', 'math']],
];
const subMark = Decoration.mark({ class: 'cm-submark' });
const readableChips = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.build(view);
    }
    update(u) {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged) this.decorations = this.build(u.view);
    }
    build(view) {
      const { state } = view;
      const active = new Set();
      if (view.hasFocus) for (const r of state.selection.ranges) for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) active.add(n);
      const decos = [];
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = state.doc.lineAt(pos);
          pos = line.to + 1;
          // 「(1) 」の目印は札にせず色だけ付ける（いつでも見えるように）
          const mk = MARKER_RE.exec(line.text);
          if (mk) decos.push(subMark.range(line.from + mk[1].length, line.from + mk[0].length - 1));
          if (active.has(line.number) || line.text.indexOf('\\') < 0) continue;
          if (/^\s*%/.test(line.text)) continue;
          for (const [re, label] of CHIPS) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(line.text))) {
              const [text, kind] = label(m);
              const start = line.from + m.index + (m[0].length - m[0].trimStart().length);
              decos.push(Decoration.replace({ widget: new ChipWidget(text, kind) }).range(start, line.from + m.index + m[0].trimEnd().length));
              if (m[0].length === 0) re.lastIndex++;
            }
          }
        }
      }
      return Decoration.set(decos, true);
    }
  },
  { decorations: (v) => v.decorations }
);

/** Enter: 「(1) …」「\item …」の行の末尾なら、次の行に次の番号を入れる。番号だけの行なら番号を消して終わる */
function continueList(view) {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty || state.selection.ranges.length > 1) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false;
  const mk = parseMarker(line.text);
  const it = /^([ \t]*)\\item(?:[ \t]+|$)/.exec(line.text);
  if (!mk && !it) return false;
  const rest = line.text.slice(mk ? mk.length : it[0].length);
  if (rest.trim() === '') {
    // 番号だけの行で Enter: 番号を消して空行を 1 つ置き、小問のまとまりから出る
    view.dispatch({ changes: { from: line.from, to: line.to, insert: '\n' }, selection: { anchor: line.from + 1 }, scrollIntoView: true, userEvent: 'input' });
    return true;
  }
  const ins = '\n' + (mk ? mk.indent + markerText(mk.n + 1, mk) : `${it[1]}\\item `);
  view.dispatch({ changes: { from: sel.head, insert: ins }, selection: { anchor: sel.head + ins.length }, scrollIntoView: true, userEvent: 'input' });
  return true;
}

/** カーソルの位置に次の小問の目印を入れる（前にある目印の番号の続き） */
function insertSubQuestion(view) {
  const { state } = view;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  let prev = null;
  for (let n = line.number - (line.text.trim() === '' ? 1 : 0); n >= 1; n--) {
    const mk = parseMarker(state.doc.line(n).text);
    if (mk) {
      prev = mk;
      break;
    }
  }
  const mark = markerText(prev ? prev.n + 1 : 1, prev);
  const at = line.text.trim() === '' ? line.from : line.to;
  const insert = line.text.trim() === '' ? mark : `\n${mark}`;
  view.dispatch({ changes: { from: at, to: line.text.trim() === '' ? line.to : at, insert }, selection: { anchor: at + insert.length }, scrollIntoView: true, userEvent: 'input' });
  view.focus();
}

// 数式部分に薄い背景を付ける（どこが数式かひと目で分かるように）
const mathMark = Decoration.mark({ class: 'cm-math' });
const mathHighlighter = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.build(view);
    }
    update(u) {
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
    }
    build(view) {
      const text = view.state.doc.toString();
      const ranges = findMathRanges(text).map((r) => mathMark.range(r.from, r.to));
      return Decoration.set(ranges, true);
    }
  },
  { decorations: (v) => v.decorations }
);

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '15px' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.65' },
  '.cm-content': { padding: '10px 0' },
  '.cm-math': { backgroundColor: 'var(--math-bg)', borderRadius: '3px' },
  '.cm-placeholder': { whiteSpace: 'pre-wrap', color: 'var(--muted)' },
  '.cm-chip': {
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: '4px',
    fontFamily: 'var(--sans)',
    fontSize: '12px',
    lineHeight: '1.6',
    verticalAlign: 'baseline',
    border: '1px solid var(--border)',
    background: 'var(--panel)',
    color: 'var(--muted)',
    cursor: 'text',
  },
  '.cm-chip-item, .cm-chip-list': { color: 'var(--accent)', borderColor: 'var(--accent)' },
  '.cm-chip-blank': { color: '#b26a00', borderColor: '#d9a64e' },
  '.cm-submark': { color: 'var(--accent)', fontWeight: '600' },
});

export function createEditor(parent, { onChange, keys = [], getAutoHalfwidth = () => true }) {
  const themeComp = new Compartment();
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  let fixTimer = null;
  let view;

  const scheduleFullwidthFix = () => {
    clearTimeout(fixTimer);
    fixTimer = setTimeout(() => {
      if (!view || view.composing || !getAutoHalfwidth()) return;
      const changes = fullwidthFixes(view.state.doc.toString());
      if (changes.length) view.dispatch({ changes, userEvent: 'input.halfwidth' });
    }, 600);
  };

  const extensions = [
    basicSetup,
    StreamLanguage.define(stex),
    EditorView.lineWrapping,
    mathHighlighter,
    readableChips,
    placeholder('ここに問題文を書きます。\n小問は行の先頭に「(1) 」（かっこと数字と空白）と書くと、番号の形はレイアウトに合わせて付きます。Enter で次の番号が入ります。\n数式は上の「∑ 数式エディタ」か「数式」ボタンで入れられます。'),
    baseTheme,
    themeComp.of(dark.matches ? oneDark : []),
    Prec.highest(keymap.of([...keys, { key: 'Enter', run: continueList }, indentWithTab])), // 書式ショートカットを既定のキー割り当てより優先
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      onChange(u.state.doc.toString());
      scheduleFullwidthFix();
    }),
  ];

  view = new EditorView({ parent, state: EditorState.create({ doc: '', extensions }) });
  dark.addEventListener('change', (e) => view.dispatch({ effects: themeComp.reconfigure(e.matches ? oneDark : []) }));

  const states = new Map();
  let current = null;

  return {
    view,
    /** 問題・欄ごとに編集状態（取り消し履歴）を保持したまま切り替える */
    load(key, text) {
      if (current) states.set(current, view.state);
      let st = states.get(key);
      if (!st || st.doc.toString() !== text) st = EditorState.create({ doc: text, extensions });
      current = key;
      view.setState(st);
    },
    reset() {
      states.clear();
      current = null;
    },
    getText: () => view.state.doc.toString(),
    getSelection: () => view.state.selection.main,
    replace(from, to, insert, cursor) {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: cursor ?? from + insert.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    /** 置き換えて、指定範囲を選択状態にする（書式を重ねて付けられるように） */
    replaceSelect(from, to, insert, selFrom, selTo) {
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: selFrom, head: selTo }, scrollIntoView: true });
      view.focus();
    },
    gotoLine(n) {
      const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true });
      view.focus();
    },
    insertSubQuestion: () => insertSubQuestion(view),
    undo: () => undo(view),
    redo: () => redo(view),
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
  };
}

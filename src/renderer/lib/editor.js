// CodeMirror 6 による LaTeX ソースエディタ
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, Decoration, ViewPlugin } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { indentWithTab, undo, redo } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { findMathRanges, fullwidthFixes } from './mathRanges.js';

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
    baseTheme,
    themeComp.of(dark.matches ? oneDark : []),
    keymap.of([...keys, indentWithTab]),
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
    gotoLine(n) {
      const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true });
      view.focus();
    },
    undo: () => undo(view),
    redo: () => redo(view),
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
  };
}

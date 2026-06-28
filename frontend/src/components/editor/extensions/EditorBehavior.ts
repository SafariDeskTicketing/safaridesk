import { Extension } from '@tiptap/core';

/**
 * Fixes standard editor keyboard behaviours that TipTap/StarterKit doesn't handle
 * out of the box in the way most users expect from Google Docs / Notion.
 */
export const EditorBehavior = Extension.create({
  name: 'editorBehavior',

  addKeyboardShortcuts() {
    return {
      // ── Enter ──────────────────────────────────────────────────────────────
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;
        const parentType = $from.parent.type.name;

        if (parentType === 'heading') {
          const isEmpty = $from.parent.nodeSize === 2;

          if (isEmpty) {
            // Empty heading — convert in place to paragraph (Notion/Docs behaviour)
            return editor.chain().setNode('paragraph').run();
          }

          if (!empty) {
            // Selection spans text in the heading: delete it first so we get a clean cursor,
            // then split and convert the new block to a paragraph.
            return editor.chain().deleteSelection().splitBlock().setNode('paragraph').run();
          }

          // Cursor only (start, middle, or end of heading):
          // split the block and convert the NEW block to a paragraph.
          // Text before cursor stays in the heading; text after cursor moves to the paragraph.
          return editor.chain().splitBlock().setNode('paragraph').run();
        }

        return false; // let TipTap / StarterKit handle everything else
      },

      // ── Shift+Enter: soft line break (hard break / <br>) everywhere ────────
      'Shift-Enter': ({ editor }) => {
        return editor.commands.setHardBreak();
      },

      // ── Ctrl/Cmd+Enter: exit code block or blockquote, insert paragraph ────
      'Mod-Enter': ({ editor }) => {
        const { $from } = editor.state.selection;
        const parentType = $from.parent.type.name;

        if (parentType === 'codeBlock') {
          return editor.chain().exitCode().run();
        }

        if (parentType === 'blockquote') {
          // Lift out of blockquote
          return editor.chain().lift('blockquote').run();
        }

        return false;
      },

      // ── Tab: indent list item (matches Notion / Docs behaviour) ─────────────
      Tab: ({ editor }) => {
        // In a list → sink (indent) the current item
        if (editor.can().sinkListItem('listItem')) {
          return editor.commands.sinkListItem('listItem');
        }
        // Nowhere else to handle Tab — return false and let browser handle
        return false;
      },

      // ── Shift+Tab: outdent list item ─────────────────────────────────────────
      'Shift-Tab': ({ editor }) => {
        if (editor.can().liftListItem('listItem')) {
          return editor.commands.liftListItem('listItem');
        }
        return false;
      },

      // ── Backspace at the start of a block: convert heading to paragraph ─────
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty) return false;
        if ($from.parentOffset !== 0) return false;

        const parentType = $from.parent.type.name;

        // Heading at position 0 → convert to paragraph
        if (parentType === 'heading') {
          return editor.chain().setNode('paragraph').run();
        }

        return false;
      },
    };
  },
});

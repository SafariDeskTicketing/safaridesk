import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
      setInlineFontWeight: (weight: string) => ReturnType;
      unsetInlineFontWeight: () => ReturnType;
      setHighlight: (color: string) => ReturnType;
      unsetHighlight: () => ReturnType;
    };
  }
}

// Adds fontSize, fontWeight, and backgroundColor (highlight) attributes to TextStyle marks.
// These work alongside the Color extension's `color` attribute on the same span element.
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
          fontWeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontWeight || null,
            renderHTML: (attrs) =>
              attrs.fontWeight ? { style: `font-weight: ${attrs.fontWeight}` } : {},
          },
          backgroundColor: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.backgroundColor || null,
            renderHTML: (attrs) =>
              attrs.backgroundColor
                ? { style: `background-color: ${attrs.backgroundColor}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),

      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),

      setInlineFontWeight:
        (weight: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontWeight: weight }).run(),

      unsetInlineFontWeight:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontWeight: null }).removeEmptyTextStyle().run(),

      setHighlight:
        (color: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { backgroundColor: color }).run(),

      unsetHighlight:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { backgroundColor: null }).removeEmptyTextStyle().run(),
    };
  },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useEditor, EditorContent, BubbleMenu, type Editor } from '@tiptap/react';
import ConfirmDialog from '../ui/ConfirmDialog';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { EditorBehavior } from './extensions/EditorBehavior';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import typescript from 'highlight.js/lib/languages/typescript';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import { ResizableImage } from './extensions/ResizableImage';
import { FontSize } from './extensions/FontSize';
import { KBArticleService } from '../../services/kb/articles';
import { errorNotification } from '../ui/Toast';
import './safaridesk-editor.css';

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Plus,
  Minus,
  ChevronDown,
  Upload,
  X,
  Palette,
  Check,
  RotateCcw,
  Eraser,
  Highlighter,
  Indent,
  Outdent,
  AlertCircle,
  Rows3,
  Columns3,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

// fontWeight stored as string so it can be used directly in TextStyle marks
const HEADING_LEVELS = [
  { level: 0, label: 'Body',        fontSize: '0.875rem', fontWeight: '400' },
  { level: 1, label: 'Large title', fontSize: '1.5rem',   fontWeight: '700' },
  { level: 2, label: 'Title',       fontSize: '1.25rem',  fontWeight: '700' },
  { level: 3, label: 'Subtitle',    fontSize: '1.05rem',  fontWeight: '600' },
] as const;

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red',     value: '#ef4444' },
  { label: 'Orange',  value: '#f97316' },
  { label: 'Yellow',  value: '#eab308' },
  { label: 'Green',   value: '#22c55e' },
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Purple',  value: '#a855f7' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Gray',    value: '#6b7280' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None',   value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green',  value: '#bbf7d0' },
  { label: 'Blue',   value: '#bfdbfe' },
  { label: 'Pink',   value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Purple', value: '#e9d5ff' },
];

const lowlight = createLowlight();
lowlight.register({ javascript, python, css, typescript, html, json, sql });

// ── URL helpers ──────────────────────────────────────────────────────────────

function normalizeImageUrl(raw: string): { url: string; warning?: string } {
  const trimmed = raw.trim();

  if (!trimmed) return { url: '' };

  // Block non-http schemes (javascript:, data:, ftp:, etc.)
  if (!/^https?:\/\//i.test(trimmed)) {
    return { url: '', warning: 'URL must start with https://' };
  }

  try {
    const parsed = new URL(trimmed);

    // Google Drive file/view → direct embed
    const gdFile = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (parsed.hostname === 'drive.google.com' && gdFile) {
      return {
        url: `https://drive.google.com/uc?export=view&id=${gdFile[1]}`,
        warning: 'Google Drive: make sure the file is shared publicly.',
      };
    }
    if (parsed.hostname === 'drive.google.com' && parsed.searchParams.has('id')) {
      return {
        url: `https://drive.google.com/uc?export=view&id=${parsed.searchParams.get('id')}`,
        warning: 'Google Drive: make sure the file is shared publicly.',
      };
    }

    // Dropbox shared links → direct download (dl=1)
    if (parsed.hostname.includes('dropbox.com') && parsed.searchParams.get('dl') !== '1') {
      parsed.searchParams.set('dl', '1');
      return { url: parsed.toString(), warning: 'Dropbox: converted to direct download link.' };
    }

    return { url: trimmed };
  } catch {
    return { url: '', warning: 'Invalid URL format.' };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface SafariDeskEditorProps {
  content: string;
  onChange: (content: string) => void;
  className?: string;
  onImageUpload?: (file: File) => Promise<string>;
  /** localStorage key for draft autosave. If omitted, autosave is disabled. */
  autosaveKey?: string;
  /** When true, warn the user with a dialog if they try to navigate away with unsaved changes. */
  warnOnNavigation?: boolean;
}

export interface SafariDeskEditorHandle {
  markClean: () => void;
}

const SafariDeskEditor = React.forwardRef<SafariDeskEditorHandle, SafariDeskEditorProps>(({
  content,
  onChange,
  className = '',
  onImageUpload,
  autosaveKey,
  warnOnNavigation = false,
}, ref) => {
  // ── Stable callbacks (no editor dep) ────────────────────────────────────────
  const resolveImageUrl = useCallback((url: string): string => {
    if (url.startsWith('http')) return url;
    const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
    const origin = apiBase.startsWith('http') ? new URL(apiBase).origin : window.location.origin;
    return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
  }, []);

  const fallbackUpload = useCallback(async (file: File): Promise<string> => {
    const response = await KBArticleService.uploadImage(file);
    return response.url; // raw URL; editorAwareUpload resolves once
  }, []);

  // ── All state (must precede useEditor) ──────────────────────────────────────
  const [showTableModal,      setShowTableModal]      = useState(false);
  const [tableRows,           setTableRows]           = useState(3);
  const [tableCols,           setTableCols]           = useState(3);
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
  const [showColorPicker,     setShowColorPicker]     = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [dropError,           setDropError]           = useState<string | null>(null);
  const [showLinkDialog,      setShowLinkDialog]      = useState(false);
  const [linkUrl,             setLinkUrl]             = useState('');
  const [showImageModal,      setShowImageModal]      = useState(false);
  const [imageUploadMode,     setImageUploadMode]     = useState<'file' | 'url'>('file');
  const [imageUrl,            setImageUrl]            = useState('');
  const [imageAlt,            setImageAlt]            = useState('');
  const [urlWarning,          setUrlWarning]          = useState<string | null>(null);
  const [urlError,            setUrlError]            = useState<string | null>(null);
  const [uploadingImage,      setUploadingImage]      = useState(false);
  const [dragActive,          setDragActive]          = useState(false);
  const [showRestoreBanner,   setShowRestoreBanner]   = useState(false);
  const [draftContent,        setDraftContent]        = useState<string | null>(null);
  const [isDirty,             setIsDirty]             = useState(false);

  // ── All refs ─────────────────────────────────────────────────────────────────
  const linkInputRef          = useRef<HTMLInputElement>(null);
  const fileInputRef          = useRef<HTMLInputElement | null>(null);
  const handleImageUploadRef  = useRef<((file: File) => Promise<void>) | null>(null);
  const openLinkDialogRef     = useRef<(() => void) | null>(null);
  const dirtyRef              = useRef(false);
  const autosaveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveKeyRef        = useRef(autosaveKey);
  autosaveKeyRef.current      = autosaveKey;
  const draftCheckedRef       = useRef(false);
  // Guard: prevents the content-sync effect from reverting editor changes that originated internally
  const editorChangedRef      = useRef(false);

  // Block in-app navigation when there are unsaved changes
  const blocker = useBlocker(() => warnOnNavigation && dirtyRef.current);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    setIsDirty(false);
    const key = autosaveKeyRef.current;
    if (key) {
      try { localStorage.removeItem(key); } catch { /* localStorage unavailable */ }
    }
  }, []);

  React.useImperativeHandle(ref, () => ({ markClean }), [markClean]);

  // ── Editor ───────────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Subscript,
      Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({
        allowBase64: true,
        HTMLAttributes: { class: 'safaridesk-editor-image' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'safaridesk-editor-link',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'safaridesk-editor-table' },
      }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: 'safaridesk-editor-table-header' } }),
      TableCell.configure({ HTMLAttributes: { class: 'safaridesk-editor-table-cell' } }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: 'safaridesk-editor-codeblock' },
      }),
      CharacterCount,
      TextStyle,
      Color,
      FontSize,
      EditorBehavior,
    ],
    content,
    onUpdate: ({ editor: e }: { editor: Editor }) => {
      const html = e.getHTML();
      editorChangedRef.current = true;
      if (!dirtyRef.current) { dirtyRef.current = true; setIsDirty(true); }
      onChange(html);
      const key = autosaveKeyRef.current;
      if (key) {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
          try { localStorage.setItem(key, html); } catch { /* quota */ }
        }, 2000);
      }
    },
    editorProps: {
      attributes: {
        class: 'safaridesk-editor-content',
        'data-placeholder': 'Start writing…',
      },
      // Strip font-size/font-family from pasted content to prevent layout chaos.
      // Our own FontSize marks are applied programmatically, not via paste.
      transformPastedHTML: (html: string) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        div.querySelectorAll('[style]').forEach((el) => {
          const h = el as HTMLElement;
          h.style.removeProperty('font-size');
          h.style.removeProperty('font-family');
          if (!h.style.cssText.trim()) h.removeAttribute('style');
        });
        return div.innerHTML;
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault();
          openLinkDialogRef.current?.();
          return true;
        }
        return false;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false; // internal node reorder — let TipTap handle
        const file = event.dataTransfer?.files?.[0];
        if (!file?.type.startsWith('image/')) return false;
        event.preventDefault();
        const ext = file.type.split('/')[1] || 'png';
        const named = file.name ? file : new File([file], `dropped-image.${ext}`, { type: file.type });
        void handleImageUploadRef.current?.(named);
        return true;
      },
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items || []);

        // If clipboard has HTML let TipTap parse it natively — this is the original
        // Ctrl+V behaviour for images copied from webpages: ResizableImage.parseHTML
        // picks up <img src="..."> and inserts with the original URL unchanged.
        if (items.some((item) => item.type === 'text/html')) return false;

        // Only intercept raw binary image data (screenshots, direct image copy).
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (!imageItem) return false;
        event.preventDefault();
        const raw = imageItem.getAsFile();
        if (!raw) return false;
        // getAsFile() on clipboard items often produces an empty filename; the
        // backend extension-validator rejects empty extensions, so ensure a name.
        const ext = raw.type.split('/')[1] || 'png';
        const file = raw.name ? raw : new File([raw], `pasted-image.${ext}`, { type: raw.type });
        void handleImageUploadRef.current?.(file);
        return true;
      },
    },
  });

  // ── Editor-aware upload (needs editor in scope) ──────────────────────────────
  const editorAwareUpload = useCallback(async (file: File) => {
    if (!editor) return;
    const uploader = onImageUpload || fallbackUpload;
    setUploadingImage(true);
    try {
      const rawUrl = await uploader(file);
      const finalUrl = resolveImageUrl(rawUrl);
      editor.chain().focus().insertContent(
        `<img src="${finalUrl}" alt="${file.name.replace(/"/g, '&quot;')}" width="300"><p></p>`
      ).run();
      setShowImageModal(false);
      setImageUrl('');
      setImageAlt('');
      setUploadingImage(false);
    } catch (err) {
      // Upload failed — show a warning and fall back to base64 so the image still appears in the editor.
      // The data: URI will also display correctly in article read mode.
      const axiosError = err as any;
      const backendMsg = axiosError?.response?.data?.error;
      const message = backendMsg || (err instanceof Error ? err.message : 'Image upload failed');
      errorNotification(`Upload failed: ${message}. Image embedded as base64.`);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        setUploadingImage(false);
        if (!dataUrl || !editor) return;
        editor.chain().focus().insertContent(
          `<img src="${dataUrl}" alt="${file.name.replace(/"/g, '&quot;')}" width="300"><p></p>`
        ).run();
        setShowImageModal(false);
        setImageUrl('');
        setImageAlt('');
      };
      reader.readAsDataURL(file);
    }
  }, [editor, onImageUpload, fallbackUpload, resolveImageUrl]);

  handleImageUploadRef.current = editorAwareUpload;

  // ── Callbacks that depend on editor ──────────────────────────────────────────
  const openLinkDialog = useCallback(() => {
    const existing = editor?.getAttributes('link').href || '';
    setLinkUrl(existing);
    setShowLinkDialog(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }, [editor]);
  openLinkDialogRef.current = openLinkDialog;

  const applyLink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setShowLinkDialog(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (editorChangedRef.current) {
      editorChangedRef.current = false;
      return; // change originated from the editor itself — don't reset
    }
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      // Content was pushed from the parent (save completed) — mark clean
      markClean();
    }
  }, [content, editor, markClean]);

  useEffect(() => {
    if (!autosaveKey || !editor || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    try {
      const draft = localStorage.getItem(autosaveKey);
      if (draft && draft !== '<p></p>' && draft !== content) {
        setDraftContent(draft);
        setShowRestoreBanner(true);
      }
    } catch { /* localStorage unavailable */ }
  }, [editor, autosaveKey, content]);

  useEffect(() => {
    if (!warnOnNavigation) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [warnOnNavigation]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showImageModal) {
        setShowImageModal(false); setImageUrl(''); setImageAlt('');
        setUrlError(null); setUrlWarning(null);
      } else if (showTableModal) {
        setShowTableModal(false);
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [showImageModal, showTableModal]);

  // ── Early-return guard (all hooks above this line) ───────────────────────────
  if (!editor) {
    return <div className="h-96 animate-pulse rounded-lg" style={{ background: 'var(--surface-muted)' }} />;
  }

  // ── Non-hook helpers ─────────────────────────────────────────────────────────
  const closeAllDropdowns = () => {
    setShowHeadingDropdown(false);
    setShowColorPicker(false);
    setShowHighlightPicker(false);
  };

  const getButtonClasses = (isActive = false) => isActive ? 'active' : '';

  // Returns the label for the current text style — matches the dropdown menu items exactly.
  const getCurrentHeadingLabel = (): string => {
    const { fontSize: activeSize } = editor.getAttributes('textStyle') as { fontSize?: string };
    for (const { level, label, fontSize } of HEADING_LEVELS) {
      if (level === 0) continue;
      if (editor.isActive('heading', { level: level as 1 | 2 | 3 })) return label;
      // Legacy inline-size marks (old hybrid mode) also map to the same friendly name
      if (activeSize && activeSize === fontSize) return label;
    }
    return 'Body';
  };

  // Heading apply: always converts the whole paragraph to the chosen heading level.
  // "Body text" converts back to a plain paragraph and clears any inline size marks.
  const applyHeadingOrStyle = (level: number, _fontSize: string, _fontWeight: string) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().unsetFontSize().unsetInlineFontWeight().run();
    } else {
      editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
    }
    setShowHeadingDropdown(false);
  };

  // Smart code toggle: text selected → inline code; cursor only → code block
  const handleCodeToggle = () => {
    if (editor.isActive('codeBlock')) {
      editor.chain().focus().toggleCodeBlock().run();
    } else if (!editor.state.selection.empty) {
      editor.chain().focus().toggleCode().run();
    } else {
      editor.chain().focus().toggleCodeBlock().run();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      void editorAwareUpload(file);
    } else {
      setDropError('Only image files can be dropped here.');
      setTimeout(() => setDropError(null), 3000);
    }
  };

  const handleUrlImageInsert = () => {
    const { url, warning } = normalizeImageUrl(imageUrl);
    if (!url) {
      setUrlError(warning || 'Enter a valid https:// image URL.');
      return;
    }
    setUrlError(null);
    editor.chain().focus().insertContent(
      `<img src="${url}" alt="${(imageAlt || 'Image').replace(/"/g, '&quot;')}" width="300"><p></p>`
    ).run();
    setShowImageModal(false);
    setImageUrl('');
    setImageAlt('');
    setUrlWarning(null);
  };

  const handleUrlChange = (val: string) => {
    setImageUrl(val);
    setUrlError(null);
    if (val.trim()) {
      const { warning } = normalizeImageUrl(val);
      setUrlWarning(warning || null);
    } else {
      setUrlWarning(null);
    }
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
    setShowTableModal(false);
  };

  const restoreDraft = () => {
    if (!draftContent) return;
    editor.commands.setContent(draftContent);
    onChange(draftContent);
    setShowRestoreBanner(false);
    setDraftContent(null);
  };

  const discardDraft = () => {
    if (autosaveKey) {
      try { localStorage.removeItem(autosaveKey); } catch { /* noop */ }
    }
    setShowRestoreBanner(false);
    setDraftContent(null);
  };

  const currentLabel = getCurrentHeadingLabel();
  const activeTextColor = (editor.getAttributes('textStyle') as { color?: string }).color ?? '';
  const activeBgColor   = (editor.getAttributes('textStyle') as { backgroundColor?: string }).backgroundColor ?? '';

  return (
    <>
    <ConfirmDialog
      show={blocker.state === 'blocked'}
      title="Unsaved changes"
      message="You have unsaved changes. If you leave now your changes will be lost."
      confirmText="Leave"
      cancelText="Stay"
      variant="warning"
      cancel={() => blocker.reset?.()}
      onConfirm={() => { dirtyRef.current = false; setIsDirty(false); blocker.proceed?.(); }}
    />
    <div className={`safaridesk-editor-wrapper ${className}`}>

      {/* Draft restore banner */}
      {showRestoreBanner && (
        <div className="safaridesk-editor-draft-banner flex items-center justify-between px-3 py-1.5 bg-[var(--status-info-bg)] border-b border-[var(--border-color)]">
          <span className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">Unsaved draft found</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={restoreDraft} className="flex items-center gap-1 text-[length:var(--font-meta)] text-[var(--primary-600,#2563eb)] hover:underline">
              <RotateCcw size={11} /> Restore
            </button>
            <button type="button" onClick={discardDraft} className="text-[length:var(--font-meta)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Bubble menu — appears on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top' }}
        shouldShow={({ editor: e, state }) => {
          const { empty } = state.selection;
          return !empty && !e.isActive('image') && !e.isActive('resizableImage');
        }}
      >
        <div className="safaridesk-bubble-menu">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`bubble-btn ${editor.isActive('bold') ? 'active' : ''}`} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`bubble-btn ${editor.isActive('italic') ? 'active' : ''}`} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`bubble-btn ${editor.isActive('underline') ? 'active' : ''}`} title="Underline">
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`bubble-btn ${editor.isActive('strike') ? 'active' : ''}`} title="Strikethrough">
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <div className="bubble-divider" />
          <button type="button" onClick={() => openLinkDialog()} className={`bubble-btn ${editor.isActive('link') ? 'active' : ''}`} title="Link">
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().run()} className="bubble-btn" title="Clear inline formatting">
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      </BubbleMenu>

      {/* Toolbar */}
      <div className="safaridesk-editor-toolbar">
        <div className="flex flex-wrap items-center gap-1.5">

          {/* ── Text style dropdown ── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowHeadingDropdown(v => !v); setShowColorPicker(false); setShowHighlightPicker(false); }}
              className={`dropdown-button ${showHeadingDropdown ? 'active' : ''}`}
              title="Text style — applies to the whole paragraph"
            >
              <span className="sd-style-label">{currentLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            </button>

            {showHeadingDropdown && (
              <div className="safaridesk-editor-dropdown sd-heading-dropdown">
                <div className="sd-dropdown-hint">Applies to whole paragraph</div>
                {HEADING_LEVELS.map(({ level, label, fontSize, fontWeight }) => {
                  const tsAttrs = editor.getAttributes('textStyle') as { fontSize?: string };
                  const isActiveBlock = level === 0
                    ? (!editor.isActive('heading', { level: 1 }) && !editor.isActive('heading', { level: 2 }) && !editor.isActive('heading', { level: 3 }) && !tsAttrs.fontSize)
                    : editor.isActive('heading', { level: level as 1 | 2 | 3 });
                  const isActiveInline = level > 0 && tsAttrs.fontSize === fontSize;
                  const isActive = isActiveBlock || isActiveInline;

                  return (
                    <button
                      key={level}
                      type="button"
                      className={`sd-style-item ${isActive ? 'active' : ''}`}
                      onClick={() => applyHeadingOrStyle(level, fontSize, fontWeight)}
                    >
                      <span className="sd-style-name">{label}</span>
                      <span className="sd-style-sample" style={{ fontSize, fontWeight: fontWeight as React.CSSProperties['fontWeight'] }}>Aa</span>
                      {isActive && <Check className="sd-style-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sd-sep" />

          {/* ── Inline formatting ── */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={getButtonClasses(editor.isActive('bold'))} title="Bold (Ctrl+B)">
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={getButtonClasses(editor.isActive('italic'))} title="Italic (Ctrl+I)">
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={getButtonClasses(editor.isActive('underline'))} title="Underline (Ctrl+U)">
              <UnderlineIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={getButtonClasses(editor.isActive('strike'))} title="Strikethrough">
              <Strikethrough className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()} className={getButtonClasses(editor.isActive('subscript'))} title="Subscript">
              <span style={{ fontSize: '0.75rem', lineHeight: 1, letterSpacing: '-0.02em', display: 'inline-block' }}>x₂</span>
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()} className={getButtonClasses(editor.isActive('superscript'))} title="Superscript">
              <span style={{ fontSize: '0.75rem', lineHeight: 1, letterSpacing: '-0.02em', display: 'inline-block' }}>x²</span>
            </button>
          </div>

          <div className="sd-sep" />

          {/* ── Text color picker ── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowColorPicker(v => !v); setShowHeadingDropdown(false); setShowHighlightPicker(false); }}
              className={`${getButtonClasses(showColorPicker)} sd-color-btn`}
              title="Text colour"
            >
              <Palette className="h-4 w-4" />
              <span
                className="sd-color-swatch"
                style={{ background: (editor.getAttributes('textStyle') as { color?: string }).color || '#374151' }}
              />
            </button>
            {showColorPicker && (
              <div className="safaridesk-editor-dropdown sd-color-dropdown">
                {TEXT_COLORS.map((c) => {
                  const isActive = c.value ? activeTextColor === c.value : !activeTextColor;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className="sd-color-item"
                      onClick={() => {
                        if (c.value) editor.chain().focus().setColor(c.value).run();
                        else editor.chain().focus().unsetColor().run();
                        setShowColorPicker(false);
                      }}
                    >
                      <span className="sd-color-dot" style={{ background: c.value || '#374151' }} />
                      <span style={{ color: c.value || undefined }}>{c.label}</span>
                      {isActive && <Check className="ml-auto h-3 w-3 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Highlight / background color ── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowHighlightPicker(v => !v); setShowHeadingDropdown(false); setShowColorPicker(false); }}
              className={`${getButtonClasses(showHighlightPicker)} sd-color-btn`}
              title="Highlight / background colour"
            >
              <Highlighter className="h-4 w-4" />
              <span
                className="sd-color-swatch"
                style={{ background: (editor.getAttributes('textStyle') as { backgroundColor?: string }).backgroundColor || 'transparent', border: '1px solid #d1d5db' }}
              />
            </button>
            {showHighlightPicker && (
              <div className="safaridesk-editor-dropdown sd-color-dropdown">
                {HIGHLIGHT_COLORS.map((c) => {
                  const isActive = c.value ? activeBgColor === c.value : !activeBgColor;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className="sd-color-item"
                      onClick={() => {
                        if (c.value) editor.chain().focus().setHighlight(c.value).run();
                        else editor.chain().focus().unsetHighlight().run();
                        setShowHighlightPicker(false);
                      }}
                    >
                      <span
                        className="sd-color-dot"
                        style={{ background: c.value || 'transparent', border: c.value ? undefined : '1px solid #d1d5db' }}
                      />
                      <span>{c.label}</span>
                      {isActive && <Check className="ml-auto h-3 w-3 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Clear all formatting ── */}
          <button
            type="button"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().setTextAlign('left').run()}
            className={getButtonClasses()}
            title="Clear all formatting"
          >
            <Eraser className="h-4 w-4" />
          </button>

          <div className="sd-sep" />

          {/* ── Text alignment ── */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={getButtonClasses(editor.isActive({ textAlign: 'left' }) || (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' })))}
              title="Align Left">
              <AlignLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={getButtonClasses(editor.isActive({ textAlign: 'center' }))} title="Centre">
              <AlignCenter className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={getButtonClasses(editor.isActive({ textAlign: 'right' }))} title="Align Right">
              <AlignRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={getButtonClasses(editor.isActive({ textAlign: 'justify' }))} title="Justify">
              <AlignJustify className="h-4 w-4" />
            </button>
          </div>

          <div className="sd-sep" />

          {/* ── Lists, quotes, indent ── */}
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={getButtonClasses(editor.isActive('bulletList'))} title="Bullet list">
              <List className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={getButtonClasses(editor.isActive('orderedList'))} title="Numbered list">
              <ListOrdered className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={getButtonClasses(editor.isActive('blockquote'))} title="Blockquote">
              <Quote className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
              disabled={!editor.can().sinkListItem('listItem')}
              className={`${getButtonClasses()} disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Indent (Tab)"
            >
              <Indent className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
              disabled={!editor.can().liftListItem('listItem')}
              className={`${getButtonClasses()} disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Outdent (Shift+Tab)"
            >
              <Outdent className="h-4 w-4" />
            </button>
          </div>

          <div className="sd-sep" />

          {/* ── Code, media, links ── */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCodeToggle}
              className={getButtonClasses(editor.isActive('codeBlock') || editor.isActive('code'))}
              title="Code — select text for inline, cursor for block"
            >
              <Code className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setShowImageModal(true)} className={getButtonClasses()} title="Insert image">
              <ImageIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => openLinkDialog()} className={getButtonClasses(editor.isActive('link'))} title="Insert / edit link (Ctrl+K)">
              <LinkIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setShowTableModal(true)} className={getButtonClasses()} title="Insert table">
              <TableIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={getButtonClasses()} title="Horizontal rule / divider">
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* ── Table controls (context-sensitive) ── */}
          {editor.isActive('table') && (
            <>
              <div className="sd-sep" />
              <div className="flex items-center gap-0.5 flex-wrap">
                <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={`${getButtonClasses()} flex items-center gap-1 px-1.5`} title="Add row below">
                  <Rows3 className="h-3.5 w-3.5" /><Plus className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={`${getButtonClasses()} flex items-center gap-1 px-1.5`} title="Add column right">
                  <Columns3 className="h-3.5 w-3.5" /><Plus className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={`${getButtonClasses()} flex items-center gap-1 px-1.5`} title="Delete row">
                  <Rows3 className="h-3.5 w-3.5" /><Minus className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={`${getButtonClasses()} flex items-center gap-1 px-1.5`} title="Delete column">
                  <Columns3 className="h-3.5 w-3.5" /><Minus className="h-3 w-3" />
                </button>
              </div>
            </>
          )}

          <div className="sd-sep" />

          {/* ── Undo / Redo ── */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className={`${getButtonClasses()} disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className={`${getButtonClasses()} disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}

      {showTableModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="safaridesk-editor-table-modal w-80 shadow-xl">
            <h3 className="text-[length:var(--font-section-title)] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Insert Table</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[length:var(--font-label)] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Rows: {tableRows}</label>
                <input type="range" min="1" max="10" value={tableRows} onChange={(e) => setTableRows(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: 'var(--surface-muted)', accentColor: 'var(--primary-500, #2563eb)' }} />
              </div>
              <div>
                <label className="block text-[length:var(--font-label)] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Columns: {tableCols}</label>
                <input type="range" min="1" max="10" value={tableCols} onChange={(e) => setTableCols(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: 'var(--surface-muted)', accentColor: 'var(--primary-500, #2563eb)' }} />
              </div>
              <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setShowTableModal(false)} className="px-4 py-2 text-[length:var(--font-label)] font-medium rounded-[var(--shell-radius)]" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="button" onClick={insertTable} className="px-4 py-2 text-[length:var(--font-label)] font-medium rounded-[var(--shell-radius)] text-white" style={{ background: 'var(--primary-600,#2563eb)' }}>Insert Table</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="safaridesk-editor-table-modal w-[26rem] shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[length:var(--font-section-title)] font-semibold" style={{ color: 'var(--text-primary)' }}>Insert Image</h3>
              <button type="button" onClick={() => { setShowImageModal(false); setImageUrl(''); setImageAlt(''); setUrlError(null); setUrlWarning(null); }} style={{ color: 'var(--text-muted)' }} className="hover:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <nav className="-mb-px flex space-x-6">
                <button
                  type="button"
                  onClick={() => setImageUploadMode('file')}
                  className="py-2 px-1 border-b-2 text-[length:var(--font-label)] font-medium"
                  style={imageUploadMode === 'file'
                    ? { borderColor: 'var(--primary-500,#2563eb)', color: 'var(--primary-600,#2563eb)' }
                    : { borderColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={() => setImageUploadMode('url')}
                  className="py-2 px-1 border-b-2 text-[length:var(--font-label)] font-medium"
                  style={imageUploadMode === 'url'
                    ? { borderColor: 'var(--primary-500,#2563eb)', color: 'var(--primary-600,#2563eb)' }
                    : { borderColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  From URL
                </button>
              </nav>
            </div>

            {imageUploadMode === 'file' && (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
                style={{
                  borderColor: dragActive ? 'var(--primary-500,#2563eb)' : 'var(--border-color)',
                  background: dragActive ? 'var(--status-info-bg)' : 'transparent',
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void editorAwareUpload(f); e.currentTarget.value = ''; }}
                  className="hidden"
                  id="image-upload"
                  ref={fileInputRef}
                />
                {uploadingImage
                  ? <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent mx-auto mb-3" style={{ borderColor: 'var(--primary-500,#2563eb)', borderTopColor: 'transparent' }} />
                  : <ImageIcon className="h-10 w-10 mx-auto mb-3" style={{ color: dragActive ? 'var(--primary-500,#2563eb)' : 'var(--text-muted)' }} />
                }
                <p className="text-[length:var(--font-label)] mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {uploadingImage ? 'Uploading…' : dragActive ? 'Drop image here' : 'Click to browse or drag & drop'}
                </p>
                <p className="text-[length:var(--font-meta)] mb-4" style={{ color: 'var(--text-muted)' }}>PNG, JPG, GIF, WEBP up to 10 MB</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-4 py-2 text-[length:var(--font-label)] font-medium rounded-[var(--shell-radius)] text-white disabled:opacity-50 inline-flex items-center gap-2"
                  style={{ background: 'var(--primary-600,#2563eb)' }}
                >
                  <Upload className="h-4 w-4" /> Choose file
                </button>
              </div>
            )}

            {imageUploadMode === 'url' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[length:var(--font-label)] font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    Image URL
                    <span className="ml-1.5 text-[length:var(--font-meta)] font-normal" style={{ color: 'var(--text-muted)' }}>(https://…)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUrlImageInsert(); }}
                    className="w-full px-3 py-2 text-[length:var(--font-body)] rounded-[var(--shell-radius)] focus:outline-none"
                    style={{
                      border: `1px solid ${urlError ? 'var(--status-danger-border)' : 'var(--border-color)'}`,
                      background: 'var(--surface-muted)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {urlError && (
                    <p className="flex items-center gap-1 mt-1 text-[length:var(--font-meta)]" style={{ color: 'var(--status-danger-text)' }}>
                      <AlertCircle className="h-3 w-3" /> {urlError}
                    </p>
                  )}
                  {urlWarning && !urlError && (
                    <p className="flex items-center gap-1 mt-1 text-[length:var(--font-meta)]" style={{ color: 'var(--status-warning-text)' }}>
                      <AlertCircle className="h-3 w-3" /> {urlWarning}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[length:var(--font-label)] font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    Alt text <span className="text-[length:var(--font-meta)] font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Describe the image"
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    className="w-full px-3 py-2 text-[length:var(--font-body)] rounded-[var(--shell-radius)] focus:outline-none"
                    style={{ border: '1px solid var(--border-color)', background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
                  />
                </div>
                {imageUrl && !urlError && (
                  <div className="rounded-[var(--shell-radius)] overflow-hidden" style={{ border: '1px solid var(--border-color)', background: 'var(--surface-muted)' }}>
                    <img
                      src={normalizeImageUrl(imageUrl).url || imageUrl}
                      alt={imageAlt || 'Preview'}
                      className="max-w-full h-40 object-contain mx-auto block"
                      onError={(e) => {
                        e.currentTarget.parentElement!.innerHTML =
                          '<p style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:1.5rem 1rem">Preview unavailable — the server may block cross-origin requests. The image will still insert.</p>';
                      }}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowImageModal(false); setImageUrl(''); setImageAlt(''); setUrlError(null); setUrlWarning(null); }} className="px-4 py-2 text-[length:var(--font-label)]" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                  <button type="button" onClick={handleUrlImageInsert} disabled={!imageUrl.trim()} className="px-4 py-2 text-[length:var(--font-label)] font-medium rounded-[var(--shell-radius)] text-white disabled:opacity-50" style={{ background: 'var(--primary-600,#2563eb)' }}>
                    Insert image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLinkDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="safaridesk-editor-table-modal w-80 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">Insert link</h3>
              <button type="button" onClick={() => setShowLinkDialog(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                ref={linkInputRef}
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                  if (e.key === 'Escape') setShowLinkDialog(false);
                }}
                className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary-500,#2563eb)] focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                {editor.isActive('link') && (
                  <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkDialog(false); }} className="px-3 py-1.5 text-[length:var(--font-label)] text-[var(--status-danger-text)] hover:underline">
                    Remove
                  </button>
                )}
                <button type="button" onClick={() => setShowLinkDialog(false)} className="px-3 py-1.5 text-[length:var(--font-label)] text-[var(--text-secondary)]">Cancel</button>
                <button type="button" onClick={applyLink} className="px-3 py-1.5 text-[length:var(--font-label)] rounded-[var(--shell-radius)] bg-[var(--primary-600,#2563eb)] text-white hover:opacity-90">Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop error */}
      {dropError && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-1.5 text-[length:var(--font-meta)] text-[var(--status-danger-text)] shadow-md z-10">
          {dropError}
        </div>
      )}

      {/* Editor content */}
      <div className="min-h-[400px]" style={{ background: 'transparent' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Status bar */}
      <div className="safaridesk-editor-status flex justify-between items-center">
        <div className="flex gap-5">
          <span>Words: {editor.storage.characterCount?.words() || 0}</span>
          <span>Characters: {editor.storage.characterCount?.characters() || 0}</span>
        </div>
        {autosaveKey && (
          <span className="text-[length:var(--font-meta)] text-[var(--text-muted)]">Draft autosaved</span>
        )}
      </div>

      {/* Click-outside dismissal */}
      {(showHeadingDropdown || showColorPicker || showHighlightPicker) && (
        <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
      )}

    </div>
    </>
  );
});

SafariDeskEditor.displayName = 'SafariDeskEditor';

export default SafariDeskEditor;

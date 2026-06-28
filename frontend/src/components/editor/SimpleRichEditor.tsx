import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { createPopper, type Instance as PopperInstance, type VirtualElement } from '@popperjs/core';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Quote,
    Code,
    Link as LinkIcon
} from 'lucide-react';
import { AttachmentTrigger } from '../ui/AttachmentTrigger';

interface SimpleRichEditorProps {
    content: string;
    onChange: (content: string) => void;
    onSubmitShortcut?: () => void;
    disabled?: boolean;
    onAttachmentClick?: () => void;
    showAttachment?: boolean;
    onImagePaste?: (file: File) => Promise<string | null>; // Returns URL after upload, or null to use base64
    mentionUsers?: MentionUser[];
}

export interface MentionUser {
    id: number;
    displayName: string;
    email?: string;
    avatarUrl?: string;
}

/**
 * Lightweight TipTap WYSIWYG editor for activity stream comments/replies.
 * Supports: Bold, Italic, Underline, Bullet List, Numbered List, Quote, Code, Link, Image Paste
 */
export const SimpleRichEditor: React.FC<SimpleRichEditorProps> = ({
    content,
    onChange,
    onSubmitShortcut,
    disabled = false,
    onAttachmentClick,
    showAttachment = true,
    onImagePaste,
    mentionUsers = [],
}) => {
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    const mentionVisibleRef = useRef(false);
    const mentionListRef = useRef<MentionUser[]>([]);
    const mentionDropdownRef = useRef<HTMLDivElement | null>(null);
    const popperInstanceRef = useRef<PopperInstance | null>(null);
    const [caretRect, setCaretRect] = useState<DOMRect | null>(null);

    const filteredMentionUsers = useMemo(() => {
        if (!mentionUsers.length) return [];
        const query = mentionQuery.trim().toLowerCase();
        if (!query) return mentionUsers.slice(0, 6);

        return mentionUsers
            .filter((user) =>
                user.displayName.toLowerCase().includes(query) ||
                (user.email || '').toLowerCase().includes(query)
            )
            .slice(0, 6);
    }, [mentionUsers, mentionQuery]);

    useEffect(() => {
        mentionVisibleRef.current = showMentions;
    }, [showMentions]);

    // Helper: Get caret position in the editor
    const getCaretRect = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0).cloneRange();
        if (!range.collapsed) return null;
        // Insert a temporary span to get the caret position
        const tempSpan = document.createElement('span');
        // Zero-width non-breaking space
        tempSpan.appendChild(document.createTextNode('\u200b'));
        range.insertNode(tempSpan);
        const rect = tempSpan.getBoundingClientRect();
        tempSpan.parentNode?.removeChild(tempSpan);
        return rect;
    };

    useEffect(() => {
        mentionListRef.current = filteredMentionUsers;
    }, [filteredMentionUsers]);

    // Update caret rect when mention menu is shown or selection changes
    useEffect(() => {
        if (!showMentions) {
            setCaretRect(null);
            return;
        }
        // Timeout to allow TipTap to update DOM
        const updateCaret = () => {
            setTimeout(() => {
                setCaretRect(getCaretRect());
            }, 0);
        };
        updateCaret();
        document.addEventListener('selectionchange', updateCaret);

        // Close dropdown on click outside
        const handleClick = (e: MouseEvent) => {
            if (
                mentionDropdownRef.current &&
                e.target instanceof Node &&
                mentionDropdownRef.current.contains(e.target)
            ) {
                // Click inside dropdown, do nothing
                return;
            }
            closeMentionMenu();
        };
        document.addEventListener('mousedown', handleClick);

        // Close dropdown if caret is scrolled out of view
        const handleScroll = () => {
            const rect = getCaretRect();
            if (!rect) return;
            const inViewport =
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth);
            if (!inViewport) {
                closeMentionMenu();
            }
        };
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('selectionchange', updateCaret);
            document.removeEventListener('mousedown', handleClick);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [showMentions, mentionQuery]);

    const closeMentionMenu = () => {
        setShowMentions(false);
        setMentionQuery('');
        setMentionStart(null);
        setSelectedMentionIndex(0);
        setCaretRect(null);
    };
    // Convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false, // No headings for simple editor
                codeBlock: false, // Just inline code
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 dark:text-blue-400 underline',
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-md my-2',
                },
            }),
        ],
        content,
        editable: !disabled,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());

            // Mention detection from editor text near the cursor.
            if (!mentionUsers.length) {
                closeMentionMenu();
                return;
            }

            const cursor = editor.state.selection.from;
            const textBeforeCursor = editor.state.doc.textBetween(0, cursor, '\n', '\n');
            const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([A-Za-z0-9._-]*)$/);

            if (!mentionMatch) {
                closeMentionMenu();
                return;
            }

            const query = mentionMatch[1] || '';
            const mentionTriggerLength = query.length + 1; // include '@'
            const from = cursor - mentionTriggerLength;

            setMentionQuery(query);
            setMentionStart(from);
            setShowMentions(true);
            setSelectedMentionIndex(0);
        },
        editorProps: {
            attributes: {
                class: 'focus:outline-none text-sm text-gray-900 dark:text-[var(--text-primary)] [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_ul]:pl-5 [&_ol]:pl-5 [&_blockquote]:m-0 [&_blockquote]:pl-3 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300',
            },
            handlePaste: (view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (!file) continue;

                        // Handle image paste
                        (async () => {
                            let imageUrl: string | null = null;

                            // If parent provides upload handler, use it
                            if (onImagePaste) {
                                imageUrl = await onImagePaste(file);
                            }

                            // Fallback to base64 if no URL returned
                            if (!imageUrl) {
                                imageUrl = await fileToBase64(file);
                            }

                            // Insert image into editor
                            view.dispatch(
                                view.state.tr.replaceSelectionWith(
                                    view.state.schema.nodes.image.create({ src: imageUrl })
                                )
                            );
                        })();

                        return true;
                    }
                }
                return false;
            },
            handleKeyDown: (_view, event) => {
                const key = event.key.toLowerCase();
                const hasModifier = event.ctrlKey || event.metaKey;

                // Preserve standard clipboard/edit shortcuts and let the editor/browser handle them.
                if (hasModifier && ['c', 'v', 'x', 'z', 'y', 'a'].includes(key)) {
                    return false;
                }

                // Submit shortcut used by activity comment input.
                if (hasModifier && key === 'enter' && onSubmitShortcut) {
                    event.preventDefault();
                    onSubmitShortcut();
                    return true;
                }

                if (!mentionVisibleRef.current || mentionListRef.current.length === 0) {
                    return false;
                }

                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelectedMentionIndex((prev) => {
                        const max = mentionListRef.current.length - 1;
                        return prev < max ? prev + 1 : 0;
                    });
                    return true;
                }

                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelectedMentionIndex((prev) => {
                        const max = mentionListRef.current.length - 1;
                        return prev > 0 ? prev - 1 : max;
                    });
                    return true;
                }

                if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault();
                    const user = mentionListRef.current[selectedMentionIndex] || mentionListRef.current[0];
                    if (user) {
                        // Defer insertion until state updates settle.
                        setTimeout(() => {
                            if (!editor) return;
                            const currentCursor = editor.state.selection.from;
                            const from = mentionStart ?? currentCursor;
                            editor
                                .chain()
                                .focus()
                                .insertContentAt({ from, to: currentCursor }, `@${user.displayName} `)
                                .run();
                            closeMentionMenu();
                        }, 0);
                    }
                    return true;
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMentionMenu();
                    return true;
                }

                return false;
            },
        },
    });

    // Sync content from parent
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    // Update editable state
    useEffect(() => {
        if (editor) {
            editor.setEditable(!disabled);
        }
    }, [disabled, editor]);

    // Popper: Virtual element for caret
    const virtualCaret: VirtualElement | null = caretRect
        ? {
            getBoundingClientRect: () => caretRect,
            contextElement: editor?.view.dom as HTMLElement,
        }
        : null;

    // Popper: Setup and update
    useEffect(() => {
        if (!showMentions || !mentionDropdownRef.current || !virtualCaret) {
            if (popperInstanceRef.current) {
                popperInstanceRef.current.destroy();
                popperInstanceRef.current = null;
            }
            return;
        }
        popperInstanceRef.current = createPopper(virtualCaret, mentionDropdownRef.current, {
            placement: 'bottom-start',
            modifiers: [
                { name: 'flip', options: { fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] } },
                { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
                { name: 'offset', options: { offset: [0, 4] } },
            ],
        });
        return () => {
            if (popperInstanceRef.current) {
                popperInstanceRef.current.destroy();
                popperInstanceRef.current = null;
            }
        };
    }, [showMentions, caretRect, mentionQuery, filteredMentionUsers, virtualCaret]);

    if (!editor) {
        return <div className="h-6 bg-gray-100 dark:bg-surface-elevated animate-pulse rounded" />;
    }

    const selectMention = (user: MentionUser) => {
        const currentCursor = editor.state.selection.from;
        const from = mentionStart ?? currentCursor;

        editor
            .chain()
            .focus()
            .insertContentAt({ from, to: currentCursor }, `@${user.displayName} `)
            .run();

        closeMentionMenu();
    };

    const addLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl || 'https://');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    const buttonClass = (isActive = false) =>
        `p-1.5 rounded transition-colors ${isActive
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-300/70 dark:ring-primary-700/60'
            : 'text-gray-500 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

    return (
        <div>
            {/* Editor Content - override global min-height, remove focus outline */}
            <div className="relative">
                <EditorContent
                    editor={editor}
                    className="simple-rich-editor [&_.ProseMirror]:!min-h-[60px] [&_.ProseMirror]:!p-0 [&_.ProseMirror]:!outline-none [&_.ProseMirror:focus-visible]:!outline-none"
                />

                {showMentions && filteredMentionUsers.length > 0 && (
                    <div
                        ref={mentionDropdownRef}
                        className="mention-dropdown bg-white dark:bg-surface-elevated border border-gray-200 dark:border-subtle rounded-lg shadow-lg max-h-56 overflow-y-auto"
                        data-popper-placement
                    >
                        {filteredMentionUsers.map((user, index) => (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => selectMention(user)}
                                onMouseEnter={() => setSelectedMentionIndex(index)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${index === selectedMentionIndex
                                        ? 'bg-gray-100 dark:bg-surface-hover'
                                        : 'hover:bg-gray-50 dark:hover:bg-surface-hover'
                                    }`}
                            >
                                <img
                                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=06A561&color=fff&size=32`}
                                    alt={user.displayName}
                                    className="size-6 rounded-full"
                                />
                                <div className="min-w-0">
                                    <div className="truncate font-medium text-gray-900 dark:text-[var(--text-primary)]">{user.displayName}</div>
                                    {user.email && (
                                        <div className="truncate text-xs text-gray-500 dark:text-[var(--text-muted)]">{user.email}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Toolbar - thin line separator */}
            <div className="flex items-center gap-0.5 px-1 py-1.5 border-t border-gray-200 dark:border-subtle">
                {/* Text Formatting */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={buttonClass(editor.isActive('bold'))}
                    title="Bold"
                    disabled={disabled}
                >
                    <Bold size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={buttonClass(editor.isActive('italic'))}
                    title="Italic"
                    disabled={disabled}
                >
                    <Italic size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={buttonClass(editor.isActive('underline'))}
                    title="Underline"
                    disabled={disabled}
                >
                    <UnderlineIcon size={16} />
                </button>

                <div className="w-px h-4 bg-gray-300 dark:bg-surface-hover mx-1" />

                {/* Lists */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={buttonClass(editor.isActive('bulletList'))}
                    title="Bullet List"
                    disabled={disabled}
                >
                    <List size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={buttonClass(editor.isActive('orderedList'))}
                    title="Numbered List"
                    disabled={disabled}
                >
                    <ListOrdered size={16} />
                </button>

                <div className="w-px h-4 bg-gray-300 dark:bg-surface-hover mx-1" />

                {/* Block Elements */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={buttonClass(editor.isActive('blockquote'))}
                    title="Quote"
                    disabled={disabled}
                >
                    <Quote size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    className={buttonClass(editor.isActive('code'))}
                    title="Inline Code"
                    disabled={disabled}
                >
                    <Code size={16} />
                </button>

                <div className="w-px h-4 bg-gray-300 dark:bg-surface-hover mx-1" />

                {/* Link */}
                <button
                    type="button"
                    onClick={addLink}
                    className={buttonClass(editor.isActive('link'))}
                    title="Add Link"
                    disabled={disabled}
                >
                    <LinkIcon size={16} />
                </button>

                {/* Attachment */}
                {showAttachment && onAttachmentClick && (
                    <AttachmentTrigger
                        onClick={onAttachmentClick}
                        disabled={disabled}
                        className="ml-1"
                    />
                )}
            </div>
        </div>
    );
};

export default SimpleRichEditor;

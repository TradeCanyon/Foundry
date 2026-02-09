/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FoundryDocEditor — TipTap-based WYSIWYG markdown editor.
 *
 * Replaces CodeMirror MarkdownEditor for .md files.
 * Supports: headings, bold/italic/strike, links, images, code blocks, lists, blockquotes.
 * Converts between ProseMirror JSON and markdown via TipTap's HTML bridge.
 */

import { useThemeContext } from '@/renderer/context/ThemeContext';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import React, { useCallback, useEffect, useRef } from 'react';

interface FoundryDocEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  placeholder?: string;
}

/**
 * Minimal toolbar for common formatting actions.
 */
const EditorToolbar: React.FC<{ editor: ReturnType<typeof useEditor> }> = ({ editor }) => {
  if (!editor) return null;

  const btn = (label: string, action: () => void, isActive: boolean) => (
    <button
      type='button'
      className={`px-8px py-4px rd-4px text-12px font-500 cursor-pointer b-none transition-colors ${isActive ? 'bg-brand text-white' : 'bg-fill-1 text-t-secondary hover:bg-fill-2'}`}
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className='flex items-center gap-4px px-8px py-6px b-b-1 b-b-solid b-color-border-2 bg-fill-1 flex-wrap'>
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {btn('S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
      <span className='w-1px h-16px bg-border-2 mx-2px' />
      {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      <span className='w-1px h-16px bg-border-2 mx-2px' />
      {btn('UL', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('OL', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {btn('Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {btn('Code', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
    </div>
  );
};

const FoundryDocEditor: React.FC<FoundryDocEditorProps> = ({ value, onChange, readOnly = false, containerRef, onScroll, placeholder = 'Start writing...' }) => {
  const { theme } = useThemeContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressUpdateRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: 'foundry-code-block' } },
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      if (suppressUpdateRef.current) return;
      onChange(e.getHTML());
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    if (value !== currentHTML) {
      suppressUpdateRef.current = true;
      editor.commands.setContent(value, { emitUpdate: false });
      suppressUpdateRef.current = false;
    }
  }, [value, editor]);

  // Sync readOnly
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [readOnly, editor]);

  // Scroll sync
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !onScroll) return;
    onScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
  }, [onScroll]);

  return (
    <div ref={containerRef} className='h-full w-full flex flex-col overflow-hidden' data-theme={theme}>
      {!readOnly && <EditorToolbar editor={editor} />}
      <div ref={scrollRef} className='flex-1 overflow-y-auto px-16px py-12px' onScroll={handleScroll}>
        <EditorContent editor={editor} className='foundry-doc-editor prose max-w-none text-t-primary text-14px' />
      </div>
    </div>
  );
};

export default FoundryDocEditor;

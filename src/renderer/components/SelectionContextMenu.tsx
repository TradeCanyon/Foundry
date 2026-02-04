/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from '@icon-park/react';
import { Dropdown, Menu } from '@arco-design/web-react';
import { iconColors } from '@/renderer/theme/colors';

type MenuState = {
  visible: boolean;
  x: number;
  y: number;
  text: string;
};

type RectLike = { left: number; right: number; top: number; bottom: number };

const getInputSelectionText = (target: EventTarget | null): string => {
  if (!(target instanceof HTMLElement)) return '';
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    if (start !== end) {
      return target.value.slice(start, end);
    }
  }
  return '';
};

const isPointInRects = (rects: RectLike[], x: number, y: number): boolean => {
  if (!rects.length) return false;
  return rects.some((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
};

const getSelectionRects = (selection: Selection | null): RectLike[] => {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];
  try {
    const range = selection.getRangeAt(0);
    return Array.from(range.getClientRects()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
  } catch {
    return [];
  }
};

const copyWithExecCommandFallback = (text: string): boolean => {
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

const SelectionContextMenu: React.FC = () => {
  const { t } = useTranslation();
  const lastRightClickRef = useRef<{ at: number; text: string; rects: RectLike[] } | null>(null);
  const [state, setState] = useState<MenuState>({ visible: false, x: 0, y: 0, text: '' });

  const close = () => {
    setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  };

  useEffect(() => {
    const onMouseDownCapture = (e: MouseEvent) => {
      if (e.button !== 2) return;

      const selection = window.getSelection();
      const selectionText = selection?.toString().trim() || '';
      const inputText = getInputSelectionText(e.target).trim();
      const text = selectionText || inputText;

      if (!text) {
        lastRightClickRef.current = null;
        return;
      }

      lastRightClickRef.current = {
        at: Date.now(),
        text,
        rects: getSelectionRects(selection),
      };
    };

    const onContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();

      // Prefer DOM selection.
      let selectedText = selection?.toString().trim() || '';
      const rects = getSelectionRects(selection);
      let shouldIntercept = Boolean(selectedText && isPointInRects(rects, e.clientX, e.clientY));

      // Fallback: selection inside input/textarea.
      if (!shouldIntercept) {
        selectedText = getInputSelectionText(e.target).trim();
        shouldIntercept = Boolean(selectedText);
      }

      // If the act of right-click collapses selection before `contextmenu` fires,
      // fall back to the selection captured on right-mouse-down.
      if (!shouldIntercept) {
        const last = lastRightClickRef.current;
        if (last && Date.now() - last.at < 1000) {
          const lastOk = last.rects.length ? isPointInRects(last.rects, e.clientX, e.clientY) : true;
          if (lastOk) {
            selectedText = last.text;
            shouldIntercept = true;
          }
        }
      }

      if (!shouldIntercept || !selectedText) {
        if (state.visible) close();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setState({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        text: selectedText,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!state.visible) return;
      if (e.key === 'Escape') close();
    };

    const onScroll = () => {
      if (state.visible) close();
    };

    const onWindowResize = () => {
      if (state.visible) close();
    };

    document.addEventListener('mousedown', onMouseDownCapture, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onWindowResize);

    return () => {
      document.removeEventListener('mousedown', onMouseDownCapture, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onWindowResize);
    };
  }, [state.visible]);

  const onCopy = async () => {
    const text = state.text;
    close();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fallback below
    }

    copyWithExecCommandFallback(text);
  };

  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcut = isMac ? '⌘C' : 'Ctrl+C';

  const droplist = (
    <Menu
      selectable={false}
      onClickMenuItem={(key) => {
        if (key === 'copy') void onCopy();
      }}
      className='select-none'
    >
      <Menu.Item key='copy'>
        <div className='flex items-center gap-10px min-w-[120px]'>
          <Copy theme='outline' size='16' fill={iconColors.secondary} />
          <span className='flex-1'>{t('common.copy', { defaultValue: 'Copy' })}</span>
          <span className='text-[color:var(--color-text-3)] text-12px ml-16px'>{shortcut}</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  // Always render the anchor so Dropdown has a target, but control visibility via popupVisible.
  return (
    <Dropdown
      droplist={droplist}
      popupVisible={state.visible}
      onVisibleChange={(visible) => {
        if (!visible) close();
      }}
      trigger='click'
      position='bl'
      getPopupContainer={() => document.body}
    >
      <div
        style={{
          position: 'fixed',
          left: state.x,
          top: state.y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
      />
    </Dropdown>
  );
};

export default SelectionContextMenu;

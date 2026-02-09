/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import ReactMarkdown from 'react-markdown';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs, vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

// Import KaTeX CSS into the document head (fonts propagate into shadow DOM via @font-face)
import 'katex/dist/katex.min.css';

import { ipcBridge } from '@/common';
import { Message } from '@arco-design/web-react';
import { Copy, Down, DownloadOne, Up } from '@icon-park/react';
import { theme } from '@office-ai/platform';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { addImportantToAll } from '../utils/customCssProcessor';
import LocalImageView from './LocalImageView';
import StubCard from './StubCard';

const formatCode = (code: string) => {
  const content = String(code).replace(/\n$/, '');
  try {
    // @todo Can be further beautified
    return JSON.stringify(
      JSON.parse(content),
      (_key, value) => {
        return value;
      },
      2
    );
  } catch (error) {
    return content;
  }
};

const logicRender = <T, F>(condition: boolean, trueComponent: T, falseComponent?: F): T | F => {
  return condition ? trueComponent : falseComponent;
};

function CodeBlock(props: any) {
  const [fold, setFlow] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  React.useEffect(() => {
    const updateTheme = () => {
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setCurrentTheme(theme);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    const { children, className, node: _node, hiddenCodeCopyButton: _hiddenCodeCopyButton, codeStyle: _codeStyle, ...rest } = props;
    const match = (className || '').match(/language-(\w+)/);
    const language = match?.[1] || 'text';
    const codeTheme = currentTheme === 'dark' ? vs2015 : vs;
    const codeStr = String(children);

    // Inline code (single line)
    if (!codeStr.includes('\n')) {
      return (
        <code
          {...rest}
          className={className}
          style={{
            fontWeight: 'bold',
          }}
        >
          {children}
        </code>
      );
    }

    const lineCount = codeStr.split('\n').length;
    const formattedCode = formatCode(children);

    // 50+ lines → StubCard (compact file card, click to expand)
    if (lineCount >= 50) {
      return (
        <div style={{ width: '100%', ...(props.codeStyle || {}) }}>
          <StubCard
            language={language}
            code={formattedCode}
            lineCount={lineCount}
            renderExpanded={() => (
              <SyntaxHighlighter
                children={formattedCode}
                language={language}
                style={codeTheme}
                PreTag='div'
                customStyle={{
                  margin: '0',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                }}
                codeTagProps={{ style: { color: 'var(--text-primary)' } }}
              />
            )}
          />
        </div>
      );
    }

    // 20-50 lines → auto-collapsed code block
    const autoCollapsed = lineCount >= 20;
    const isFolded = autoCollapsed ? (fold === undefined ? true : fold) : fold;

    return (
      <div style={{ width: '100%', ...(props.codeStyle || {}) }}>
        <div
          style={{
            border: '1px solid var(--bg-3)',
            borderRadius: '0.3rem',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-2)',
              borderTopLeftRadius: '0.3rem',
              borderTopRightRadius: '0.3rem',
              borderBottomLeftRadius: isFolded ? '0.3rem' : '0',
              borderBottomRightRadius: isFolded ? '0.3rem' : '0',
              padding: '6px 10px',
              borderBottom: !isFolded ? '1px solid var(--bg-3)' : undefined,
            }}
          >
            <span
              style={{
                textDecoration: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                lineHeight: '20px',
              }}
            >
              {'<' + language.toLocaleLowerCase() + '>'}
              {lineCount >= 20 && <span style={{ marginLeft: '6px', opacity: 0.7 }}>{lineCount} lines</span>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DownloadOne
                theme='outline'
                size='18'
                style={{ cursor: 'pointer' }}
                fill='var(--text-secondary)'
                title='Download'
                onClick={() => {
                  const ext = language || 'txt';
                  const blob = new Blob([formattedCode], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `code.${ext}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  Message.success('Downloaded');
                }}
              />
              <Copy
                theme='outline'
                size='18'
                style={{ cursor: 'pointer' }}
                fill='var(--text-secondary)'
                title='Copy'
                onClick={() => {
                  void navigator.clipboard.writeText(formattedCode).then(() => {
                    Message.success('Copied');
                  });
                }}
              />
              {logicRender(!isFolded, <Up theme='outline' size='20' style={{ cursor: 'pointer' }} fill='var(--text-secondary)' onClick={() => setFlow(true)} />, <Down theme='outline' size='20' style={{ cursor: 'pointer' }} fill='var(--text-secondary)' onClick={() => setFlow(false)} />)}
            </div>
          </div>
          {logicRender(
            !isFolded,
            <SyntaxHighlighter
              children={formattedCode}
              language={language}
              style={codeTheme}
              PreTag='div'
              customStyle={{
                marginTop: '0',
                margin: '0',
                borderTopLeftRadius: '0',
                borderTopRightRadius: '0',
                borderBottomLeftRadius: '0.3rem',
                borderBottomRightRadius: '0.3rem',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
              }}
              codeTagProps={{
                style: {
                  color: 'var(--text-primary)',
                },
              }}
            />
          )}
        </div>
      </div>
    );
  }, [props, currentTheme, fold]);
}

// Extract KaTeX CSS from document stylesheets to inject into shadow DOM.
// @font-face declarations propagate from the document into shadow DOM automatically,
// but class-based layout rules (.katex, .katex-display, etc.) do not.
let _katexCssCache: string | null = null;
function getKatexLayoutCss(): string {
  // Only cache once we find actual content (CSS may load after first render)
  if (_katexCssCache) return _katexCssCache;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules);
      if (rules.some((r) => r.cssText.includes('.katex'))) {
        // Skip @font-face rules — they're already loaded in the document head
        // and their relative font URLs would break inside shadow DOM
        _katexCssCache = rules
          .filter((r) => !(r instanceof CSSFontFaceRule))
          .map((r) => r.cssText)
          .join('\n');
        return _katexCssCache;
      }
    } catch {
      continue;
    }
  }
  return '';
}

const createInitStyle = (currentTheme = 'light', cssVars?: Record<string, string>, customCss?: string) => {
  const style = document.createElement('style');
  // Inject external CSS variables into Shadow DOM for dark mode support
  const cssVarsDeclaration = cssVars
    ? Object.entries(cssVars)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n    ')
    : '';

  style.innerHTML = `
  /* Shadow DOM CSS variable definitions */
  :host {
    ${cssVarsDeclaration}
  }

  *:not(.katex, .katex *) {
    line-height:26px;
    font-size:16px;
    color: inherit;
  }

  .markdown-shadow-body {
    word-break: break-word;
    overflow-wrap: anywhere;
    color: var(--text-primary);
  }
  .markdown-shadow-body>p:first-child
  {
    margin-top:0px;
  }
  h1,h2,h3,h4,h5,h6,pre{
    margin-block-start:0px;
    margin-block-end:0px;
  }
  p{
    margin-block-start:0px;
    margin-block-end:8px;
  }
  p:last-child{
    margin-block-end:0px;
  }
  a{
    color:${theme.Color.PrimaryColor};
    text-decoration: none;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  h1{
    font-size: 24px;
    line-height: 32px;
    font-weight: bold;
  }
  h2,h3,h4,h5,h6{
    font-size: 16px;
    line-height: 24px;
    font-weight: bold;
    margin-top: 8px;
    margin-bottom: 8px;
  }
  code{
    font-size:14px;
  }
 
  .markdown-shadow-body>p:last-child{
    margin-bottom:0px;
  }
  ol {
    padding-inline-start:20px;
  }
  img {
    max-width: 100%;
  }
   /* Add border to entire table */
  table {
    border-collapse: collapse;  /* Merge table borders into single border */
    th{
      padding: 8px;
      border: 1px solid var(--bg-3);
      background-color: var(--bg-1);
      font-weight: bold;
    }
    td{
        padding: 8px;
        border: 1px solid var(--bg-3);
        min-width: 120px;
    }
  }
  /* Horizontal rules - subtle, not harsh white */
  hr {
    border: none;
    border-top: 1px solid var(--bg-3);
    margin: 16px 0;
    opacity: 0.5;
  }
  /* Inline code should wrap on small screens to avoid horizontal overflow */
  .markdown-shadow-body code {
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  .loading {
    animation: loading 1s linear infinite;
  }


  @keyframes loading {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* KaTeX math rendering (extracted from document stylesheets) */
  ${getKatexLayoutCss()}

  /* Constrain block math to prevent container blowout */
  .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
  }

  /* User Custom CSS (injected into Shadow DOM) */
  ${customCss || ''}
  `;
  return style;
};

const ShadowView = ({ children }: { children: React.ReactNode }) => {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const styleRef = React.useRef<HTMLStyleElement | null>(null);
  const [customCss, setCustomCss] = useState<string>('');

  // Load custom CSS from ConfigStorage
  React.useEffect(() => {
    void import('@/common/storage').then(({ ConfigStorage }) => {
      ConfigStorage.get('customCss')
        .then((css) => {
          if (css) {
            // Use unified utility function to auto-add !important
            const processedCss = addImportantToAll(css);
            setCustomCss(processedCss);
          } else {
            setCustomCss('');
          }
        })
        .catch((error) => {
          console.error('Failed to load custom CSS:', error);
        });
    });

    // Listen to custom CSS update events
    const handleCustomCssUpdate = (e: CustomEvent) => {
      if (e.detail?.customCss !== undefined) {
        const css = e.detail.customCss || '';
        // Use unified utility function to auto-add !important
        const processedCss = addImportantToAll(css);
        setCustomCss(processedCss);
      }
    };

    window.addEventListener('custom-css-updated', handleCustomCssUpdate as EventListener);

    return () => {
      window.removeEventListener('custom-css-updated', handleCustomCssUpdate as EventListener);
    };
  }, []);

  // Update CSS variables and custom styles in Shadow DOM
  const updateStyles = React.useCallback(
    (shadowRoot: ShadowRoot) => {
      const computedStyle = getComputedStyle(document.documentElement);
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const cssVars = {
        '--bg-1': computedStyle.getPropertyValue('--bg-1'),
        '--bg-2': computedStyle.getPropertyValue('--bg-2'),
        '--bg-3': computedStyle.getPropertyValue('--bg-3'),
        '--color-text-1': computedStyle.getPropertyValue('--color-text-1'),
        '--color-text-2': computedStyle.getPropertyValue('--color-text-2'),
        '--color-text-3': computedStyle.getPropertyValue('--color-text-3'),
        '--text-primary': computedStyle.getPropertyValue('--text-primary'),
        '--text-secondary': computedStyle.getPropertyValue('--text-secondary'),
      };

      // Remove old style and add new style
      if (styleRef.current) {
        styleRef.current.remove();
      }
      const newStyle = createInitStyle(currentTheme, cssVars, customCss);
      styleRef.current = newStyle;
      shadowRoot.appendChild(newStyle);
    },
    [customCss]
  );

  React.useEffect(() => {
    if (!root) return;

    // Update styles when custom CSS changes
    updateStyles(root);
  }, [root, customCss, updateStyles]);

  React.useEffect(() => {
    if (!root) return;

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      updateStyles(root);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => observer.disconnect();
  }, [root, updateStyles]);

  return (
    <div
      ref={(el: any) => {
        if (!el || el.__init__shadow) return;
        el.__init__shadow = true;
        const shadowRoot = el.attachShadow({ mode: 'open' });
        updateStyles(shadowRoot);
        setRoot(shadowRoot);
      }}
      className='markdown-shadow'
      style={{ width: '100%', flex: '1 1 auto', minWidth: 0 }}
    >
      {root && ReactDOM.createPortal(children, root)}
    </div>
  );
};

interface MarkdownViewProps {
  children: string;
  hiddenCodeCopyButton?: boolean;
  codeStyle?: React.CSSProperties;
  className?: string;
  onRef?: (el?: HTMLDivElement | null) => void;
}

const MarkdownView: React.FC<MarkdownViewProps> = ({ hiddenCodeCopyButton, codeStyle, className, onRef, children: childrenProp }) => {
  const { t } = useTranslation();

  const normalizedChildren = useMemo(() => {
    if (typeof childrenProp === 'string') {
      return childrenProp.replace(/file:\/\//g, '');
    }
    return childrenProp;
  }, [childrenProp]);

  const isLocalFilePath = (src: string): boolean => {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return false;
    }
    if (src.startsWith('data:')) {
      return false;
    }
    return true;
  };

  return (
    <div className={classNames('relative w-full', className)}>
      <ShadowView>
        <div ref={onRef} className='markdown-shadow-body'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }], remarkBreaks]}
            rehypePlugins={[rehypeKatex]}
            components={{
              span: ({ node: _node, className, children, ...props }) => {
                if (className?.includes('katex')) {
                  return (
                    <span
                      {...props}
                      className={className}
                      style={{
                        maxWidth: '100%',
                        overflowX: 'auto',
                        display: 'inline-block',
                        verticalAlign: 'middle',
                      }}
                    >
                      {children}
                    </span>
                  );
                }

                return (
                  <span {...props} className={className}>
                    {children}
                  </span>
                );
              },
              code: (props: any) => CodeBlock({ ...props, codeStyle, hiddenCodeCopyButton }),
              a: ({ node: _node, ...props }) => (
                <a
                  {...props}
                  target='_blank'
                  rel='noreferrer'
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!props.href) return;
                    try {
                      ipcBridge.shell.openExternal.invoke(props.href).catch((error) => {
                        console.error(t('messages.openLinkFailed'), error);
                      });
                    } catch (error) {
                      console.error(t('messages.openLinkFailed'), error);
                    }
                  }}
                />
              ),
              table: ({ node: _node, ...props }) => (
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <table
                    {...props}
                    style={{
                      ...props.style,
                      borderCollapse: 'collapse',
                      border: '1px solid var(--bg-3)',
                      minWidth: '100%',
                    }}
                  />
                </div>
              ),
              td: ({ node: _node, ...props }) => (
                <td
                  {...props}
                  style={{
                    ...props.style,
                    padding: '8px',
                    border: '1px solid var(--bg-3)',
                    minWidth: '120px',
                  }}
                />
              ),
              img: ({ node: _node, ...props }) => {
                if (isLocalFilePath(props.src || '')) {
                  const src = decodeURIComponent(props.src || '');
                  return <LocalImageView src={src} alt={props.alt || ''} className={props.className} />;
                }
                return <img {...props} />;
              },
              // Style horizontal rules to be subtle, not harsh white lines
              hr: ({ node: _node, ...props }) => (
                <hr
                  {...props}
                  style={{
                    border: 'none',
                    borderTop: '1px solid var(--bg-3)',
                    margin: '16px 0',
                    opacity: 0.5,
                  }}
                />
              ),
            }}
          >
            {normalizedChildren}
          </ReactMarkdown>
        </div>
      </ShadowView>
    </div>
  );
};

export default MarkdownView;

/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

import './bootstrap/runtimePatches';
import type { PropsWithChildren } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../adapter/browser';
import Main from './main';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PreviewProvider } from './pages/conversation/preview';
import { ConversationTabsProvider } from './pages/conversation/context/ConversationTabsContext';

import { ConfigProvider } from '@arco-design/web-react';
// Configure Arco Design to use React 18's createRoot
import '@arco-design/web-react/es/_util/react-19-adapter';
import '@arco-design/web-react/dist/css/arco.css';
import enUS from '@arco-design/web-react/es/locale/en-US';
import 'uno.css';
import './arco-override.css';
import './i18n';
import './styles/themes/index.css';
import HOC from './utils/HOC';
const root = createRoot(document.getElementById('root'));

const AppProviders: React.FC<PropsWithChildren> = ({ children }) => React.createElement(AuthProvider, null, React.createElement(ThemeProvider, null, React.createElement(PreviewProvider, null, React.createElement(ConversationTabsProvider, null, children))));

const Config: React.FC<PropsWithChildren> = ({ children }) => {
  return React.createElement(ConfigProvider, { theme: { primaryColor: '#4E5969' }, locale: enUS }, children);
};

const App = HOC.Wrapper(Config)(Main);

root.render(React.createElement(AppProviders, null, React.createElement(App)));

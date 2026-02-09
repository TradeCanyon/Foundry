import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLoader from './components/AppLoader';
import { useAuth } from './context/AuthContext';
import Conversation from './pages/conversation';
import Guid from './pages/guid';
import { ChatsPage } from './pages/chats';
import { ProjectsPage, ProjectDetailPage } from './pages/projects';
import About from './pages/settings/About';
import AgentSettings from './pages/settings/AgentSettings';
import DisplaySettings from './pages/settings/DisplaySettings';
import GeminiSettings from './pages/settings/GeminiSettings';
import ModeSettings from './pages/settings/ModeSettings';
import SystemSettings from './pages/settings/SystemSettings';
import ToolsSettings from './pages/settings/ToolsSettings';
// import ImageSettings from './pages/settings/ImageSettings'; // Shelved
import WebuiSettings from './pages/settings/WebuiSettings';
import ConstitutionSettings from './pages/settings/ConstitutionSettings';
import MemorySettings from './pages/settings/MemorySettings';
import EmberSettings from './pages/settings/EmberSettings';
import SkillStoreSettings from './pages/settings/SkillStoreSettings';
import McpStoreSettings from './pages/settings/McpStoreSettings';
import VoiceSettings from './pages/settings/VoiceSettings';
import ChannelsSettings from './pages/settings/ChannelsSettings';
import LoginPage from './pages/login';
import ComponentsShowcase from './pages/test/ComponentsShowcase';

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return React.cloneElement(layout);
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route path='/login' element={status === 'authenticated' ? <Navigate to='/guid' replace /> : <LoginPage />} />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<Navigate to='/guid' replace />} />
          <Route path='/guid' element={<Guid />} />
          <Route path='/conversation/:id' element={<Conversation />} />
          <Route path='/chats' element={<ChatsPage />} />
          <Route path='/projects' element={<ProjectsPage />} />
          <Route path='/projects/:workspace' element={<ProjectDetailPage />} />
          <Route path='/settings/gemini' element={<GeminiSettings />} />
          <Route path='/settings/model' element={<ModeSettings />} />
          <Route path='/settings/agent' element={<AgentSettings />} />
          <Route path='/settings/display' element={<DisplaySettings />} />
          <Route path='/settings/webui' element={<WebuiSettings />} />
          <Route path='/settings/system' element={<SystemSettings />} />
          <Route path='/settings/about' element={<About />} />
          <Route path='/settings/tools' element={<ToolsSettings />} />
          <Route path='/settings/constitution' element={<ConstitutionSettings />} />
          <Route path='/settings/memory' element={<MemorySettings />} />
          <Route path='/settings/ember' element={<EmberSettings />} />
          <Route path='/settings/skills' element={<SkillStoreSettings />} />
          <Route path='/settings/mcp' element={<McpStoreSettings />} />
          <Route path='/settings/voice' element={<VoiceSettings />} />
          <Route path='/settings/channels' element={<ChannelsSettings />} />
          <Route path='/settings' element={<Navigate to='/settings/gemini' replace />} />
          <Route path='/test/components' element={<ComponentsShowcase />} />
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;

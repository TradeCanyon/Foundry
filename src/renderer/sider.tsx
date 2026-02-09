import { ipcBridge } from '@/common';
import { ArrowCircleLeft, FolderOpen, FolderPlus, Plus, SettingTwo } from '@icon-park/react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import WorkspaceGroupedHistory from './pages/conversation/WorkspaceGroupedHistory';
import SettingsSider from './pages/settings/SettingsSider';
import { iconColors } from './theme/colors';
import { Tooltip } from '@arco-design/web-react';
import { usePreviewContext } from './pages/conversation/preview';
import ProjectWizard from './components/ProjectWizard';

type SidebarSection = 'chats' | 'projects';

const PROJECT_TYPE_COLORS: Record<string, string> = {
  software: '#3b82f6',
  web: '#22c55e',
  content: '#f59e0b',
  marketing: '#ec4899',
  business: '#8b5cf6',
  creative: '#f97316',
  data: '#06b6d4',
  devops: '#64748b',
  other: '#a78bfa',
  workspace: '#94a3b8',
};

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const location = useLocation();
  const { pathname, search, hash } = location;

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();
  const isSettings = pathname.startsWith('/settings');
  const lastNonSettingsPathRef = useRef('/guid');
  const [wizardVisible, setWizardVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<SidebarSection>('chats');
  const { data: projectsData, mutate: refreshProjects } = useSWR('sidebar-projects', () => ipcBridge.project.list.invoke());
  const projects = (projectsData?.success ? projectsData.data : []) || [];

  useEffect(() => {
    if (!pathname.startsWith('/settings')) {
      lastNonSettingsPathRef.current = `${pathname}${search}${hash}`;
    }
  }, [pathname, search, hash]);

  const handleSettingsClick = () => {
    if (isSettings) {
      const target = lastNonSettingsPathRef.current || '/guid';
      Promise.resolve(navigate(target)).catch((error) => {
        console.error('Navigation failed:', error);
      });
    } else {
      Promise.resolve(navigate('/settings/gemini')).catch((error) => {
        console.error('Navigation failed:', error);
      });
    }
    if (onSessionClick) {
      onSessionClick();
    }
  };
  return (
    <div className='size-full flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        {isSettings ? (
          <SettingsSider collapsed={collapsed}></SettingsSider>
        ) : (
          <div className='size-full flex flex-col'>
            {/* New Chat button */}
            <Tooltip disabled={!collapsed} content={t('conversation.welcome.newConversation')} position='right'>
              <div
                className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem cursor-pointer group shrink-0'
                onClick={() => {
                  closePreview();
                  Promise.resolve(navigate('/guid')).catch((error) => {
                    console.error('Navigation failed:', error);
                  });
                  if (onSessionClick) {
                    onSessionClick();
                  }
                }}
              >
                <Plus theme='outline' size='24' fill={iconColors.primary} className='flex' />
                <span className='collapsed-hidden font-bold text-t-primary'>{t('conversation.welcome.newConversation')}</span>
              </div>
            </Tooltip>

            {/* Section tabs: Chats / Projects */}
            {!collapsed && (
              <div className='flex items-center gap-2px px-8px mb-4px shrink-0'>
                <button
                  type='button'
                  className='flex-1 py-4px px-8px rd-6px text-12px font-600 b-none cursor-pointer transition-all duration-150'
                  style={{
                    backgroundColor: activeSection === 'chats' ? 'var(--bg-3)' : 'transparent',
                    color: activeSection === 'chats' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}
                  onClick={() => setActiveSection('chats')}
                >
                  Chats
                </button>
                <button
                  type='button'
                  className='flex-1 py-4px px-8px rd-6px text-12px font-600 b-none cursor-pointer transition-all duration-150'
                  style={{
                    backgroundColor: activeSection === 'projects' ? 'var(--bg-3)' : 'transparent',
                    color: activeSection === 'projects' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}
                  onClick={() => setActiveSection('projects')}
                >
                  Projects{projects.length > 0 ? ` (${projects.length})` : ''}
                </button>
              </div>
            )}

            {/* Section content */}
            {activeSection === 'chats' ? (
              <WorkspaceGroupedHistory collapsed={collapsed} onSessionClick={onSessionClick} />
            ) : (
              <div className='flex-1 min-h-0 overflow-y-auto overflow-x-hidden'>
                {/* New Project button */}
                <Tooltip disabled={!collapsed} content='New Project' position='right'>
                  <div className='flex items-center justify-start gap-10px px-12px py-6px hover:bg-hover rd-0.5rem mx-4px mb-4px cursor-pointer group shrink-0' onClick={() => setWizardVisible(true)}>
                    <FolderPlus theme='outline' size='20' fill={iconColors.primary} className='flex' />
                    <span className='collapsed-hidden text-13px text-t-secondary'>New Project</span>
                  </div>
                </Tooltip>
                {projects.length === 0 ? (
                  <div className='px-12px py-24px text-13px text-t-secondary text-center'>No projects yet</div>
                ) : (
                  <div className='flex flex-col gap-2px px-4px'>
                    {projects.map((project) => {
                      const typeColor = PROJECT_TYPE_COLORS[project.type] || PROJECT_TYPE_COLORS.workspace;
                      return (
                        <div
                          key={project.workspace}
                          className='flex flex-col gap-2px px-10px py-8px hover:bg-hover rd-8px cursor-pointer'
                          onClick={() => {
                            closePreview();
                            void navigate('/guid', { state: { workspace: project.workspace } });
                            if (onSessionClick) onSessionClick();
                          }}
                        >
                          <div className='flex items-center gap-6px'>
                            <FolderOpen theme='outline' size='14' fill={typeColor} className='flex shrink-0' />
                            <span className='text-13px font-500 truncate flex-1' style={{ color: 'var(--text-primary)' }}>
                              {project.name}
                            </span>
                            <span className='text-10px px-4px py-1px rd-3px flex-shrink-0' style={{ backgroundColor: `${typeColor}18`, color: typeColor }}>
                              {project.type}
                            </span>
                          </div>
                          {project.description && (
                            <div className='text-11px truncate ml-20px' style={{ color: 'var(--text-tertiary)' }}>
                              {project.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Footer - settings button */}
      <div className='shrink-0 sider-footer'>
        <Tooltip disabled={!collapsed} content={isSettings ? t('common.back') : t('common.settings')} position='right'>
          <div onClick={handleSettingsClick} className='flex items-center justify-start gap-10px px-12px py-8px hover:bg-hover rd-0.5rem mb-8px cursor-pointer'>
            {isSettings ? <ArrowCircleLeft className='flex' theme='outline' size='24' fill={iconColors.primary} /> : <SettingTwo className='flex' theme='outline' size='24' fill={iconColors.primary} />}
            <span className='collapsed-hidden text-t-primary'>{isSettings ? t('common.back') : t('common.settings')}</span>
          </div>
        </Tooltip>
      </div>
      <ProjectWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onCreated={(workspace) => {
          void refreshProjects();
          void navigate('/guid', { state: { workspace } });
        }}
      />
    </div>
  );
};

export default Sider;

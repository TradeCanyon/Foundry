/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SidebarNav — Top section with prominent "New" button + navigation items.
 */

import { Dropdown, Menu, Tooltip } from '@arco-design/web-react';
import { Down, Fire, FolderOpen, FolderPlus, MessageOne, Pic, Plus, Search } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { iconColors } from '@/renderer/theme/colors';
import { usePreviewContext } from '@/renderer/pages/conversation/preview';

type SidebarNavProps = {
  collapsed: boolean;
  onSessionClick?: () => void;
  onNewProject: () => void;
  onSearchOpen: () => void;
};

const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed, onSessionClick, onNewProject, onSearchOpen }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();

  const handleNewChat = () => {
    closePreview();
    void navigate('/guid');
    onSessionClick?.();
  };

  const handleNewImage = () => {
    closePreview();
    void navigate('/guid', { state: { mode: 'image' } });
    onSessionClick?.();
  };

  const newMenu = (
    <Menu
      className='min-w-180px'
      onClickMenuItem={(key) => {
        if (key === 'chat') handleNewChat();
        else if (key === 'image') handleNewImage();
        else if (key === 'project') onNewProject();
      }}
    >
      <Menu.Item key='chat'>
        <div className='flex items-center gap-8px'>
          <MessageOne theme='outline' size='16' fill={iconColors.primary} />
          <span>{t('conversation.welcome.newConversation')}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='image'>
        <div className='flex items-center gap-8px'>
          <Pic theme='outline' size='16' fill={iconColors.secondary} />
          <span>{t('conversation.welcome.newImage', { defaultValue: 'New Image' })}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='project'>
        <div className='flex items-center gap-8px'>
          <FolderPlus theme='outline' size='16' fill={iconColors.primary} />
          <span>New Project</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  const navItems = [
    { icon: <Search theme='outline' size='18' />, label: 'Search', shortcut: 'Ctrl+K', onClick: onSearchOpen },
    {
      icon: <MessageOne theme='outline' size='18' />,
      label: 'Chats',
      onClick: () => {
        void navigate('/chats');
        onSessionClick?.();
      },
    },
    {
      icon: <FolderOpen theme='outline' size='18' />,
      label: 'Projects',
      onClick: () => {
        void navigate('/projects');
        onSessionClick?.();
      },
    },
    {
      icon: <Fire theme='outline' size='18' />,
      label: 'Ember',
      onClick: () => {
        closePreview();
        void navigate('/guid', { state: { agent: 'ember' } });
        onSessionClick?.();
      },
    },
  ];

  return (
    <div className='shrink-0 px-8px pt-4px pb-2px'>
      {/* New button */}
      <Dropdown trigger='click' droplist={newMenu}>
        <Tooltip disabled={!collapsed} content={t('conversation.welcome.newConversation')} position='right'>
          <div className='flex items-center justify-center gap-6px px-10px py-8px hover:bg-hover rd-8px cursor-pointer mb-4px'>
            <Plus theme='outline' size='20' fill={iconColors.primary} className='flex' />
            <span className='collapsed-hidden font-600 text-14px text-t-primary flex-1'>New</span>
            <Down theme='outline' size='12' fill={iconColors.secondary} className='collapsed-hidden' />
          </div>
        </Tooltip>
      </Dropdown>

      {/* Nav items */}
      <div className='flex flex-col gap-1px'>
        {navItems.map((item) => (
          <Tooltip key={item.label} disabled={!collapsed} content={item.label} position='right'>
            <div className='flex items-center gap-8px px-10px py-5px hover:bg-hover rd-6px cursor-pointer text-t-secondary hover:text-t-primary' onClick={item.onClick}>
              <span className='flex-shrink-0 flex'>{item.icon}</span>
              <span className='collapsed-hidden text-13px flex-1'>{item.label}</span>
              {item.shortcut && (
                <kbd className='collapsed-hidden text-10px px-4px py-1px rd-3px' style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-tertiary)', border: '1px solid var(--bg-3)' }}>
                  {item.shortcut}
                </kbd>
              )}
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default SidebarNav;

/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DegradationBanner — Non-intrusive banner showing degraded services.
 * Displays when any service is in degraded or down state.
 * Can be dismissed; auto-hides when all services recover.
 */

import type { DegradedService } from '@/common/utils/gracefulDegradation';
import { getDegradedServices, onDegradationChange } from '@/common/utils/gracefulDegradation';
import React, { useCallback, useEffect, useState } from 'react';

const DegradationBanner: React.FC = () => {
  const [services, setServices] = useState<DegradedService[]>(() => getDegradedServices());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = onDegradationChange((updated) => {
      setServices(updated);
      // Auto-show when new degradation is reported
      if (updated.length > 0) setDismissed(false);
    });
    return unsubscribe;
  }, []);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (services.length === 0 || dismissed) return null;

  const isDown = services.some((s) => s.status === 'down');

  return (
    <div
      className='flex items-center justify-between px-16px py-8px text-13px'
      style={{
        backgroundColor: isDown ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        borderBottom: `1px solid ${isDown ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        color: isDown ? '#dc2626' : '#b45309',
      }}
    >
      <div className='flex items-center gap-8px flex-1'>
        <span className='text-14px'>{isDown ? '\u26A0\uFE0F' : '\u2139\uFE0F'}</span>
        <span>{services.length === 1 ? `${services[0].service}: ${services[0].reason}` : `${services.length} services running in limited mode`}</span>
      </div>
      <button className='flex items-center justify-center w-20px h-20px rd-full b-none cursor-pointer' style={{ backgroundColor: 'transparent', color: 'inherit', fontSize: '14px' }} onClick={handleDismiss}>
        {'\u00D7'}
      </button>
    </div>
  );
};

export default DegradationBanner;

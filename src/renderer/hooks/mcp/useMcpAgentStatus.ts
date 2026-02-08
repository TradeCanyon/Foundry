import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigStorage } from '@/common/storage';
import { acpConversation, mcpService } from '@/common/ipcBridge';
import type { IMcpServer } from '@/common/storage';

/**
 * MCP Agent Installation Status Management Hook
 * Manages checking and caching MCP server installation status across agents
 */
export const useMcpAgentStatus = () => {
  const [agentInstallStatus, setAgentInstallStatus] = useState<Record<string, string[]>>({});
  const [loadingServers, setLoadingServers] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const agentConfigsCacheRef = useRef<Array<{ source: string; servers: Array<{ name: string }> }> | null>(null);

  // Load saved agent installation status
  useEffect(() => {
    void ConfigStorage.get('mcp.agentInstallStatus')
      .then((status) => {
        if (status && typeof status === 'object') {
          setAgentInstallStatus(status as Record<string, string[]>);
        }
      })
      .catch(() => {
        // Handle loading error silently
      });
  }, []);

  // Save agent installation status to storage
  const saveAgentInstallStatus = useCallback((status: Record<string, string[]>) => {
    void ConfigStorage.set('mcp.agentInstallStatus', status).catch(() => {
      // Handle storage error silently
    });
    setAgentInstallStatus(status);
  }, []);

  // Generic function to process agent configuration data
  const processAgentConfigs = useCallback(
    (servers: IMcpServer[], agentConfigs: Array<{ source: string; servers: Array<{ name: string }> }>, targetServerName?: string) => {
      // Create new status based on current state, avoid resetting other servers' status
      const installStatus: Record<string, string[]> = { ...agentInstallStatus };

      // Pre-build server name to server object mapping, avoid repeated find operations
      const serverMap = new Map<string, IMcpServer>();
      const serversToProcess = targetServerName ? servers.filter((s) => s.name === targetServerName) : servers;

      serversToProcess.forEach((server) => {
        if (server.enabled) {
          serverMap.set(server.name, server);
          installStatus[server.name] = [];
        } else {
          // If target server is disabled, also remove from status
          delete installStatus[server.name];
        }
      });

      // Check each agent's MCP configuration, only check enabled servers
      agentConfigs.forEach((agentConfig) => {
        agentConfig.servers.forEach((agentServer) => {
          // Use Map lookup, O(1) time complexity
          const localServer = serverMap.get(agentServer.name);
          // Only show installation status when local server exists and is enabled
          if (localServer && installStatus[agentServer.name] !== undefined) {
            installStatus[agentServer.name].push(agentConfig.source);
          }
        });
      });

      // Before saving detection results, filter out disabled servers to prevent overwriting user delete operations
      const currentEnabledServers = servers.filter((s) => s.enabled).map((s) => s.name);
      const filteredInstallStatus: Record<string, string[]> = {};

      for (const [serverName, agents] of Object.entries(installStatus)) {
        if (currentEnabledServers.includes(serverName)) {
          filteredInstallStatus[serverName] = agents;
        }
      }

      saveAgentInstallStatus(filteredInstallStatus);
    },
    [agentInstallStatus, saveAgentInstallStatus]
  );

  // Check which agents each MCP server is installed in
  const checkAgentInstallStatus = useCallback(
    async (servers: IMcpServer[], forceRefresh = false, targetServerName?: string) => {
      // Cache check: if checked within 5 seconds and cache exists, use cache (unless force refresh)
      const now = Date.now();
      const CACHE_DURATION = 5000; // 5 second cache

      if (!forceRefresh && agentConfigsCacheRef.current && now - lastCheckTimeRef.current < CACHE_DURATION) {
        // Recalculate status using cached data
        processAgentConfigs(servers, agentConfigsCacheRef.current, targetServerName);
        return;
      }

      // Set loading state - if target server specified, only mark that server; otherwise mark all enabled servers
      const serversToLoad = targetServerName ? [targetServerName] : servers.filter((s) => s.enabled).map((s) => s.name);
      setLoadingServers((prev) => {
        const newSet = new Set(prev);
        serversToLoad.forEach((name) => newSet.add(name));
        return newSet;
      });

      try {
        // First get agents info, then get MCP config based on result (cannot truly parallelize, second depends on first)
        const agentsResponse = await acpConversation.getAvailableAgents.invoke();

        if (!agentsResponse.success || !agentsResponse.data) {
          // If no agent detected, only clear status on initial load
          if (Object.keys(agentInstallStatus).length === 0) {
            saveAgentInstallStatus({});
          }
          return;
        }

        const mcpConfigsResponse = await mcpService.getAgentMcpConfigs.invoke(agentsResponse.data);

        if (!mcpConfigsResponse.success || !mcpConfigsResponse.data) {
          // If MCP config fetch failed, keep current status to avoid flickering
          return;
        }

        // Update cache
        agentConfigsCacheRef.current = mcpConfigsResponse.data;
        lastCheckTimeRef.current = now;

        // Process configuration data
        processAgentConfigs(servers, mcpConfigsResponse.data, targetServerName);
      } catch (error) {
        // Keep current status on error to avoid flickering
      } finally {
        // Clear loading state
        setLoadingServers((prev) => {
          const newSet = new Set(prev);
          serversToLoad.forEach((name) => newSet.delete(name));
          return newSet;
        });
      }
    },
    [agentInstallStatus, processAgentConfigs, saveAgentInstallStatus]
  );

  // Debounced version of status check, avoid frequent calls
  const debouncedCheckAgentInstallStatus = useCallback(
    (servers: IMcpServer[], forceRefresh = false, targetServerName?: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        checkAgentInstallStatus(servers, forceRefresh, targetServerName).catch(() => {
          // Silently handle errors
        });
      }, 300); // 300ms debounce
    },
    [checkAgentInstallStatus]
  );

  // Check installation status of a single server only (no connection tests or other operations)
  const checkSingleServerInstallStatus = useCallback(async (serverName: string) => {
    // Set loading state
    setLoadingServers((prev) => new Set(prev).add(serverName));

    try {
      // Get available agents
      const agentsResponse = await acpConversation.getAvailableAgents.invoke();
      if (!agentsResponse.success || !agentsResponse.data) {
        return;
      }

      // Get MCP configurations for all agents
      const mcpConfigsResponse = await mcpService.getAgentMcpConfigs.invoke(agentsResponse.data);
      if (!mcpConfigsResponse.success || !mcpConfigsResponse.data) {
        return;
      }

      // Only check installation status of the specified server
      const installedAgents: string[] = [];
      mcpConfigsResponse.data.forEach((agentConfig) => {
        const hasServer = agentConfig.servers.some((server) => server.name === serverName);
        if (hasServer) {
          installedAgents.push(agentConfig.source);
        }
      });

      // Update installation status for this server
      setAgentInstallStatus((prev) => {
        const updated = { ...prev };
        if (installedAgents.length > 0) {
          updated[serverName] = installedAgents;
        } else {
          delete updated[serverName];
        }

        // Also update local storage
        void ConfigStorage.set('mcp.agentInstallStatus', updated).catch(() => {
          // Handle storage error silently
        });

        return updated;
      });
    } catch (error) {
      // Handle check failure silently
    } finally {
      // Clear loading state
      setLoadingServers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(serverName);
        return newSet;
      });
    }
  }, []);

  // Check if a specific server is loading
  const isServerLoading = useCallback(
    (serverName: string) => {
      return loadingServers.has(serverName);
    },
    [loadingServers]
  );

  return {
    agentInstallStatus,
    setAgentInstallStatus,
    loadingServers,
    isServerLoading,
    checkAgentInstallStatus,
    debouncedCheckAgentInstallStatus,
    checkSingleServerInstallStatus,
  };
};

"use client";

/**
 * Ditto — Settings: Connections Panel (Brief 133)
 *
 * Shows connected social accounts (via Unipile) and allows
 * the user to connect new accounts (LinkedIn, WhatsApp, etc.)
 * through Unipile's hosted auth flow.
 *
 * No auth gate — the workspace is single-user. If you can reach
 * the workspace, you're the owner. Settings are accessible directly.
 *
 * Provenance: Brief 133 (Unipile social channel spike + adapter).
 */

import { useState, useEffect, useCallback } from "react";

interface ConnectedAccount {
  id: string;
  type: string;
  name: string;
  status: string;
  created_at?: string;
}

const PROVIDERS = [
  { id: "LINKEDIN", label: "LinkedIn", description: "Send ghost DMs via LinkedIn" },
  { id: "WHATSAPP", label: "WhatsApp", description: "Send messages via WhatsApp" },
  { id: "INSTAGRAM", label: "Instagram", description: "Send DMs via Instagram" },
  { id: "TELEGRAM", label: "Telegram", description: "Send messages via Telegram" },
] as const;

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconLoader() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function ConnectionsPanel() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/integrations/unipile");

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        if (res.status === 503) {
          setAccounts([]);
          setError(null);
          setLoading(false);
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = async (provider: string) => {
    setConnectingProvider(provider);
    try {
      const res = await fetch("/api/v1/integrations/unipile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link");
    } finally {
      setConnectingProvider(null);
    }
  };

  const connectedTypes = new Set(
    accounts.map((a) => String(a.type).toUpperCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <IconLink />
          Connected Accounts
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          Connect your social accounts to enable ghost mode messaging.
          Alex can send messages as you on connected platforms.
        </p>
      </div>

      {error && (
        <div
          className="text-xs text-caution border border-caution/20 rounded-lg px-3 py-2"
          style={{ background: "rgba(234, 88, 12, 0.05)" }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-text-muted py-4">
          <IconLoader />
          Loading connected accounts...
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5"
            >
              <span className="text-positive flex-shrink-0">
                <IconCheck />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {account.name}
                </p>
                <p className="text-xs text-text-secondary">
                  {account.type} &middot; {account.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {PROVIDERS.map(({ id, label, description }) => {
            const isConnected = connectedTypes.has(id);
            const isConnecting = connectingProvider === id;

            return (
              <div
                key={id}
                className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="text-xs text-text-secondary">{description}</p>
                </div>
                {isConnected ? (
                  <span className="text-xs text-positive font-medium flex items-center gap-1">
                    <IconCheck /> Connected
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnect(id)}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      background: "var(--color-vivid)",
                      color: "white",
                      opacity: isConnecting ? 0.7 : 1,
                    }}
                  >
                    {isConnecting ? (
                      <>
                        <IconLoader /> Connecting...
                      </>
                    ) : (
                      <>
                        <IconExternalLink /> Connect
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="text-xs text-text-muted">
          After connecting an account, refresh this page to see it here.
          <button
            onClick={() => fetchAccounts()}
            className="ml-1 text-text-secondary underline hover:text-text-primary transition-colors"
          >
            Refresh now
          </button>
        </p>
      )}
    </div>
  );
}

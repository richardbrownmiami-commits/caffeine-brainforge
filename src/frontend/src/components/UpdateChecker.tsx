import { useEffect, useState } from 'react';

const CURRENT_VERSION = '1.0.0';
const WORKER_URL = 'https://brainforge-api.richard-brown-miami.workers.dev';

interface VersionInfo {
  version: string;
  buildDate: string;
  apkUrl: string;
  changelog: string;
}

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/version`);
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        if (data.version !== CURRENT_VERSION) {
          setVersionInfo(data);
          setUpdateAvailable(true);
        }
      } catch {
        // silently fail
      }
    };
    checkUpdate();
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      border: '1px solid #00d4ff',
      borderRadius: '12px',
      padding: '16px 20px',
      zIndex: 9999,
      minWidth: '320px',
      maxWidth: '90vw',
      boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00d4ff', marginBottom: '4px' }}>
            🚀 Update Available — v{versionInfo?.version}
          </div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
            {versionInfo?.changelog}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href={versionInfo?.apkUrl}
              download="BrainForge.apk"
              style={{
                background: '#00d4ff',
                color: '#000',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              Download APK
            </a>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: 'transparent',
                border: '1px solid #555',
                color: '#aaa',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer', marginLeft: '10px' }}
        >
          ×
        </button>
      </div>
    </div>
  );
}


// The settings dropdown (KIT-T149): for now it shows the resolved viewer identity (/api/me, KIT-T145)
// and nothing speculative — a deliberate placeholder shape that later settings (theme, defaults) can
// slot into without a redesign. No options are invented before they exist.

import { useIdentity } from '../../lib/identity';
import { Dropdown } from './Dropdown';

export function SettingsMenu() {
  const { alias, loading } = useIdentity();
  return (
    <Dropdown label="Settings" ariaLabel="Settings" align="right">
      {() => (
        <div className="settings-menu" role="group" aria-label="Settings">
          <div className="settings-row">
            <span className="settings-label">Signed in as</span>
            <span className="settings-value">{loading ? '…' : alias}</span>
          </div>
          <p className="settings-note">More settings will live here.</p>
        </div>
      )}
    </Dropdown>
  );
}

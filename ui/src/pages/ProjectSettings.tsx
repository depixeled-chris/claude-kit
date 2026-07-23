// Per-project settings (/p/:key/settings) — KIT-T137. First setting: the display title shown
// on nav tabs. Defaults to the id prefix (ids.key); stored as `display_name:` in the store's
// .ai/config.yml via PATCH /api/projects/:key (truth on disk, like every other mutation).
// After a save the projects-changed event nudges the Nav to refetch, so the tab renames live.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProjects, patchProject, announceProjectsChanged, ApiError } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { Loading, ErrorState } from '../components/AsyncState';
import './ProjectSettings.css';

export default function ProjectSettings() {
  const { key = '' } = useParams<{ key: string }>();
  const { data, loading, error, reload } = useAsync(getProjects, []);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  if (loading) return <Loading label={`Loading ${key} settings…`} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const project = (data ?? []).find((p) => p.key.toLowerCase() === key.toLowerCase());
  if (!project) return <ErrorState message={`unknown project '${key}'`} onRetry={reload} />;

  // Tolerate an API predating displayName (server not yet restarted after upgrade) —
  // a version skew must degrade to the key, never blank-page the app (2026-07-23 UAT crash).
  const current = project.displayName ?? project.key;
  const value = draft ?? current;

  const save = async () => {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      await patchProject(project.key, { displayName: value.trim() });
      announceProjectsChanged();
      await reload();
      setDraft(null);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="project-settings">
      <header className="page-header">
        <h1>{current} settings</h1>
        <p className="page-sub">
          <Link to={`/p/${project.key}`}>← back to the board</Link>
        </p>
      </header>

      <form
        className="settings-form"
        onSubmit={(e) => { e.preventDefault(); void save(); }}
      >
        <label htmlFor="display-name">Display title</label>
        <input
          id="display-name"
          className="input"
          value={value}
          onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
          maxLength={48}
        />
        <p className="settings-hint">
          Shown on the nav tab and boards. The id prefix stays <code>{project.key}</code> —
          it keys tickets and URLs; this only changes what you read.
        </p>
        <div className="settings-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || !value.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="settings-saved">Saved</span>}
          {saveError && <span className="settings-error">{saveError}</span>}
        </div>
      </form>
    </div>
  );
}

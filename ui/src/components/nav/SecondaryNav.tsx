// The secondary nav row (KIT-T149): the dropdown controls that don't belong in the tab strip — the
// project selector on the left, settings on the right. Kept as its own component so the primary tab
// row (TabBar) and this control row evolve independently.

import type { ProjectSummary } from '../../types';
import { ProjectSelector } from './ProjectSelector';
import { SettingsMenu } from './SettingsMenu';

interface Props {
  projects: ProjectSummary[];
}

export function SecondaryNav({ projects }: Props) {
  return (
    <div className="secondary-nav">
      <ProjectSelector projects={projects} />
      <div className="secondary-nav-spacer" />
      <SettingsMenu />
    </div>
  );
}

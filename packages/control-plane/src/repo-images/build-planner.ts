import {
  normalizeSandboxRuntimeSettings,
  resolveSandboxImageProfile,
  type SandboxImageProfile,
  type SandboxRuntimeSettings,
} from "@open-inspect/shared";

import {
  resolveSandboxSettings,
  resolveSandboxSettingsForRepos,
} from "../session/integration-settings-resolution";

export interface RepoImageBuildRepo {
  repoOwner: string;
  repoName: string;
}

export interface RepoImageBuildPlan {
  repo: RepoImageBuildRepo;
  sandboxSettings: SandboxRuntimeSettings;
  imageProfile: SandboxImageProfile;
}

/**
 * Resolves the build identity for repo-image creation.
 *
 * Repo image builds must use the same normalized sandbox settings and derived image profile whether
 * they are triggered manually or discovered by the scheduler. Keep that resolution here so route
 * handlers do not independently derive Docker/profile state and accidentally register or request a
 * build under a different profile.
 */
export class RepoImageBuildPlanner {
  constructor(private readonly db: D1Database) {}

  async plan(repo: RepoImageBuildRepo): Promise<RepoImageBuildPlan> {
    const sandboxSettings = normalizeSandboxRuntimeSettings(
      await resolveSandboxSettings(this.db, repo.repoOwner, repo.repoName)
    );
    return {
      repo,
      sandboxSettings,
      imageProfile: resolveSandboxImageProfile(sandboxSettings),
    };
  }

  async planMany(repos: RepoImageBuildRepo[]): Promise<RepoImageBuildPlan[]> {
    const sandboxSettings = (await resolveSandboxSettingsForRepos(this.db, repos)).map((settings) =>
      normalizeSandboxRuntimeSettings(settings)
    );
    if (sandboxSettings.length !== repos.length) {
      throw new Error(
        `resolveSandboxSettingsForRepos returned ${sandboxSettings.length} settings for ${repos.length} repos`
      );
    }
    return repos.map((repo, index) => ({
      repo,
      sandboxSettings: sandboxSettings[index],
      imageProfile: resolveSandboxImageProfile(sandboxSettings[index]),
    }));
  }
}

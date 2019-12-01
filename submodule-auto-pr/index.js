const { Toolkit } = require("actions-toolkit");
const Octokit = require("@octokit/rest");

Toolkit.run(async tools => {
  const owner = process.env.PR_TARGET_ORG;
  const repo = process.env.PR_TARGET_REPO;
  const submodulePath = process.env.PR_SUBMODULE_PATH;
  const targetBranch = process.env.PR_TARGET_BRANCH;
  const automationBranchName = process.env.PR_BRANCH_NAME;
  const prTitle = process.env.PR_TITLE;

  tools.log.debug(`Updating ${submodulePath} in ${owner}/${repo}@${targetBranch}`);
  tools.log.debug(`PR: ${prTitle} (${automationBranchName})`);

  // Overwrite the access token to be one with more permissions
  tools.github = new Octokit({ auth: process.env.GH_ADMIN_TOKEN });

  tools.log.pending("Fetching commit data");
  const newCommitHash = tools.context.payload.after;

  tools.log.complete("Available data:");
  tools.log.complete(`Commit: ${newCommitHash}`);

  try {
    tools.log.pending(`Fetching ${targetBranch} branch info`);
    const targetBranchSha = (await tools.github.repos.getBranch({
      owner,
      repo,
      branch: targetBranch
    })).data.commit.sha;
    tools.log.complete(`Current ${targetBranch}: ${targetBranchSha}`);

    tools.log.pending("Updating submodule");
    const updatedCommitSha = (await tools.github.git.createTree({
      base_tree: targetBranchSha,
      owner,
      repo,
      tree: [
        {
          path: submodulePath,
          mode: "160000",
          type: "commit",
          sha: newCommitHash
        }
      ]
    })).data.sha;
    tools.log.complete(`New submodule: ${newCommitHash}`);

    // Committing tree
    tools.log.pending(`Committing SHA: ${updatedCommitSha}`);
    const commit = await tools.github.git.createCommit({
      owner,
      repo,
      message: prTitle,
      tree: updatedCommitSha,
      parents: [targetBranchSha]
    });
    tools.log.complete(`SHA committed: ${updatedCommitSha}`);

    // Check if the branch exists
    let ref = `heads/${automationBranchName}`;
    const branchAlreadyExists = (await tools.github.git.listRefs({
      owner,
      repo,
      namespace: ref
    })).data.length;

    // If not, create it, otherwise update it
    let action;
    let baseRef;
    if (!branchAlreadyExists) {
      tools.log.pending("Creating branch");
      action = "createRef";
      baseRef = "refs/";
    } else {
      tools.log.pending("Updating branch");
      baseRef = "";
      action = "updateRef";
    }

    await tools.github.git[action]({
      owner,
      repo,
      force: true,
      ref: baseRef + ref,
      sha: commit.data.sha
    });
    tools.log.complete("Branch updated");

    // Create a PR with this commit hash if it doesn't exist
    const prAlreadyExists = (await tools.github.pulls.list({
      owner,
      repo,
      head: `${owner}:${automationBranchName}`
    })).data.length;

    if (!prAlreadyExists) {
      tools.log.pending("Creating PR");
      const pr = await tools.github.pulls.create({
        owner,
        repo,
        title: prTitle,
        head: automationBranchName,
        base: targetBranch
      });
      tools.log.success("PR created");
    } else {
      tools.log.warn("PR already exists. Not creating another");
    }
  } catch (e) {
    console.log(e);
    tools.exit.failure("Error updating submodule");
  }

  tools.exit.success("Processing complete");
});

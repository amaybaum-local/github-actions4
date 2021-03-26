const { Toolkit } = require("actions-toolkit");
let Octokit = require("@octokit/rest");
Octokit = Octokit.plugin(require("octokit-commit-multiple-files"));
const generator = require("./generate-snippets")
const fs = require("fs");
const childProcess = require("child_process");

Toolkit.run(async tools => {
  const owner = process.env.PR_TARGET_ORG;
  const repo = process.env.PR_TARGET_REPO;  
  let targetBranch = process.env.PR_TARGET_BRANCH; // We may overwrite this later
  const automationBranchName = process.env.PR_BRANCH_NAME;
  const prTitle = process.env.PR_TITLE;
  const prBody = process.env.PR_BODY;

  tools.log.debug(
    `updating code snippets`
  );
  tools.log.debug(`PR: ${prTitle} (${automationBranchName})`);

  // Overwrite the access token to be one with more permissions
  tools.github = new Octokit({ auth: process.env.GH_ADMIN_TOKEN });

  tools.log.pending("Fetching commit data");
  const newCommitHash = tools.context.payload.after;
  const pusherName = tools.context.payload.pusher.name;

  tools.log.complete("Available data:");
  tools.log.complete(`Commit: ${newCommitHash}`);

  // Check if the automation branch exists
  let ref = `heads/${automationBranchName}`;
  tools.log.pending(`Listing refs for ${ref}`);
  const branchAlreadyExists = (await tools.github.git.listRefs({
    owner,
    repo,
    namespace: ref
  })).data.length;
  tools.log.complete(`Listing refs for ${ref}`);

  // If the ref exists, our target branch is the automation branch (that ref)
  // If not, we build a tree from the original branch
  if (branchAlreadyExists) {
    tools.log.info(`Branch ${ref} already exists`);
    // If there are any commits on the branch not owned by us we need to add
    // a new commit in that branch's tree. If not, we can build a tree from
    // the target branch (usually master)
    tools.log.pending(`Fetching commits that already exist`);
    const commits = (await tools.github.repos.compareCommits({
      owner,
      repo,
      head: automationBranchName,
      base: targetBranch
    })).data.commits;
    tools.log.complete(`Fetching commits that already exist`);
    if (commits.length > 1) {
      tools.log.info(`Found ${commits.length} commits`);
      targetBranch = automationBranchName;
    }
  } else {
    tools.log.info(`Creating branch ${ref}`);
  }

  tools.log.pending(`Fetching ${targetBranch} branch info`);
  const targetBranchSha = (await tools.github.repos.getBranch({
    owner,
    repo,
    branch: targetBranch
  })).data.commit.sha;
  tools.log.complete(`Current ${targetBranch}: ${targetBranchSha}`);

  tools.log.pending("Updating code-snippets");
  childProcess.execSync("mkdir out");
  await generator.generate();    
  let verify_json = "packages/client/src/components/verify-demo/verify-code-example/verify-code-examples.json";
  let examples_json = "packages/client/src/components/code-example/code-examples.json";
  let code_snapshot = "packages/client/src/components/code-example/__snapshots__/CodeExample.test.js.snap"  
  fs.copyFileSync("examples.json",examples_json);
  fs.copyFileSync("examples-verify.json", verify_json);
  childProcess.execSync(`cd packages/client/ && npm run unit -- -u && cd ../../`);
  tools.log.complete('finished updating code snippets')
  tools.log.pending('committing files')
  let createBranch = true;  
  console.log(`owner: ${owner}, repo:${repo}, branch:${targetBranch}, createBranch: ${createBranch}`)
  let examples_contents = fs.readFileSync("examples.json");
  let verify_contents = fs.readFileSync("examples-verify.json");
  let code_snapshot_contents = fs.readFileSync(code_snapshot);
  const branchName = await tools.github.repos.createOrUpdateFiles({
      owner,
      repo,
      branch: automationBranchName,
      createBranch: createBranch,
      changes : [
          {
              message: "updating code snippets",
              files:{
                "packages/client/src/components/verify-demo/verify-code-example/verify-code-examples.json":verify_contents,
                "packages/client/src/components/code-example/code-examples.json":examples_contents,
                "packages/client/src/components/code-example/__snapshots__/CodeExample.test.js.snap":code_snapshot_contents
              }
          }          
      ]      
  });
  console.log(`branch name: ${branchName}`);
  tools.log.complete("committing files")  
  // Create a PR with this commit hash if it doesn't exist
  let pr = (await tools.github.pulls.list({
    owner,
    repo,
    head: `${owner}:${automationBranchName}`
  })).data[0];

  if (!pr) {
    tools.log.pending("Creating PR");
    pr = (await tools.github.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: automationBranchName,
      base: targetBranch
    })).data;
    tools.log.success("PR created");
  } else {
    tools.log.warn("PR already exists. Not creating another");
  }  

  tools.exit.success("Processing complete");
});

const { Toolkit } = require("actions-toolkit");
const nock = require("nock");

process.env.GITHUB_WORKFLOW = "test";
process.env.GITHUB_ACTION = "submodule-auto-pr";
process.env.GITHUB_ACTOR = "nexmodev";
process.env.GITHUB_REPOSITORY = "nexmo/api-specification";
process.env.GITHUB_EVENT_NAME = "push";
process.env.GITHUB_EVENT_PATH = __dirname + "/fixtures/push-to-master.json";
process.env.GITHUB_WORKSPACE = "/tmp";
process.env.GITHUB_SHA = "abc123";

// Config variables for the action
process.env.GH_ADMIN_TOKEN = "this-will-not-work-as-a-token";
process.env.PR_TARGET_ORG = "demo";
process.env.PR_TARGET_REPO = "to-be-updated";
process.env.PR_TARGET_BRANCH = "master";
process.env.PR_SUBMODULE_PATH = ".repos/example-submodule";
process.env.PR_BRANCH_NAME = "automatic-submodule-test";
process.env.PR_TITLE = "Automatic submodule test";

let owner = process.env.PR_TARGET_ORG;
let repo = process.env.PR_TARGET_REPO;
let target_branch = process.env.PR_TARGET_BRANCH;
let submodule_path = process.env.PR_SUBMODULE_PATH;
let pr_branch_name = process.env.PR_BRANCH_NAME;
let pr_title = process.env.PR_TITLE;

describe("Submodule Automatic PRs", () => {
  let tools;

  // Mock Toolkit.run to define `action` so we can call it
  Toolkit.run = jest.fn(actionFn => {
    action = actionFn;
  });

  // Load up our entrypoint file
  require(".");

  beforeEach(() => {
    tools = new Toolkit();

    tools.log.debug = jest.fn();
    tools.log.info = jest.fn();
    tools.log.pending = jest.fn();
    tools.log.complete = jest.fn();
    tools.log.success = jest.fn();
    tools.log.warn = jest.fn();

    tools.exit.success = jest.fn();
    tools.exit.failure = jest.fn();
  });

  it("new branch, new PR", async () => {
    mockTargetBranchAlreadyExistsOnParent(false);
    mockCreateTargetBranch();
    mockGetParentBranch();
    mockCreateTree("sha-of-current-master-in-parent");
    mockCommit("sha-of-current-master-in-parent");
    mockPulls(false);
    mockCreatePull();
    mockCreateReviewRequest();
    await action(tools);
    expect(tools.log.success).toHaveBeenCalledWith("PR created");
    expect(tools.exit.success).toHaveBeenCalledWith("Processing complete");
  });

  it("existing branch, new PR", async () => {
    mockTargetBranchAlreadyExistsOnParent(true);
    mockCompareCommits(1);
    mockGetParentBranch();
    mockCreateTree("sha-of-current-master-in-parent");
    mockCommit("sha-of-current-master-in-parent");
    mockUpdateTargetBranch();
    mockPulls(false);
    mockCreatePull();
    mockCreateReviewRequest();
    await action(tools);
    expect(tools.log.success).toHaveBeenCalledWith("PR created");
    expect(tools.exit.success).toHaveBeenCalledWith("Processing complete");
  });

  it("existing branch with single commit, existing PR", async () => {
    mockTargetBranchAlreadyExistsOnParent(true);
    mockCompareCommits(1);
    mockGetParentBranch();
    mockCreateTree("sha-of-current-master-in-parent");
    mockCommit("sha-of-current-master-in-parent");
    mockUpdateTargetBranch();
    mockPulls(true);
    mockCreateReviewRequest();
    await action(tools);
    expect(tools.log.warn).toHaveBeenCalledWith(
      "PR already exists. Not creating another"
    );
    expect(tools.exit.success).toHaveBeenCalledWith("Processing complete");
  });

  it("existing branch with multiple commits, existing PR", async () => {
    mockTargetBranchAlreadyExistsOnParent(true);
    mockCompareCommits(2);
    mockGetAutomationBranch();
    mockCreateTree("sha-of-current-automation-branch");
    mockCommit("sha-of-current-automation-branch");
    mockUpdateTargetBranch();
    mockPulls(true);
    mockCreateReviewRequest();
    await action(tools);
    expect(tools.log.warn).toHaveBeenCalledWith(
      "PR already exists. Not creating another"
    );
    expect(tools.exit.success).toHaveBeenCalledWith("Processing complete");
  });
});

function mockGetParentBranch() {
  nock("https://api.github.com")
    .get(`/repos/${owner}/${repo}/branches/${target_branch}`)
    .reply(200, {
      commit: { sha: "sha-of-current-master-in-parent" }
    });
}

function mockGetAutomationBranch() {
  nock("https://api.github.com")
    .get(`/repos/${owner}/${repo}/branches/${pr_branch_name}`)
    .reply(200, {
      commit: { sha: "sha-of-current-automation-branch" }
    });
}

function mockCompareCommits(requiredCommits) {
  requiredCommits = requiredCommits || 1;
  let commits = [{ sha: "sha-of-submodule-commit" }];

  for (let i = 1; i < requiredCommits; i++) {
    commits.push({
      sha: `sha-of-additional-content-that-prevents-force-push-${i}`
    });
  }

  nock("https://api.github.com")
    .get(`/repos/${owner}/${repo}/compare/${target_branch}...${pr_branch_name}`)
    .reply(200, {
      commits
    });
}

function mockCreateTree(parent_commit) {
  nock("https://api.github.com")
    .post(`/repos/${owner}/${repo}/git/trees`, {
      base_tree: parent_commit,
      tree: [
        {
          path: submodule_path,
          mode: "160000",
          type: "commit",
          sha: "latest-sha-in-repo-used-for-submodule"
        }
      ]
    })
    .reply(200, {
      sha: "sha-of-new-tree-in-parent"
    });
}

function mockCommit(parent_commit) {
  nock("https://api.github.com")
    .post(`/repos/${owner}/${repo}/git/commits`, {
      message: "Automatic submodule test",
      tree: "sha-of-new-tree-in-parent",
      parents: [parent_commit]
    })
    .reply(200, {
      sha: "sha-of-commit-in-parent"
    });
}

function mockTargetBranchAlreadyExistsOnParent(exists) {
  let response = [];
  if (exists) {
    response.push({ branch: "details" });
  }

  nock("https://api.github.com")
    .get(`/repos/${owner}/${repo}/git/refs/heads/${pr_branch_name}`)
    .reply(200, response);
}

function mockCreateTargetBranch() {
  nock("https://api.github.com")
    .post(`/repos/${owner}/${repo}/git/refs`, {
      force: true,
      ref: `refs/heads/${pr_branch_name}`,
      sha: "sha-of-commit-in-parent"
    })
    .reply(200, {
      sha: "sha-of-new-tree-in-parent"
    });
}

function mockUpdateTargetBranch() {
  nock("https://api.github.com")
    .patch(`/repos/${owner}/${repo}/git/refs/heads/${pr_branch_name}`, {
      force: true,
      sha: "sha-of-commit-in-parent"
    })
    .reply(200, {
      sha: "sha-of-new-tree-in-parent"
    });
}

function mockPulls(exists) {
  let response = [];
  if (exists) {
    response.push({ number: "1989" });
  }

  nock("https://api.github.com")
    .get(`/repos/${owner}/${repo}/pulls?head=demo%3Aautomatic-submodule-test`)
    .reply(200, response);
}

function mockCreatePull() {
  nock("https://api.github.com")
    .post(`/repos/${owner}/${repo}/pulls`, {
      title: pr_title,
      head: pr_branch_name,
      base: target_branch
    })
    .reply(200, { number: "1989" });
}

function mockCreateReviewRequest() {
  nock("https://api.github.com")
    .post(`/repos/${owner}/${repo}/pulls/1989/requested_reviewers`, {
      reviewers: ["mheap"]
    })
    .reply(200, { review: "created", this_is: "fake data" });
}

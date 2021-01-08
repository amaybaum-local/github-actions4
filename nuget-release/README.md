# NuGet Auto-Release Action

This action is meant to allow the maintainer of a .NET repository automatically release their NuGet package when a new release is cut in GitHub.

## Prerequisites

* You'll need a NuGet Account, from which you'll need to obtain your account's [NuGet Api Key](https://www.nuget.org/account/apikeys) The account will have to be an owner of the NuGet package that it seeks to publish.

## Example usage

```yml
name: Nuget Release

on:
  release:
    types: [published]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: ${{ github.event.release.target_commitish }}      
      - name: Release Nuget
        uses: nexmo/github-actions/nuget-release@master
        env:
          PROJECT_FILE : NugetActionTest.csproj          
          BRANCH: main
          ORGANIZATION: ORG_NAME
          REPO: test-nuget-action
          TAG: ${{ github.event.release.tag_name }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NUGET_API_KEY: ${{ secrets.NUGET_API_KEY }}
          GITHUB_USER_NAME: USER_NAME
          GITHUB_EMAIL: USER_EMAIL
```

## Args

| Arg name | Description |
| -------- | ---------- |
| PROJECT_FILE | The csproj file from which the nuget package will be built and released |
| BRANCH | The branch that you release off of. The csproj file will be updated and pushed back to your release branch. The tag will then be moved back to the branch|
| ORGANIZATION | The orginization your repo is in |
| REPO | the name of your repository |
| GITHUB_TOKEN | use `${{ secrets.GITHUB_TOKEN }}` |
| NUGET_API_KEY | your API key from NuGet - it is strongly advised that you add this to your repo's secrets and use it from there. |
| GITHUB_USER_NAME | Your github username |
| GITHUB_EMAIL| Your github email |
| TAG | Your releases tag - must use `${{ github.event.release.tag_name }}` |

> NOTE: TAG must be in the form of `vX.Y.Z` where X = major version, Y = minor Version, Z = patch version.
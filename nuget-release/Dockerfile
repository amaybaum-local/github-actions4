# Use the latest version of Node.js
#
# You may prefer the full image:
# FROM node
#
# or even an alpine image (a smaller, faster, less-feature-complete image):
# FROM node:alpine
#
# You can specify a version:
FROM mcr.microsoft.com/dotnet/sdk:6.0

# Labels for GitHub to read your action
LABEL "com.github.actions.name"="Publish release to NuGet"
LABEL "com.github.actions.description"="When a new release is tagged - update the csproj file of the project to the tagged version, and publish a new release."
# Here are all of the available icons: https://feathericons.com/
LABEL "com.github.actions.icon"="tag"
# And all of the available colors: https://developer.github.com/actions/creating-github-actions/creating-a-docker-container/#label
LABEL "com.github.actions.color"="blue"

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN apt-get update
RUN apt-get install nodejs -y
RUN apt-get install npm -y
RUN npm ci

# Copy the rest of your action's code
COPY . .

ENTRYPOINT ["node", "/index.js"]

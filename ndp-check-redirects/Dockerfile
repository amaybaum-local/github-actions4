FROM node:14-slim
COPY package*.json ./
RUN npm ci
COPY . .
ENTRYPOINT ["node", "/index.js"]

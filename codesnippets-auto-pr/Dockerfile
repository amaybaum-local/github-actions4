FROM node:10.14.2-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
COPY ./messages.json /fixures/
ENTRYPOINT ["node", "/app/index.js"]

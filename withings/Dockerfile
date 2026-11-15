# Optional Withings sync service (compose profile "withings").
# Node runs the TypeScript sources directly; there are no dependencies.
FROM node:26-alpine
WORKDIR /app
COPY withings/withings.ts withings/server.ts ./
RUN echo '{"type":"module"}' > package.json
# New named volumes take over the owner of these directories.
RUN mkdir /state /out && chown node:node /state /out
USER node
EXPOSE 8080
CMD ["node", "server.ts"]

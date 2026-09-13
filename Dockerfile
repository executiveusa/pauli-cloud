FROM node:26-alpine AS validation
RUN apk add --no-cache git openssh-client ca-certificates
WORKDIR /opt/pauli-cloud
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY bin ./bin
COPY src ./src
COPY scripts ./scripts
COPY test ./test
COPY prompts ./prompts
COPY schemas ./schemas
COPY icm ./icm
COPY docs ./docs
COPY README.md AGENTS.md CLAUDE.md SECURITY.md LICENSE ./
RUN npm run check && npm pack --dry-run

FROM node:26-alpine AS runtime
RUN apk add --no-cache git openssh-client ca-certificates \
  && addgroup -S pauli \
  && adduser -S -G pauli -h /home/pauli pauli
WORKDIR /opt/pauli-cloud
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/package.json /opt/pauli-cloud/package-lock.json ./
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/bin ./bin
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/src ./src
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/prompts ./prompts
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/schemas ./schemas
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/icm ./icm
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/docs ./docs
COPY --from=validation --chown=pauli:pauli /opt/pauli-cloud/README.md /opt/pauli-cloud/AGENTS.md /opt/pauli-cloud/CLAUDE.md /opt/pauli-cloud/SECURITY.md /opt/pauli-cloud/LICENSE ./
ENV NODE_ENV=production
ENV PAULI_CLOUD_HOST=0.0.0.0
ENV PAULI_CLOUD_PORT=4317
USER pauli
WORKDIR /workspace
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4317/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "/opt/pauli-cloud/bin/pauli-cloud.mjs"]
CMD ["serve", "/workspace", "--host=0.0.0.0", "--port=4317"]

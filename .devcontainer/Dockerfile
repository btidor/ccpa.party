# syntax = btidor/syntax

FROM mcr.microsoft.com/devcontainers/base:noble
COPY *.sources /etc/apt/sources.list.d/

ADD --apt nodejs libatomic1
RUN npm install -g npm@latest && \
  sudo -iu vscode -- npx --yes playwright install --with-deps

ADD --apt python3-pip brotli
RUN pip3 install --break-system-packages fonttools brotli uharfbuzz

RUN (curl -sL https://golang.org/dl/go1.25.1.linux-amd64.tar.gz | tar xzC /usr/local) && \
  (echo 'PATH=$PATH:/usr/local/go/bin' >> /home/vscode/.profile) && \
  sudo -iu vscode -- /usr/local/go/bin/go install -v golang.org/x/tools/gopls@latest && \
  sudo -iu vscode -- /usr/local/go/bin/go install -v github.com/go-delve/delve/cmd/dlv@latest && \
  sudo -iu vscode -- /usr/local/go/bin/go install -v honnef.co/go/tools/cmd/staticcheck@latest

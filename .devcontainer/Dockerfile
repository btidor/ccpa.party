FROM mcr.microsoft.com/vscode/devcontainers/base:0-hirsute

ENV DEBIAN_FRONTEND=noninteractive
COPY *.gpg /usr/share/keyrings/
COPY *.list /etc/apt/sources.list.d/

RUN apt update -q && apt upgrade -yq

RUN apt install -yq nodejs libatomic1 && \
    npm install -g npm@latest vercel@latest

RUN apt install -yq python3-pip brotli && \
    pip3 install fonttools brotli uharfbuzz

RUN (curl -sL https://golang.org/dl/go1.18.3.linux-amd64.tar.gz | tar xzC /usr/local) && \
    (echo 'PATH=$PATH:/usr/local/go/bin' >> /home/vscode/.profile)

RUN sudo -iu vscode -- /usr/local/go/bin/go install -v golang.org/x/tools/gopls@latest && \
    sudo -iu vscode -- /usr/local/go/bin/go install -v github.com/go-delve/delve/cmd/dlv@latest && \
    sudo -iu vscode -- /usr/local/go/bin/go install -v honnef.co/go/tools/cmd/staticcheck@latest

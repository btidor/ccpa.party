FROM mcr.microsoft.com/vscode/devcontainers/base:0-hirsute

ENV DEBIAN_FRONTEND=noninteractive
COPY *.gpg /usr/share/keyrings/
COPY *.list /etc/apt/sources.list.d/

RUN apt update -q && apt upgrade -yq

RUN apt install -yq nodejs && \
    npm install -g npm@latest

package main

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"strings"
	"syscall/js"
)

var mimeDecoder = mime.WordDecoder{}

var headers = []string{"From", "To", "Cc", "Subject", "Content-Type", "X-Gmail-Labels"}

func ParseEmail(_ js.Value, args []js.Value) any {
	buf := make([]byte, args[0].Length())
	js.CopyBytesToGo(buf, args[0])

	first, rest, found := bytes.Cut(buf, []byte("\r\n"))
	if !found {
		panic("couldn't find newline in message")
	}

	builder := new(strings.Builder)
	builder.Write(first)
	builder.WriteString("\r\n")

	msg, err := mail.ReadMessage(bytes.NewReader(rest))
	if err != nil {
		panic(err)
	}
	for _, name := range headers {
		dec, err := mimeDecoder.DecodeHeader(msg.Header.Get(name))
		if err != nil {
			panic(err)
		}
		if dec != "" {
			builder.WriteString(name)
			builder.WriteString(": ")
			builder.WriteString(dec)
			builder.WriteString("\r\n")
		}
	}

	builder.WriteString("\r\n")
	parseSection(msg.Header, msg.Body, builder)

	return builder.String()
}

type header interface {
	Get(key string) string
}

func parseSection(header header, body io.Reader, builder *strings.Builder) {
	mediatype, params, err := mime.ParseMediaType(header.Get("Content-Type"))
	if err != nil {
		panic(err)
	}
	if mediatype == "text/plain" || mediatype == "text/html" {
		encoding := strings.ToLower(header.Get("Content-Transfer-Encoding"))
		switch encoding {
		case "", "7bit", "8bit", "binary":
			_, err = io.Copy(builder, body)
			if err != nil {
				panic(err)
			}
		case "base64":
			inner := new(strings.Builder)
			_, err = io.Copy(inner, body)
			if err != nil {
				panic(err)
			}
			decoded, err := base64.StdEncoding.DecodeString(inner.String())
			if err != nil {
				panic(err)
			}
			builder.Write(decoded)
		case "quoted-printable":
			_, err = io.Copy(builder, quotedprintable.NewReader(body))
			if err != nil {
				panic(err)
			}
		default:
			panic("unkown content-transfer-encoding: " + encoding)
		}
	} else if mediatype == "multipart/alternative" {
		multi := multipart.NewReader(body, params["boundary"])
		for {
			part, err := multi.NextPart()
			if err == io.EOF {
				break
			} else if err != nil {
				panic(err)
			}
			mediatype, _, err := mime.ParseMediaType(part.Header.Get("Content-Type"))
			if err != nil {
				panic(err)
			}
			if mediatype == "text/plain" || mediatype == "text/html" {
				parseSection(part.Header, part, builder)
				break
			}
		}
	} else if strings.HasPrefix(mediatype, "multipart/") {
		multi := multipart.NewReader(body, params["boundary"])
		for {
			part, err := multi.NextPart()
			if err == io.EOF {
				break
			} else if err != nil {
				panic(err)
			}
			parseSection(part.Header, part, builder)
		}
	}
}

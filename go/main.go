package main

import (
	"archive/tar"
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

func main() {
	js.Global().Get("hooks").Set("TarFile", js.FuncOf(TarFile))
	js.Global().Get("hooks").Set("ParseEmail", js.FuncOf(ParseEmail))

	ch := make(chan interface{})
	<-ch
}

func TarFile(_ js.Value, args []js.Value) any {
	f := NewStreamReader(args[0])
	t := tar.NewReader(f)

	obj := js.Global().Get("Object").New()
	promise := js.Global().Get("Promise")
	obj.Set("Next", js.FuncOf(func(_ js.Value, _ []js.Value) any {
		var resolve js.Value
		p := promise.New(js.FuncOf(func(_ js.Value, args []js.Value) any {
			resolve = args[0]
			return nil
		}))
		go func() {
			hdr, err := t.Next()
			if err != nil {
				resolve.Invoke([]interface{}{js.Null(), err.Error()})
				return
			}
			resolve.Invoke([]interface{}{
				map[string]interface{}{
					"name": hdr.Name,
					"type": string(hdr.Typeflag),
					"size": hdr.Size,
				},
			})
		}()
		return p
	}))
	obj.Set("Read", js.FuncOf(func(_ js.Value, args []js.Value) any {
		var resolve js.Value
		p := promise.New(js.FuncOf(func(_ js.Value, args []js.Value) any {
			resolve = args[0]
			return nil
		}))
		go func() {
			size := args[0].Get("length").Int()
			buf := make([]byte, size)
			n, err := t.Read(buf)
			if err != nil && err != io.EOF {
				panic(err)
			}
			js.CopyBytesToJS(args[0], buf[:n])
			resolve.Invoke(n)
		}()
		return p
	}))
	return obj
}

var mimeDecoder = mime.WordDecoder{}

var headers = []string{"From", "To", "Cc", "Subject", "X-Gmail-Labels"}

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
	if mediatype == "text/plain" {
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
			if mediatype == "text/plain" {
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

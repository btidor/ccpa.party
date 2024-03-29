package main

import (
	"archive/tar"
	"io"
	"syscall/js"
)

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
